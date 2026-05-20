import { ObjectId } from "mongodb";
import ScheduledPost from "../../models/ScheduledPost.js";
import { getStoredAccountForProvider } from "./socialAccount.service.js";
import { publishFacebookProfilePost } from "./facebookPublish.service.js";
import { publishInstagramContent } from "./instagram.service.js";
import { publishTelegramPost } from "./telegramPublish.service.js";

function inferMediaKind(mediaUrl) {
  const u = (mediaUrl || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)) return "video";
  if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u)) return "image";
  return null;
}

async function publishFacebook(userId, caption, mediaUrl) {
  let account = await getStoredAccountForProvider(userId, "facebook");
  if (!account?.isConnected) throw new Error("Facebook not connected");
  let token = account.getDecryptedAccessToken?.();
  if (!token) throw new Error("Facebook token missing");
  const kind = inferMediaKind(mediaUrl);
  const mediaType = !mediaUrl ? "TEXT" : kind === "video" ? "VIDEO" : "IMAGE";
  await publishFacebookProfilePost({
    userAccessToken: token,
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
  facebook: publishFacebook,
  instagram: publishInstagram,
  telegram: publishTelegram,
};

export async function publishScheduledPostDocument(postDoc) {
  const userId = new ObjectId(postDoc.userId);
  const caption = (postDoc.caption || "").trim();
  const mediaUrl = (postDoc.mediaUrl || "").trim();
  const channelKeys = Array.isArray(postDoc.channelKeys) ? postDoc.channelKeys : [];

  let doc = await ScheduledPost.findByIdAndUpdate(
    postDoc._id,
    { $set: { status: "publishing", channelResults: channelKeys.map((k) => ({ platformKey: k, status: "publishing" })) } },
    { new: true }
  );

  const results = [];
  for (const platformKey of channelKeys) {
    const publish = SERVER_PUBLISHERS[platformKey];
    try {
      if (!publish) {
        throw new Error(`${platformKey} scheduled publish runs from the app when due (open Queue).`);
      }
      await publish(userId, caption, mediaUrl);
      results.push({ platformKey, status: "success", error: "", publishedAt: new Date() });
    } catch (err) {
      results.push({ platformKey, status: "failed", error: err?.message || "Failed", publishedAt: null });
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
