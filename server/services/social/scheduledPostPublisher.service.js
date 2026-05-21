import { ObjectId } from "mongodb";
import ScheduledPost from "../../models/ScheduledPost.js";
import { publishFacebookPagePost, publishFacebookPhotoFromBuffer } from "./facebookPublish.service.js";
import { resolveFacebookPublishCredentials } from "./facebookPublishCredentials.service.js";
import { loadMediaBufferFromUrl } from "./hostedMedia.service.js";
import { publishInstagramContent } from "./instagram.service.js";
import linkedinProvider from "./linkedin.service.js";
import threadsService from "./threads.service.js";
import { publishTelegramPost } from "./telegramPublish.service.js";
import {
  getLinkedInAccountForToken,
  getLinkedInOrganizationAccount,
  getStoredAccountForProvider,
} from "./socialAccount.service.js";
import { getLinkedInAuthorUrn } from "./linkedinAuthor.util.js";
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

function assertLinkedInConnected(account) {
  if (!account?.isConnected) throw new Error("LinkedIn not connected");
  const accessToken = account.getDecryptedAccessToken?.();
  if (!accessToken) throw new Error("LinkedIn not connected");
  const tokenExpired = account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
  if (tokenExpired) throw new Error("LinkedIn token expired. Reconnect your account.");
  return accessToken;
}

async function publishLinkedIn(userId, caption, mediaUrl, channelKey) {
  const parsed = parseCreatePostChannelKey(channelKey);
  const tokenAccount = await getLinkedInAccountForToken(userId);
  let accessToken = assertLinkedInConnected(tokenAccount);

  let authorAccount = tokenAccount;
  if (parsed.entityType === "organization" && parsed.entityId) {
    const orgAccount = await getLinkedInOrganizationAccount(userId, parsed.entityId);
    if (!orgAccount) throw new Error("LinkedIn organization not connected");
    accessToken = assertLinkedInConnected(orgAccount);
    authorAccount = orgAccount;
  }

  const authorUrn = getLinkedInAuthorUrn(authorAccount);
  if (!authorUrn) throw new Error("LinkedIn author identity missing");

  const kind = inferMediaKind(mediaUrl);
  let apiMediaType = "TEXT";
  let mediaAssetUrn = "";

  if (mediaUrl && kind === "image") {
    apiMediaType = "IMAGE";
    const { buffer, mime } = await loadMediaBufferFromUrl(mediaUrl);
    const registered = await linkedinProvider.registerFeedshareUpload(
      accessToken,
      authorUrn,
      linkedinProvider.FEEDSHARE_IMAGE_RECIPE
    );
    await linkedinProvider.uploadBinaryToLinkedIn(
      registered.uploadUrl,
      registered.uploadHeaders,
      buffer,
      mime
    );
    mediaAssetUrn = registered.assetUrn;
  } else if (mediaUrl && kind === "video") {
    apiMediaType = "VIDEO";
    const { buffer, mime } = await loadMediaBufferFromUrl(mediaUrl);
    const registered = await linkedinProvider.registerFeedshareUpload(
      accessToken,
      authorUrn,
      linkedinProvider.FEEDSHARE_VIDEO_RECIPE
    );
    await linkedinProvider.uploadBinaryToLinkedIn(
      registered.uploadUrl,
      registered.uploadHeaders,
      buffer,
      mime
    );
    mediaAssetUrn = registered.assetUrn;
  } else if (!caption) {
    throw new Error("LinkedIn requires post text");
  }

  await linkedinProvider.createUgcPost(accessToken, {
    authorUrn,
    commentary: caption,
    mediaType: apiMediaType,
    mediaAssetUrn: mediaAssetUrn || undefined,
  });
}

async function publishThreads(userId, caption, mediaUrl) {
  const account = await getStoredAccountForProvider(userId, "threads");
  if (!account?.isConnected) throw new Error("Threads not connected");

  const scopes = Array.isArray(account.scopes) ? account.scopes : [];
  if (!scopes.includes("threads_content_publish")) {
    throw new Error(
      "Threads posting permission is missing. Reconnect and approve content publishing."
    );
  }

  const accessToken = account.getDecryptedAccessToken?.();
  if (!accessToken) throw new Error("Threads not connected");
  const tokenExpired = account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
  if (tokenExpired) throw new Error("Threads token expired. Reconnect your account.");

  const threadsUserId = String(account.platformUserId || "").trim();
  if (!threadsUserId) throw new Error("Threads profile not configured");

  const kind = inferMediaKind(mediaUrl);
  const mediaType = !mediaUrl ? "TEXT" : kind === "video" ? "VIDEO" : "IMAGE";
  if (mediaType === "TEXT" && !caption) throw new Error("Threads requires post text");

  await threadsService.createAndPublishPost(threadsUserId, accessToken, {
    mediaType,
    text: caption,
    mediaUrl: mediaUrl || "",
  });
}

const SERVER_PUBLISHERS = {
  instagram: publishInstagram,
  telegram: publishTelegram,
  threads: publishThreads,
};

async function publishChannel(userId, channelKey, caption, mediaUrl) {
  const parsed = parseCreatePostChannelKey(channelKey);
  if (parsed.platformKey === "facebook") {
    if (parsed.entityType === "profile") {
      throw new Error("Personal Facebook profiles are not supported. Use a Facebook Page.");
    }
    return publishFacebook(userId, caption, mediaUrl, parsed.entityId);
  }
  if (parsed.platformKey === "linkedin") {
    return publishLinkedIn(userId, caption, mediaUrl, channelKey);
  }
  const publish = SERVER_PUBLISHERS[parsed.platformKey];
  if (!publish) {
    throw new Error(`Scheduled publish is not supported for ${parsed.platformKey} yet.`);
  }
  return publish(userId, caption, mediaUrl);
}

function mergeChannelResults(existing, channelKeys, freshResults) {
  const byKey = new Map((existing || []).map((r) => [r.channelKey, r]));
  for (const result of freshResults) {
    byKey.set(result.channelKey, result);
  }
  return channelKeys.map((k) => byKey.get(k)).filter(Boolean);
}

function derivePostStatus(channelKeys, results) {
  const okCount = results.filter((r) => r.status === "success").length;
  if (okCount === channelKeys.length) return "published";
  if (okCount > 0) return "partially_published";
  return "failed";
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

  const status = derivePostStatus(channelKeys, results);
  const okCount = results.filter((r) => r.status === "success").length;

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

async function retryFailedChannels(postDoc) {
  const channelKeys = Array.isArray(postDoc.channelKeys) ? postDoc.channelKeys : [];
  const failedKeys = (postDoc.channelResults || [])
    .filter((r) => r.status === "failed")
    .map((r) => r.channelKey)
    .filter((k) => channelKeys.includes(k));
  if (!failedKeys.length) return null;

  const userId = new ObjectId(postDoc.userId);
  const caption = (postDoc.caption || "").trim();
  const mediaUrl = (postDoc.mediaUrl || "").trim();

  const freshResults = [];
  for (const channelKey of failedKeys) {
    try {
      await publishChannel(userId, channelKey, caption, mediaUrl);
      freshResults.push(
        buildScheduledChannelResult(channelKey, "success", { error: "", publishedAt: new Date() })
      );
    } catch (err) {
      freshResults.push(
        buildScheduledChannelResult(channelKey, "failed", {
          error: err?.message || "Failed",
          publishedAt: null,
        })
      );
    }
  }

  const results = mergeChannelResults(postDoc.channelResults, channelKeys, freshResults);
  const status = derivePostStatus(channelKeys, results);
  const okCount = results.filter((r) => r.status === "success").length;

  return ScheduledPost.findByIdAndUpdate(
    postDoc._id,
    {
      $set: {
        status,
        channelResults: results,
        publishedAt: okCount ? new Date() : postDoc.publishedAt || null,
        lastError: results.find((r) => r.status === "failed")?.error || "",
      },
    },
    { new: true }
  );
}

export async function processDueScheduledPosts() {
  const now = new Date();
  const due = await ScheduledPost.find({
    status: { $in: ["scheduled", "partially_published"] },
    scheduledAt: { $lte: now },
  })
    .limit(20)
    .lean();

  for (const row of due) {
    try {
      if (row.status === "partially_published") {
        await retryFailedChannels(row);
      } else {
        await publishScheduledPostDocument(row);
      }
    } catch (err) {
      await ScheduledPost.findByIdAndUpdate(row._id, {
        $set: { status: "failed", lastError: err?.message || "Scheduler failed" },
      });
    }
  }

  return due.length;
}
