import axios from "axios";
import {
  normalizeOAuthRedirectUri,
  resolveProviderRedirectUri,
} from "../../utils/redirectUri.util.js";

const INSTAGRAM_AUTH_URL = "https://api.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_BASE_URL = "https://graph.instagram.com";
const INSTAGRAM_GRAPH_API_VERSION = "v21.0";

export const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;

const INSTAGRAM_DEFAULT_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

const SUPPORTED_PUBLISH_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "REEL", "CAROUSEL"]);

function maskAppId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function createInstagramError(message, code, status = 400, details = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function resolveInstagramRedirectUri(override) {
  return normalizeOAuthRedirectUri(override || resolveProviderRedirectUri("instagram"));
}

function ensureInstagramConfig(redirectUriOverride) {
  const appId = (process.env.INSTAGRAM_CLIENT_ID || "").trim();
  const appSecret = (process.env.INSTAGRAM_CLIENT_SECRET || "").trim();
  const redirectUri = resolveInstagramRedirectUri(redirectUriOverride);
  if (!appId || !appSecret || !redirectUri) {
    throw createInstagramError(
      "Instagram OAuth is not configured.",
      "instagram_config_missing",
      400,
      ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"]
    );
  }
  return { appId, appSecret, redirectUri };
}

function instagramVersionedRoot() {
  return `${INSTAGRAM_GRAPH_BASE_URL}/${INSTAGRAM_GRAPH_API_VERSION}`;
}

function parseInstagramTokenPayload(data) {
  if (Array.isArray(data?.data) && data.data[0]) {
    const row = data.data[0];
    const permissions = row.permissions;
    return {
      accessToken: row.access_token || "",
      platformUserId: row.user_id != null ? String(row.user_id) : "",
      scopes:
        typeof permissions === "string"
          ? permissions.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
          : [],
    };
  }
  return {
    accessToken: data?.access_token || "",
    platformUserId: data?.user_id != null ? String(data.user_id) : "",
    scopes: [],
  };
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
    if (creationId) await waitForMediaContainerFinished(creationId, accessToken);
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
    if (creationId) await waitForMediaContainerFinished(creationId, accessToken);
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

  validateConfig() {
    try {
      ensureInstagramConfig();
      return { valid: true, missing: [] };
    } catch (error) {
      return {
        valid: false,
        missing: error?.details || ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"],
      };
    }
  },

  getAuthUrl(input) {
    const state = typeof input === "string" ? input : input?.state;
    const redirectOverride = typeof input === "object" && input?.redirectUri ? input.redirectUri : "";
    const { appId, redirectUri } = ensureInstagramConfig(redirectOverride);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: INSTAGRAM_DEFAULT_SCOPES.join(","),
      state,
      enable_fb_login: "false",
    });
    console.info("[oauth:instagram:auth-url]", {
      platform: "instagram",
      appId: maskAppId(appId),
      redirectUri,
      authEndpoint: INSTAGRAM_AUTH_URL,
      scopeCount: INSTAGRAM_DEFAULT_SCOPES.length,
      scopes: INSTAGRAM_DEFAULT_SCOPES,
    });
    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
  },

  getAdvancedAuthUrl(input, additionalScopes = []) {
    const state = typeof input === "string" ? input : input?.state;
    const redirectOverride = typeof input === "object" && input?.redirectUri ? input.redirectUri : "";
    const { appId, redirectUri } = ensureInstagramConfig(redirectOverride);
    const mergedScopes = Array.from(new Set([...INSTAGRAM_DEFAULT_SCOPES, ...additionalScopes]));
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: mergedScopes.join(","),
      state,
      enable_fb_login: "false",
    });
    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
  },

  async exchangeShortLivedForLongLived(shortLivedToken) {
    const { appSecret } = ensureInstagramConfig();
    if (!shortLivedToken) {
      throw createInstagramError("Missing short-lived Instagram access token.", "instagram_token_missing", 400);
    }
    try {
      const response = await axios.get(`${INSTAGRAM_GRAPH_BASE_URL}/access_token`, {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: appSecret,
          access_token: shortLivedToken,
        },
      });
      const data = response.data || {};
      return {
        accessToken: data.access_token || shortLivedToken,
        tokenType: data.token_type || "Bearer",
        expiresIn: data.expires_in || 60 * 60 * 24 * 60,
      };
    } catch (error) {
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.error_message ||
        error?.message ||
        "Failed to exchange Instagram token for a long-lived token.";
      throw createInstagramError(msg, "instagram_long_lived_exchange_failed", error?.response?.status || 400, error?.response?.data);
    }
  },

  async exchangeCodeForToken(code, options = {}) {
    const redirectOverride = options?.redirectUri || "";
    const { appId, appSecret, redirectUri } = ensureInstagramConfig(redirectOverride);
    try {
      const response = await axios.post(
        INSTAGRAM_TOKEN_URL,
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const parsed = parseInstagramTokenPayload(response.data || {});
      let accessToken = parsed.accessToken;
      let expiresIn = 60 * 60;
      let tokenType = "Bearer";

      if (accessToken) {
        try {
          const longLived = await this.exchangeShortLivedForLongLived(accessToken);
          accessToken = longLived.accessToken || accessToken;
          expiresIn = longLived.expiresIn || expiresIn;
          tokenType = longLived.tokenType || tokenType;
        } catch (longLivedError) {
          console.warn("[oauth:instagram:long-lived:fallback]", {
            message: longLivedError?.message,
            code: longLivedError?.code,
          });
        }
      }

      return {
        accessToken,
        refreshToken: "",
        tokenType,
        expiresIn,
        platformUserId: parsed.platformUserId,
        scopes: parsed.scopes.length ? parsed.scopes : INSTAGRAM_DEFAULT_SCOPES,
      };
    } catch (error) {
      console.error("[oauth:instagram:token:error]", {
        platform: "instagram",
        appId: maskAppId(appId),
        redirectUri,
        error: error?.response?.data || error?.message,
      });
      const msg =
        error?.response?.data?.error_message ||
        error?.response?.data?.error?.message ||
        error?.message ||
        "Instagram token exchange failed.";
      throw createInstagramError(msg, "instagram_token_exchange_failed", error?.response?.status || 400, error?.response?.data);
    }
  },

  async getProfile(accessToken) {
    const profile = await instagramGraphGet("/me", accessToken, {
      fields: "user_id,username,account_type,profile_picture_url",
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
      profileImage: profile?.profile_picture_url || "",
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

  async refreshTokenIfNeeded(account) {
    const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (!isExpired) {
      return null;
    }

    const accessToken = account?.getDecryptedAccessToken?.();
    if (!accessToken) {
      throw createInstagramError("Instagram access token is unavailable.", "instagram_token_missing", 400);
    }

    try {
      const response = await axios.get(`${INSTAGRAM_GRAPH_BASE_URL}/refresh_access_token`, {
        params: {
          grant_type: "ig_refresh_token",
          access_token: accessToken,
        },
      });
      const data = response.data || {};
      return {
        accessToken: data.access_token || "",
        refreshToken: "",
        tokenType: data.token_type || "Bearer",
        expiresIn: data.expires_in || 60 * 60 * 24 * 60,
      };
    } catch (error) {
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.error_message ||
        error?.message ||
        "Instagram token refresh failed.";
      throw createInstagramError(msg, "instagram_token_refresh_failed", error?.response?.status || 400, error?.response?.data);
    }
  },

  async disconnectAccount() {
    return { disconnected: true };
  },
};

export default instagramService;
