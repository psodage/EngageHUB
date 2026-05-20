import axios from "axios";
import { createMetaOAuthService, INSTAGRAM_META_DISCOVERY_SCOPES } from "./meta.service.js";

const INSTAGRAM_GRAPH_BASE_URL = "https://graph.facebook.com";
const INSTAGRAM_GRAPH_API_VERSION = "v20.0";
const INSTAGRAM_DEFAULT_SCOPES = INSTAGRAM_META_DISCOVERY_SCOPES;

export const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;

const SUPPORTED_PUBLISH_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "REEL", "CAROUSEL"]);

function createInstagramError(message, code, status = 400, details = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function instagramVersionedRoot() {
  return `${INSTAGRAM_GRAPH_BASE_URL}/${INSTAGRAM_GRAPH_API_VERSION}`;
}

async function instagramGraphGet(path, accessToken, params = {}) {
  const relativePath = path.startsWith("/") ? path : `/${path}`;
  const url = `${instagramVersionedRoot()}${relativePath}`;
  try {
    const response = await axios.get(url, {
      params: { ...params, access_token: accessToken },
    });
    return response.data;
  } catch (error) {
    const msg =
      error?.response?.data?.error?.message ||
      error?.response?.data?.error_message ||
      error?.message ||
      "Instagram API request failed.";
    throw createInstagramError(msg, "instagram_graph_error", error?.response?.status || 500, error?.response?.data || null);
  }
}

async function instagramGraphPostJson(relativePath, accessToken, body) {
  const url = `${instagramVersionedRoot()}${relativePath}`;
  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    const msg =
      error?.response?.data?.error?.message ||
      error?.response?.data?.error_message ||
      error?.message ||
      "Instagram API request failed.";
    throw createInstagramError(msg, "instagram_graph_error", error?.response?.status || 500, error?.response?.data || null);
  }
}

async function getMediaContainerStatus(containerId, accessToken) {
  const url = `${instagramVersionedRoot()}/${containerId}`;
  const response = await axios.get(url, {
    params: { fields: "status_code", access_token: accessToken },
  });
  return response.data?.status_code || null;
}

async function waitForMediaContainerFinished(containerId, accessToken) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await getMediaContainerStatus(containerId, accessToken);
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw createInstagramError(
        `Instagram could not process this media (container status: ${status}).`,
        "instagram_container_failed",
        400,
        { status }
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw createInstagramError(
    "Timed out while Instagram was processing the video. Try again in a few minutes.",
    "instagram_media_timeout",
    504
  );
}

function isProbablyVideoUrl(url) {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url);
}

function buildCaptionPayload(caption) {
  const trimmed = (caption || "").trim();
  if (!trimmed) return {};
  if (trimmed.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
    throw createInstagramError(
      `Caption exceeds Instagram limit of ${INSTAGRAM_CAPTION_MAX_LENGTH} characters.`,
      "instagram_caption_too_long",
      400
    );
  }
  return { caption: trimmed };
}

/**
 * Creates a media container and publishes it for the given Instagram professional account
 * (Instagram API with Instagram Login — graph.instagram.com).
 */
export async function publishInstagramContent({
  accessToken,
  igUserId,
  mediaType,
  mediaUrl,
  mediaUrls,
  caption,
}) {
  if (!accessToken) {
    throw createInstagramError("Missing Instagram access token.", "instagram_token_missing", 401);
  }
  if (!igUserId) {
    throw createInstagramError("Missing Instagram user id.", "instagram_user_missing", 400);
  }
  const type = (mediaType || "").toString().trim().toUpperCase();
  if (!SUPPORTED_PUBLISH_MEDIA_TYPES.has(type)) {
    throw createInstagramError("Unsupported mediaType for Instagram publishing.", "instagram_invalid_media_type", 400);
  }

  const captionFields = buildCaptionPayload(caption);
  let creationId;

  if (type === "IMAGE") {
    if (!mediaUrl) throw createInstagramError("mediaUrl is required for IMAGE posts.", "instagram_media_required", 400);
    const body = { image_url: mediaUrl, ...captionFields };
    const created = await instagramGraphPostJson(`/${igUserId}/media`, accessToken, body);
    creationId = created?.id;
  } else if (type === "VIDEO" || type === "REEL") {
    if (!mediaUrl) throw createInstagramError("mediaUrl is required for video posts.", "instagram_media_required", 400);
    const body = {
      video_url: mediaUrl,
      media_type: type,
      ...captionFields,
    };
    const created = await instagramGraphPostJson(`/${igUserId}/media`, accessToken, body);
    creationId = created?.id;
    if (creationId) await waitForMediaContainerFinished(creationId, accessToken);
  } else if (type === "CAROUSEL") {
    const urls = Array.isArray(mediaUrls) ? mediaUrls : [];
    if (urls.length < 2 || urls.length > 10) {
      throw createInstagramError("Carousel posts require between 2 and 10 media URLs.", "instagram_carousel_count", 400);
    }
    const childIds = [];
    for (const url of urls) {
      const video = isProbablyVideoUrl(url);
      const childBody = video
        ? { video_url: url, media_type: "VIDEO", is_carousel_item: true }
        : { image_url: url, is_carousel_item: true };
      const child = await instagramGraphPostJson(`/${igUserId}/media`, accessToken, childBody);
      const childId = child?.id;
      if (!childId) throw createInstagramError("Failed to create carousel item container.", "instagram_carousel_item", 500);
      if (video) await waitForMediaContainerFinished(childId, accessToken);
      childIds.push(childId);
    }
    const carouselBody = {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      ...captionFields,
    };
    const created = await instagramGraphPostJson(`/${igUserId}/media`, accessToken, carouselBody);
    creationId = created?.id;
  }

  if (!creationId) {
    throw createInstagramError("Instagram did not return a media container id.", "instagram_no_container", 500);
  }

  const published = await instagramGraphPostJson(`/${igUserId}/media_publish`, accessToken, {
    creation_id: creationId,
  });
  const mediaId = published?.id || published?.media_id || published?.post_id || null;
  if (!mediaId) {
    throw createInstagramError("Instagram did not return a published media id.", "instagram_publish_failed", 500, published);
  }

  return { postId: String(mediaId), creationId, rawPublish: published };
}

const instagramService = {
  platform: "instagram",
  defaultScopes: INSTAGRAM_DEFAULT_SCOPES,
  ...createMetaOAuthService({
    platform: "instagram",
    profileFields: "id,name,email,picture",
    scopes: INSTAGRAM_DEFAULT_SCOPES,
  }),

  async getProfile(accessToken) {
    // Minimal fields for Instagram Login — extra fields can trigger (#100) errors if scopes/app config differ.
    const profile = await instagramGraphGet("/me", accessToken, {
      fields: "user_id,username,account_type",
    });
    const accountType = (profile?.account_type || "").toString().trim();
    if (accountType && /^personal$/i.test(accountType)) {
      throw createInstagramError(
        "Instagram account must be a Business or Creator profile.",
        "instagram_personal_account",
        400,
        { account_type: accountType }
      );
    }
    const igId =
      profile?.user_id?.toString() || profile?.id?.toString() || profile?.ig_id?.toString() || "";

    return {
      platformUserId: igId,
      accountName: profile?.username || "",
      username: profile?.username || "",
      email: "",
      profileImage: "",
      entityType: "professional",
      entityId: igId,
      capabilities: ["posting", "analytics"],
      metadata: {
        rawProfile: profile,
        accountType: profile?.account_type || "",
        mediaCount: profile?.media_count ?? null,
        instagramUserId: igId,
      },
    };
  },

};

export default instagramService;
