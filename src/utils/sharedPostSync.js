import { createEmptyChannelDraft, getPlatformComposerConfig } from "../data/platformComposerConfig";

export function truncateCaptionForPlatform(caption, platformKey) {
  const max = getPlatformComposerConfig(platformKey).maxChars ?? 2200;
  return (caption || "").slice(0, max);
}

/** Pick the tightest caption limit across selected channels (for shared composer). */
export function getSharedCaptionLimit(channelKeys) {
  if (!channelKeys.length) return 2200;
  return Math.min(...channelKeys.map((key) => getPlatformComposerConfig(key).maxChars ?? 2200));
}

function inferMediaKind(file, mediaUrl) {
  if (file) {
    if ((file.type || "").startsWith("video/")) return "video";
    if ((file.type || "").startsWith("image/")) return "image";
  }
  const u = (mediaUrl || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)) return "video";
  if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(u)) return "image";
  return null;
}

/**
 * Build a per-platform draft from shared caption + media for one-click publishing.
 */
export function buildDraftFromShared(platformKey, shared, preUploadedMediaUrl = "") {
  const base = createEmptyChannelDraft(platformKey);
  const caption = truncateCaptionForPlatform(shared.caption, platformKey);
  const file = shared.file || null;
  const mediaUrl = preUploadedMediaUrl || (shared.mediaUrl || "").trim();
  const kind = inferMediaKind(file, mediaUrl);
  const hasMedia = Boolean(file || mediaUrl);

  const draft = {
    ...base,
    caption,
    file,
    mediaUrl: file ? "" : mediaUrl,
    error: "",
  };

  if (platformKey === "instagram") {
    if (!hasMedia) {
      draft.error = "Instagram requires a photo or video.";
      return draft;
    }
    draft.postType = kind === "video" ? "reel" : "post";
    return draft;
  }

  if (platformKey === "facebook") {
    if (!hasMedia) {
      draft.postType = "text";
    } else if (kind === "video") {
      draft.postType = "video";
    } else {
      draft.postType = "image";
    }
    return draft;
  }

  if (platformKey === "threads") {
    if (!hasMedia) {
      draft.postType = "text";
    } else if (kind === "video") {
      draft.postType = "video";
    } else {
      draft.postType = "image";
    }
    return draft;
  }

  if (platformKey === "linkedin") {
    if (!hasMedia) {
      draft.postType = "text";
    } else if (kind === "video") {
      draft.postType = "video";
    } else {
      draft.postType = "image";
    }
    return draft;
  }

  if (platformKey === "x") {
    draft.postType = "post";
    return draft;
  }

  if (platformKey === "youtube") {
    draft.postType = "video";
    draft.youtubeTitle = caption.slice(0, 100);
    draft.youtubePrivacy = draft.youtubePrivacy || "private";
    return draft;
  }

  if (platformKey === "googleBusiness") {
    draft.postType = "update";
    return draft;
  }

  return draft;
}

export function syncSharedToAllDrafts(channelKeys, shared) {
  const next = {};
  channelKeys.forEach((key) => {
    next[key] = buildDraftFromShared(key, shared);
  });
  return next;
}

/** Read shared caption/media from per-channel drafts (first channel with content wins). */
export function getSharedFromDrafts(channelKeys, drafts = {}) {
  if (!channelKeys.length) return { caption: "", file: null, mediaUrl: "" };
  const caption =
    channelKeys.map((k) => drafts[k]?.caption?.trim()).find(Boolean) ||
    drafts[channelKeys[0]]?.caption ||
    "";
  const file = channelKeys.map((k) => drafts[k]?.file).find(Boolean) || null;
  const mediaUrl =
    channelKeys.map((k) => drafts[k]?.mediaUrl?.trim()).find(Boolean) || "";
  return { caption, file, mediaUrl };
}
