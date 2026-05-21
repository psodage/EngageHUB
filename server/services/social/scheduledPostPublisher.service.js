import { ObjectId } from "mongodb";
import ScheduledPost from "../../models/ScheduledPost.js";
import { publishFacebookPagePost, publishFacebookPhotoFromBuffer } from "./facebookPublish.service.js";
import { resolveFacebookPublishCredentials } from "./facebookPublishCredentials.service.js";
import { loadMediaBufferFromUrl } from "./hostedMedia.service.js";
import { publishInstagramContent } from "./instagram.service.js";
import { publishTelegramPost } from "./telegramPublish.service.js";
import { getStoredAccountForProvider } from "./socialAccount.service.js";
import {
  buildScheduledChannelResult,
  parseCreatePostChannelKey,
} from "../../utils/createPostChannelKey.js";

function inferMediaKind(mediaUrl) {
  const u = (mediaUrl || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)) return "video";
  if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u)) return "image";
  return null;
}

async function publishFacebook(userId, caption, mediaUrl, entityId = "") {
  const ctx = await resolveFacebookPublishCredentials(userId, entityId, "page");
  if (!ctx.ok || ctx.targetType !== "page") {
    throw new Error("Facebook Page not connected");
  }

  const kind = inferMediaKind(mediaUrl);
  const mediaType = !mediaUrl ? "TEXT" : kind === "video" ? "VIDEO" : "IMAGE";

  if (mediaType === "IMAGE" && mediaUrl) {
    const { buffer, mime } = await loadMediaBufferFromUrl(mediaUrl);
    await publishFacebookPhotoFromBuffer({
      targetType: "page",
      pageId: ctx.pageId,
      pageAccessToken: ctx.accessToken,
      buffer,
      mime,
      message: caption,
    });
    return;
  }

  await publishFacebookPagePost({
    pageId: ctx.pageId,
    pageAccessToken: ctx.accessToken,
    mediaType,
    message: caption,
    mediaUrl: mediaUrl || "",
    linkUrl: "",
  });
}

async function publishInstagram(userId, caption, mediaUrl) {
  if (!mediaUrl) throw new Error("Instagram requires media");
  const account = await getStoredAccountForProvider(userId, "instagram");
  if (!account?.isConnected) throw new Error("Instagram not connected");
  const token = account.getDecryptedAccessToken?.();
  const igUserId = String(account.platformUserId || "").trim();
  if (!token || !igUserId) throw new Error("Instagram not configured");
  const kind = inferMediaKind(mediaUrl);
  await publishInstagramContent({
    accessToken: token,
    igUserId,
    mediaType: kind === "video" ? "REEL" : "IMAGE",
    mediaUrl,
    caption,
  });
}

async function publishTelegram(userId, caption, mediaUrl) {
  const account = await getStoredAccountForProvider(userId, "telegram");
  if (!account?.isConnected) throw new Error("Telegram not connected");
  const botToken = account.getDecryptedAccessToken?.();
  const targets = account.metadata?.telegramTargets;
  const chatId = Array.isArray(targets) && targets[0]?.chatId ? String(targets[0].chatId) : "";
  if (!botToken || !chatId) throw new Error("Telegram target not configured");
  const kind = inferMediaKind(mediaUrl);
  await publishTelegramPost({
    botToken,
    chatId,
    message: caption,
    mediaType: mediaUrl ? (kind === "video" ? "VIDEO" : "IMAGE") : "TEXT",
    mediaUrl: mediaUrl || "",
    linkUrl: "",
  });
}

const SERVER_PUBLISHERS = {
  instagram: publishInstagram,
  telegram: publishTelegram,
};

async function publishChannel(userId, channelKey, caption, mediaUrl) {
  const parsed = parseCreatePostChannelKey(channelKey);
  if (parsed.platformKey === "facebook") {
    if (parsed.entityType === "profile") {
      throw new Error("Personal Facebook profiles are not supported. Use a Facebook Page.");
    }
    return publishFacebook(userId, caption, mediaUrl, parsed.entityId);
  }
  const publish = SERVER_PUBLISHERS[parsed.platformKey];
  if (!publish) {
    throw new Error(`${parsed.platformKey} scheduled publish runs from the app when due (open Queue).`);
  }
  return publish(userId, caption, mediaUrl);
}

export async function publishScheduledPostDocument(postDoc) {
  const userId = new ObjectId(postDoc.userId);
  const caption = (postDoc.caption || "").trim();
  const mediaUrl = (postDoc.mediaUrl || "").trim();
  const channelKeys = Array.isArray(postDoc.channelKeys) ? postDoc.channelKeys : [];

  let doc = await ScheduledPost.findByIdAndUpdate(
    postDoc._id,
    {
      $set: {
        status: "publishing",
        channelResults: channelKeys.map((k) => buildScheduledChannelResult(k, "publishing")),
      },
    },
    { new: true }
  );

  const results = [];
  for (const channelKey of channelKeys) {
    try {
      await publishChannel(userId, channelKey, caption, mediaUrl);
      results.push(
        buildScheduledChannelResult(channelKey, "success", { error: "", publishedAt: new Date() })
      );
    } catch (err) {
      results.push(
        buildScheduledChannelResult(channelKey, "failed", {
          error: err?.message || "Failed",
          publishedAt: null,
        })
      );
    }
  }

  const okCount = results.filter((r) => r.status === "success").length;
  const status =
    okCount === channelKeys.length ? "published" : okCount > 0 ? "partially_published" : "failed";

  doc = await ScheduledPost.findByIdAndUpdate(
    postDoc._id,
    {
      $set: {
        status,
        channelResults: results,
        publishedAt: okCount ? new Date() : null,
        lastError: results.find((r) => r.status === "failed")?.error || "",
      },
    },
    { new: true }
  );

  return doc;
}

export async function processDueScheduledPosts() {
  const now = new Date();
  const due = await ScheduledPost.find({
    status: "scheduled",
    scheduledAt: { $lte: now },
  })
    .limit(20)
    .lean();

  for (const row of due) {
    try {
      await publishScheduledPostDocument(row);
    } catch (err) {
      await ScheduledPost.findByIdAndUpdate(row._id, {
        $set: { status: "failed", lastError: err?.message || "Scheduler failed" },
      });
    }
  }

  return due.length;
}
