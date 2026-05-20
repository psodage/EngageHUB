import {
  postToDiscord,
  postToFacebook,
  postToGoogleBusiness,
  postToLinkedIn,
  postToTelegram,
  postToThreads,
  postToX,
  postYouTubeVideo,
  publishInstagramPost,
  uploadSocialPublicMedia,
  uploadSocialPublicMediaFile,
} from "../services/socialApi";
import { getActivePostTypeConfig } from "../data/platformComposerConfig";
import {
  resolveDiscordTarget,
  resolveGoogleBusinessLocation,
  resolveTelegramChatId,
  resolveYouTubeChannelId,
} from "./resolvePostingTarget";

function inferThreadsMediaTypeFromUrl(url) {
  const u = (url || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)) return "VIDEO";
  return "IMAGE";
}

export function validateChannelDraft(platformKey, draft) {
  const typeConfig = getActivePostTypeConfig(platformKey, draft.postType);
  const caption = (draft.caption || "").trim();
  const mediaUrl = (draft.mediaUrl || "").trim();
  const linkUrl = (draft.linkUrl || "").trim();

  if (platformKey === "instagram") {
    if (typeConfig?.disabled) return typeConfig.hint || "This post type is not supported.";
    if (!draft.file && !mediaUrl) return "Add a photo or video for Instagram.";
    return null;
  }

  if (platformKey === "facebook") {
    const mediaType = typeConfig?.mediaType || "TEXT";
    if (mediaType === "TEXT" && !caption) return "Enter post text.";
    if (mediaType === "LINK" && !linkUrl) return "Enter a link URL.";
    if ((mediaType === "IMAGE" || mediaType === "VIDEO") && !draft.file && !mediaUrl) {
      return "Add media or a public media URL.";
    }
    return null;
  }

  if (platformKey === "threads") {
    const mediaType = typeConfig?.mediaType || "TEXT";
    if (mediaType === "TEXT" && !caption) return "Enter post text.";
    if (mediaType !== "TEXT" && !draft.file && !mediaUrl) return "Add media or a public URL.";
    if (draft.file && mediaUrl) return "Use either a file upload or a URL—not both.";
    return null;
  }

  if (platformKey === "x") {
    if (!caption) return "Post content is required.";
    if (caption.length > 280) return "Post cannot exceed 280 characters.";
    return null;
  }

  if (platformKey === "linkedin") {
    const mediaType = typeConfig?.mediaType || "TEXT";
    if (mediaType === "TEXT" && !caption) return "Enter post text.";
    if ((mediaType === "IMAGE" || mediaType === "VIDEO") && !draft.file && !mediaUrl) {
      return "Add media for this post type.";
    }
    return null;
  }

  if (platformKey === "telegram") {
    if (!caption && !draft.file && !mediaUrl) return "Add a message or media for Telegram.";
    return null;
  }

  if (platformKey === "discord") {
    if (!caption && !draft.file && !mediaUrl) return "Add a message or media for Discord.";
    return null;
  }

  if (platformKey === "googleBusiness") {
    if (!caption) return "Enter post summary for Google Business.";
    return null;
  }

  if (platformKey === "youtube") {
    if (!draft.youtubeTitle?.trim() && !caption) return "Video title is required for YouTube.";
    if (!draft.file && !mediaUrl) return "Add a video file for YouTube.";
    if (draft.file && !draft.file.type?.startsWith("video/")) return "YouTube requires a video file.";
    return null;
  }

  if (!caption && !draft.file && !mediaUrl) return "Add a caption or media.";
  return null;
}

export async function publishChannelDraft(platformKey, draft, options = {}) {
  const typeConfig = getActivePostTypeConfig(platformKey, draft.postType);
  const caption = (draft.caption || "").trim();
  const mediaUrl = (draft.mediaUrl || "").trim();
  const linkUrl = (draft.linkUrl || "").trim();
  const preUploadedMediaUrl = (options.preUploadedMediaUrl || "").trim();
  const account = options.connectedAccount || null;

  if (platformKey === "instagram") {
    const mediaType = typeConfig?.mediaType || "IMAGE";
    let url = preUploadedMediaUrl || mediaUrl;
    if (!url && draft.file) {
      url = await uploadSocialPublicMediaFile(draft.file);
      if (!url) throw new Error("Upload did not return a URL.");
    }
    const result = await publishInstagramPost({
      mediaType,
      mediaUrl: url,
      caption: caption || undefined,
    });
    if (!result?.success) throw new Error(result?.message || "Instagram publishing failed.");
    return result.message || "Published to Instagram.";
  }

  if (platformKey === "facebook") {
    const mediaType = typeConfig?.mediaType || "TEXT";
    let resolvedMediaUrl = preUploadedMediaUrl || mediaUrl;
    if (!resolvedMediaUrl && draft.file && (mediaType === "IMAGE" || mediaType === "VIDEO")) {
      resolvedMediaUrl = await uploadSocialPublicMedia(draft.file);
    }
    const result = await postToFacebook({
      message: caption,
      mediaType,
      mediaUrl: resolvedMediaUrl || undefined,
      linkUrl: mediaType === "LINK" ? linkUrl : undefined,
    });
    return result?.message || "Published to Facebook.";
  }

  if (platformKey === "threads") {
    const mediaType = typeConfig?.mediaType || "TEXT";
    let resolvedUrl = "";
    let apiMediaType = "TEXT";
    if (mediaType === "TEXT") {
      apiMediaType = "TEXT";
    } else if (preUploadedMediaUrl || draft.file) {
      resolvedUrl = preUploadedMediaUrl || (await uploadSocialPublicMedia(draft.file));
      apiMediaType =
        preUploadedMediaUrl && inferThreadsMediaTypeFromUrl(preUploadedMediaUrl) === "VIDEO"
          ? "VIDEO"
          : (draft.file?.type || "").startsWith("video/")
            ? "VIDEO"
            : "IMAGE";
    } else if (mediaUrl) {
      resolvedUrl = mediaUrl;
      apiMediaType = inferThreadsMediaTypeFromUrl(mediaUrl);
    }
    const result = await postToThreads({ text: caption, mediaUrl: resolvedUrl, mediaType: apiMediaType });
    return result?.message || "Published to Threads.";
  }

  if (platformKey === "x") {
    await postToX(caption);
    return "Published to X.";
  }

  if (platformKey === "linkedin") {
    const mediaType = typeConfig?.mediaType || "TEXT";
    const mediaFile = draft.file || null;
    // LinkedIn API requires multipart upload for IMAGE/VIDEO; do not send a public mediaUrl.
    const payload = {
      content: caption,
      targetType: "profile",
      organizationId: null,
      mediaType,
      mediaUrl: mediaFile ? "" : preUploadedMediaUrl || mediaUrl || "",
      linkUrl: "",
    };
    if ((mediaType === "IMAGE" || mediaType === "VIDEO") && !mediaFile && (preUploadedMediaUrl || mediaUrl)) {
      throw new Error(
        "LinkedIn needs a direct file upload. Remove LinkedIn from multi-channel post, or post to LinkedIn from its channel page."
      );
    }
    const result = await postToLinkedIn(payload, mediaFile);
    return result?.message || "Published to LinkedIn.";
  }

  if (platformKey === "telegram") {
    const chatId = resolveTelegramChatId(account, draft);
    if (!chatId) throw new Error("Add a Telegram channel or group under Connect channels first.");
    let resolvedUrl = preUploadedMediaUrl || mediaUrl;
    let mediaType = "TEXT";
    if (draft.file || resolvedUrl) {
      if (!resolvedUrl && draft.file) resolvedUrl = await uploadSocialPublicMediaFile(draft.file);
      mediaType = (draft.file?.type || "").startsWith("video/") ? "VIDEO" : "IMAGE";
    }
    await postToTelegram({
      chatId,
      message: caption,
      mediaType,
      mediaUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(mediaType) ? resolvedUrl : "",
      linkUrl: linkUrl || "",
    });
    return "Published to Telegram.";
  }

  if (platformKey === "discord") {
    const target = resolveDiscordTarget(account, draft);
    if (!target?.channelId) throw new Error("Add a Discord channel target under Connect channels first.");
    let resolvedUrl = preUploadedMediaUrl || mediaUrl;
    let mediaType = "TEXT";
    if (draft.file || resolvedUrl) {
      if (!resolvedUrl && draft.file) resolvedUrl = await uploadSocialPublicMedia(draft.file);
      mediaType = (draft.file?.type || "").startsWith("video/") ? "EMBED" : "IMAGE";
    }
    await postToDiscord({
      guildId: target.guildId,
      channelId: target.channelId,
      message: caption,
      mediaType,
      mediaUrl: resolvedUrl || "",
      linkUrl: linkUrl || "",
    });
    return "Published to Discord.";
  }

  if (platformKey === "googleBusiness") {
    const loc = resolveGoogleBusinessLocation(account, draft);
    if (!loc) throw new Error("Connect a Google Business Profile location first.");
    let resolvedUrl = preUploadedMediaUrl || mediaUrl;
    if (!resolvedUrl && draft.file) resolvedUrl = await uploadSocialPublicMedia(draft.file);
    await postToGoogleBusiness({
      locationId: loc.locationId,
      accountId: loc.accountId,
      postType: "STANDARD",
      summary: caption,
      mediaUrl: resolvedUrl || undefined,
    });
    return "Published to Google Business Profile.";
  }

  if (platformKey === "youtube") {
    const channelId = resolveYouTubeChannelId(account, draft);
    const videoFile = draft.file;
    if (!videoFile) throw new Error("YouTube requires a video file.");
    await postYouTubeVideo({
      channelId: channelId || undefined,
      title: (draft.youtubeTitle || caption || "Untitled").slice(0, 100),
      description: caption,
      privacyStatus: draft.youtubePrivacy || "private",
      madeForKids: false,
      videoFile,
    });
    return "Uploaded to YouTube.";
  }

  throw new Error(`Publishing from the composer is not wired for ${platformKey} yet. Use the channel page.`);
}
