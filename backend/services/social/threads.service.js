import axios from "axios";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const THREADS_API_VERSION = "v1.0";
const THREADS_AUTH_URL = "https://threads.net/oauth/authorize";
const THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const THREADS_GRAPH_BASE_URL = `https://graph.threads.net/${THREADS_API_VERSION}`;

const THREADS_ALLOWED_SCOPES = new Set([
  "threads_basic",
  "threads_content_publish",
  "threads_read_replies",
  "threads_manage_replies",
  "threads_manage_insights",
]);

function maskAppId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Unknown request error",
    status: error?.response?.status || null,
    statusText: error?.response?.statusText || null,
    data: error?.response?.data || null,
  };
}

function extractThreadsOAuthErrorMessage(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.error_message === "string" && data.error_message.trim()) {
    return data.error_message.trim();
  }
  const err = data.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    return err.error_user_msg || err.message || err.type || null;
  }
  return null;
}

/** Meta returns used_authorization_code when the OAuth code was already exchanged (refresh, double callback, etc.). */
function isUsedAuthorizationCodeError(message, data = null) {
  const reason = String(data?.error_reason || data?.error?.error_reason || "").toLowerCase();
  const haystack = `${String(message || "").toLowerCase()} ${reason}`;
  return (
    haystack.includes("used_authorization_code") ||
    (haystack.includes("authorization code") && /\bused\b/.test(haystack))
  );
}

function createThreadsError(message, code, status = 400, details = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function normalizeRequestedScopes(inputScopes) {
  const requested = Array.isArray(inputScopes) ? inputScopes : [];
  const cleaned = requested
    .map((scope) => (scope || "").toString().trim())
    .filter(Boolean)
    .filter((scope) => THREADS_ALLOWED_SCOPES.has(scope));

  // Threads docs require threads_basic for all Threads API calls.
  const merged = Array.from(new Set(["threads_basic", ...cleaned]));
  return merged;
}

function ensureThreadsConfig() {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = resolveProviderRedirectUri("threads");
  if (!appId || !appSecret || !redirectUri) {
    throw createThreadsError(
      "Threads OAuth is not configured.",
      "threads_config_missing",
      400,
      ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI"]
    );
  }
  return { appId: appId.trim(), appSecret: appSecret.trim(), redirectUri };
}

/** Facebook Graph app lookup — works for some combined Meta apps, not Threads-only apps. */
async function verifyThreadsAppViaFacebookGraph(appId, appSecret) {
  const token = `${appId}|${appSecret}`;
  try {
    const response = await axios.get(`https://graph.facebook.com/v20.0/${encodeURIComponent(appId)}`, {
      params: { fields: "id,name", access_token: token },
      timeout: 12000,
    });
    return {
      valid: true,
      appName: response.data?.name || "",
      appId: response.data?.id?.toString() || appId,
      method: "facebook_graph",
    };
  } catch (error) {
    const graphMessage = error?.response?.data?.error?.message || error?.message || "Unknown error";
    return { valid: false, graphMessage, method: "facebook_graph" };
  }
}

/**
 * Probes Threads OAuth token endpoint with a dummy code.
 * Valid app id + secret return "Invalid verification code"; invalid client_id is rejected outright.
 */
async function verifyThreadsAppViaOAuthProbe(appId, appSecret, redirectUri) {
  try {
    await axios.post(
      THREADS_TOKEN_URL,
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: "__engagehub_credential_probe__",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 12000 }
    );
    return { valid: true, appName: "Threads app", appId, method: "threads_oauth_probe" };
  } catch (error) {
    const data = error?.response?.data || null;
    const message =
      extractThreadsOAuthErrorMessage(data) ||
      extractThreadsGraphErrorMessage(data) ||
      error?.message ||
      "Unknown error";
    const normalized = message.toLowerCase();

    if (normalized.includes("invalid client_id") || normalized.includes("invalid client secret")) {
      return { valid: false, graphMessage: message, method: "threads_oauth_probe" };
    }

    // Expected for a deliberate bad code — app id + secret were accepted.
    if (
      normalized.includes("invalid verification code") ||
      normalized.includes("matching code was not found") ||
      normalized.includes("authorization code")
    ) {
      return { valid: true, appName: "Threads app", appId, method: "threads_oauth_probe" };
    }

    if (normalized.includes("redirect_uri") || normalized.includes("redirect uri")) {
      return {
        valid: false,
        graphMessage: `${message} (check THREADS_REDIRECT_URI matches Meta OAuth redirect URLs exactly)`,
        method: "threads_oauth_probe",
      };
    }

    return { valid: false, graphMessage: message, method: "threads_oauth_probe" };
  }
}

async function verifyThreadsAppCredentials(appId, appSecret, redirectUri) {
  const facebook = await verifyThreadsAppViaFacebookGraph(appId, appSecret);
  if (facebook.valid) return facebook;

  const threads = await verifyThreadsAppViaOAuthProbe(appId, appSecret, redirectUri);
  if (threads.valid) return threads;

  return {
    valid: false,
    graphMessage: threads.graphMessage || facebook.graphMessage || "Credential validation failed.",
    method: threads.method || facebook.method,
  };
}

export const THREADS_TEXT_MAX_LENGTH = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractThreadsGraphErrorMessage(data) {
  const err = data?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    return err.message || err.error_user_msg || err.error_user_title || err.type || "Threads API error.";
  }
  return null;
}

async function threadsGraphGet(path, accessToken, params = {}) {
  try {
    const response = await axios.get(`${THREADS_GRAPH_BASE_URL}${path}`, {
      params: { ...params, access_token: accessToken },
    });
    return response.data;
  } catch (error) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data || null;
    const message =
      extractThreadsGraphErrorMessage(data) ||
      extractThreadsOAuthErrorMessage(data) ||
      error?.message ||
      "Threads API request failed.";
    throw createThreadsError(message, "threads_graph_error", status, data);
  }
}

async function threadsGraphFormPost(path, accessToken, fields) {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    const str = String(value);
    if (str === "") continue;
    params.set(key, str);
  }
  try {
    const response = await axios.post(`${THREADS_GRAPH_BASE_URL}${path}`, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  } catch (error) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data;
    const message = extractThreadsGraphErrorMessage(data) || error?.message || "Threads API request failed.";
    throw createThreadsError(message, "threads_graph_error", status, data);
  }
}

const threadsService = {
  platform: "threads",
  defaultScopes: ["threads_basic", "threads_content_publish"],
  allowedScopes: Array.from(THREADS_ALLOWED_SCOPES),

  validateConfig() {
    try {
      ensureThreadsConfig();
      return { valid: true, missing: [] };
    } catch (error) {
      return { valid: false, missing: error?.details || ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI"] };
    }
  },

  /**
   * Validates that THREADS_APP_ID and THREADS_APP_SECRET are a matching pair for one Meta app.
   * When invalid, OAuth may still open but token/profile calls fail with threads_graph_error.
   */
  async verifyAppCredentials() {
    const { appId, appSecret, redirectUri } = ensureThreadsConfig();

    const threadsCheck = await verifyThreadsAppCredentials(appId, appSecret, redirectUri);
    if (threadsCheck.valid) {
      return {
        valid: true,
        appName: threadsCheck.appName,
        appId: threadsCheck.appId,
        method: threadsCheck.method,
      };
    }

    const message =
      `THREADS_APP_ID and THREADS_APP_SECRET could not be verified (${threadsCheck.graphMessage || "validation failed"}). ` +
      "Copy Threads App ID and Threads App secret from your Threads Meta app → App settings → Basic, then update THREADS_APP_ID, THREADS_APP_SECRET, and THREADS_REDIRECT_URI on Render (required for production) and in .env. " +
      "If you use a separate Threads-only app, that is fine — it does not need to match META_APP_ID.";

    return {
      valid: false,
      code: "threads_app_credentials_invalid",
      message,
      graphMessage: threadsCheck.graphMessage,
    };
  },

  getAuthUrl(state, requestedScopes = null) {
    const { appId, redirectUri } = ensureThreadsConfig();
    const scopes = normalizeRequestedScopes(requestedScopes || this.defaultScopes);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(","),
      state,
    });
    console.info("[oauth:threads:auth-url]", {
      platform: "threads",
      appId: maskAppId(appId),
      redirectUri,
      authEndpoint: THREADS_AUTH_URL,
      scopeCount: scopes.length,
      scopes,
    });
    return `${THREADS_AUTH_URL}?${params.toString()}`;
  },

  getAdvancedAuthUrl(state, additionalScopes = []) {
    const scopes = normalizeRequestedScopes(additionalScopes);
    return this.getAuthUrl(state, scopes);
  },

  async exchangeShortLivedForLongLived(shortLivedToken) {
    const { appSecret } = ensureThreadsConfig();
    if (!shortLivedToken) {
      throw createThreadsError("Missing short-lived Threads access token.", "threads_token_missing", 400);
    }
    try {
      const response = await axios.get("https://graph.threads.net/access_token", {
        params: {
          grant_type: "th_exchange_token",
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
      console.error("[oauth:threads:long-lived:error]", {
        platform: "threads",
        error: summarizeAxiosError(error),
      });
      const responseData = error?.response?.data || null;
      const providerMessage = extractThreadsOAuthErrorMessage(responseData) || extractThreadsGraphErrorMessage(responseData);
      throw createThreadsError(
        providerMessage || "Failed to exchange Threads token for a long-lived token.",
        "threads_long_lived_exchange_failed",
        error?.response?.status || 400,
        responseData
      );
    }
  },

  async exchangeCodeForToken(code) {
    const { appId, appSecret, redirectUri } = ensureThreadsConfig();
    try {
      const response = await axios.post(
        THREADS_TOKEN_URL,
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const data = response.data || {};
      const shortLivedToken = data.access_token || "";
      let accessToken = shortLivedToken;
      let expiresIn = data.expires_in || 60 * 60;
      let tokenType = data.token_type || "Bearer";

      if (shortLivedToken) {
        try {
          const longLived = await this.exchangeShortLivedForLongLived(shortLivedToken);
          accessToken = longLived.accessToken || shortLivedToken;
          expiresIn = longLived.expiresIn || expiresIn;
          tokenType = longLived.tokenType || tokenType;
        } catch (longLivedError) {
          console.warn("[oauth:threads:long-lived:fallback]", {
            platform: "threads",
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
        platformUserId: data.user_id ? String(data.user_id) : "",
        scopes: Array.isArray(data?.scope) ? data.scope : data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : this.defaultScopes,
      };
    } catch (error) {
      console.error("[oauth:threads:token:error]", {
        platform: "threads",
        tokenEndpoint: THREADS_TOKEN_URL,
        redirectUri,
        appId: maskAppId(appId),
        error: summarizeAxiosError(error),
      });
      const responseData = error?.response?.data || null;
      const providerError = responseData?.error || responseData || null;
      const providerMessage = extractThreadsOAuthErrorMessage(responseData);
      const normalizedMessage = (providerMessage || "").toLowerCase();
      let code = "threads_token_exchange_failed";
      if (isUsedAuthorizationCodeError(providerMessage, responseData)) {
        code = "threads_invalid_auth_code";
      } else if (normalizedMessage.includes("redirect_uri") || normalizedMessage.includes("redirect uri")) {
        code = "threads_redirect_uri_mismatch";
      } else if (normalizedMessage.includes("invalid verification code") || normalizedMessage.includes("authorization code")) {
        code = "threads_invalid_auth_code";
      } else if (normalizedMessage.includes("client") || normalizedMessage.includes("app secret")) {
        code = "threads_invalid_client";
      }
      throw createThreadsError(
        providerMessage || "Token exchange failed for Threads.",
        code,
        error?.response?.status || 400,
        providerError
      );
    }
  },

  async getProfile(accessToken) {
    const fields = [
      "id",
      "username",
      "name",
      "threads_profile_picture_url",
      "threads_biography",
      "is_verified",
    ].join(",");
    const profile = await threadsGraphGet("/me", accessToken, { fields });
    return {
      platformUserId: profile?.id?.toString() || "",
      accountName: profile?.name || profile?.username || "",
      username: profile?.username || "",
      email: "",
      profileImage: profile?.threads_profile_picture_url || "",
      entityType: "profile",
      entityId: profile?.id?.toString() || "",
      capabilities: ["posting", "analytics"],
      metadata: {
        rawProfile: profile,
        threadsBiography: profile?.threads_biography || "",
        isVerified: Boolean(profile?.is_verified),
      },
    };
  },

  async refreshTokenIfNeeded(accessToken) {
    if (!accessToken) return null;
    try {
      const response = await axios.get("https://graph.threads.net/refresh_access_token", {
        params: {
          grant_type: "th_refresh_token",
          access_token: accessToken,
        },
      });
      const data = response.data || {};
      if (!data.access_token) return null;
      return {
        accessToken: data.access_token,
        tokenType: data.token_type || "Bearer",
        expiresIn: data.expires_in || 60 * 60 * 24 * 60,
      };
    } catch (error) {
      console.warn("[oauth:threads:refresh:error]", {
        platform: "threads",
        error: summarizeAxiosError(error),
      });
      return null;
    }
  },

  async disconnectAccount() {
    return { disconnected: true };
  },

  /**
   * Step 1: Create a Threads media/text container (form-encoded per Threads Graph API).
   * @param {string} threadsUserId
   * @param {string} accessToken
   * @param {{ mediaType: 'TEXT' | 'IMAGE' | 'VIDEO', text: string, mediaUrl: string }} payload
   */
  async createPostContainer(threadsUserId, accessToken, payload) {
    const { mediaType, text, mediaUrl } = payload;
    const path = `/${threadsUserId}/threads`;
    const fields = { media_type: mediaType };
    if (mediaType === "TEXT") {
      fields.text = text;
    } else if (mediaType === "IMAGE") {
      fields.image_url = mediaUrl;
      if (text) fields.text = text;
    } else if (mediaType === "VIDEO") {
      fields.video_url = mediaUrl;
      if (text) fields.text = text;
    }
    return threadsGraphFormPost(path, accessToken, fields);
  },

  async publishPostContainer(threadsUserId, accessToken, creationId) {
    const path = `/${threadsUserId}/threads_publish`;
    return threadsGraphFormPost(path, accessToken, { creation_id: creationId });
  },

  /**
   * Create container, optionally wait for media processing, then publish.
   */
  async createAndPublishPost(threadsUserId, accessToken, payload) {
    const container = await this.createPostContainer(threadsUserId, accessToken, payload);
    const creationId = container?.id ? String(container.id) : "";
    if (!creationId) {
      const err = new Error("Threads did not return a container id. Check media URL and permissions.");
      err.code = "threads_no_container_id";
      err.status = 502;
      throw err;
    }
    if (payload.mediaType === "IMAGE" || payload.mediaType === "VIDEO") {
      await delay(3000);
    }
    const published = await this.publishPostContainer(threadsUserId, accessToken, creationId);
    const postId = published?.id ? String(published.id) : creationId;
    return { postId, container, published };
  },
};

export default threadsService;
