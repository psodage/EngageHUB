import axios from "axios";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_BASE_URL = "https://graph.instagram.com";
const INSTAGRAM_GRAPH_API_VERSION = "v20.0";
const INSTAGRAM_LONG_LIVED_TOKEN_URL = `${INSTAGRAM_GRAPH_BASE_URL}/access_token`;
const INSTAGRAM_REFRESH_TOKEN_URL = `${INSTAGRAM_GRAPH_BASE_URL}/refresh_access_token`;
const INSTAGRAM_LONG_LIVED_DEFAULT_SECONDS = 60 * 60 * 24 * 60;

const INSTAGRAM_DEFAULT_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;

const SUPPORTED_PUBLISH_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "REEL", "CAROUSEL"]);

function maskClientId(value) {
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

async function requestInstagramLongLivedToken(shortLivedToken) {
  const { clientSecret } = ensureInstagramConfig();
  const params = {
    grant_type: "ig_exchange_token",
    client_secret: clientSecret,
    access_token: shortLivedToken,
  };

  try {
    const response = await axios.get(INSTAGRAM_LONG_LIVED_TOKEN_URL, { params });
    return response.data || {};
  } catch (getError) {
    const methodNotAllowed =
      getError?.response?.status === 405 ||
      /method type:\s*get/i.test(String(getError?.response?.data?.error?.message || ""));
    if (!methodNotAllowed) throw getError;
    const response = await axios.post(
      INSTAGRAM_LONG_LIVED_TOKEN_URL,
      new URLSearchParams(params),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return response.data || {};
  }
}

function mapInstagramTokenPayload(data, scopes) {
  return {
    accessToken: data.access_token || "",
    refreshToken: "",
    tokenType: data.token_type || "Bearer",
    expiresIn: Number(data.expires_in) || INSTAGRAM_LONG_LIVED_DEFAULT_SECONDS,
    scopes,
  };
}

function ensureInstagramConfig() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  const redirectUri = resolveProviderRedirectUri("instagram");

  if (!clientId || !clientSecret || !redirectUri) {
    throw createInstagramError(
      "Instagram OAuth is not configured.",
      "instagram_config_missing",
      400,
      ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_REDIRECT_URI"]
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function normalizeScopes(scopes) {
  const requested = Array.isArray(scopes) ? scopes : [];
  const cleaned = requested.map((scope) => (scope || "").toString().trim()).filter(Boolean);
  return Array.from(new Set([...(cleaned.length ? cleaned : INSTAGRAM_DEFAULT_SCOPES)]));
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

  getAuthUrl(state, requestedScopes = null) {
    const { clientId, redirectUri } = ensureInstagramConfig();
    const scopes = normalizeScopes(requestedScopes || this.defaultScopes);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(","),
      state,
    });
    console.info("[oauth:instagram:auth-url]", {
      platform: "instagram",
      clientId: maskClientId(clientId),
      redirectUri,
      authEndpoint: INSTAGRAM_AUTH_URL,
      scopes,
    });
    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
  },

  getAdvancedAuthUrl(state, additionalScopes = []) {
    return this.getAuthUrl(state, additionalScopes);
  },

  async exchangeCodeForToken(code) {
    const { clientId, clientSecret, redirectUri } = ensureInstagramConfig();
    try {
      const response = await axios.post(
        INSTAGRAM_TOKEN_URL,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const data = response.data || {};
      const scopes = normalizeScopes(this.defaultScopes);
      const shortLived = mapInstagramTokenPayload(data, scopes);
      if (!shortLived.accessToken) {
        throw createInstagramError("Instagram did not return an access token.", "instagram_token_exchange_failed", 400);
      }

      try {
        const longLivedData = await requestInstagramLongLivedToken(shortLived.accessToken);
        const longLived = mapInstagramTokenPayload(longLivedData, scopes);
        if (longLived.accessToken) {
          console.info("[oauth:instagram:long-lived:success]", {
            expiresIn: longLived.expiresIn,
          });
          return longLived;
        }
      } catch (longLivedError) {
        console.warn("[oauth:instagram:long-lived:failed]", {
          message: longLivedError?.message,
          status: longLivedError?.response?.status,
        });
      }

      console.warn("[oauth:instagram:using-short-lived-token]");
      return shortLived;
    } catch (error) {
      throw createInstagramError(
        "Token exchange failed for Instagram.",
        "instagram_token_exchange_failed",
        error?.response?.status || 400,
        error?.response?.data || null
      );
    }
  },

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

  async refreshTokenIfNeeded(account) {
    const accessToken = account?.getDecryptedAccessToken?.();
    if (!accessToken) {
      return null;
    }

    const expiresMs = account?.expiresAt ? new Date(account.expiresAt).getTime() : 0;
    const now = Date.now();
    const isExpired = expiresMs > 0 && expiresMs <= now;
    const expiresWithinWeek = expiresMs > 0 && expiresMs - now < 7 * 24 * 60 * 60 * 1000;
    if (!isExpired && !expiresWithinWeek) return null;

    const scopes = Array.isArray(account.scopes) ? account.scopes : normalizeScopes(this.defaultScopes);

    try {
      const response = await axios.get(INSTAGRAM_REFRESH_TOKEN_URL, {
        params: {
          grant_type: "ig_refresh_token",
          access_token: accessToken,
        },
      });
      return mapInstagramTokenPayload(response.data || {}, scopes);
    } catch (refreshError) {
      if (!isExpired) {
        throw createInstagramError(
          "Instagram token refresh failed.",
          "instagram_token_refresh_failed",
          refreshError?.response?.status || 400,
          refreshError?.response?.data || null
        );
      }

      try {
        const longLivedData = await requestInstagramLongLivedToken(accessToken);
        const upgraded = mapInstagramTokenPayload(longLivedData, scopes);
        if (upgraded.accessToken) {
          console.info("[instagram:token:upgraded-short-to-long]");
          return upgraded;
        }
      } catch {
        /* fall through */
      }

      throw createInstagramError(
        "Instagram token refresh failed.",
        "instagram_token_refresh_failed",
        refreshError?.response?.status || 400,
        refreshError?.response?.data || null
      );
    }
  },

  async disconnectAccount() {
    return { disconnected: true };
  },
};

export default instagramService;
