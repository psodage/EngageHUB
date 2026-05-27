import { ObjectId } from "mongodb";
import { getAppConfig } from "../config/social.config.js";
import { createOAuthState, validateOAuthState } from "../utils/oauthState.js";
import { getOAuthReturnPath, normalizeOAuthFlow } from "../utils/oauthReturnPath.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import threadsService, { THREADS_TEXT_MAX_LENGTH } from "../services/social/threads.service.js";
import { validateProviderConfig, getSafeProviderDebugInfo } from "../utils/providerConfig.util.js";
import { disconnectAccount, getStoredAccountForProvider, upsertConnectedAccount } from "../services/social/socialAccount.service.js";
import { recordSuccessfulPublish } from "../services/social/postHistory.service.js";
import { sanitizeAuthorizationCode } from "../utils/oauthCode.util.js";

const THREADS_SCOPE_SETS = {
  basic: ["threads_basic"],
  publish: ["threads_basic", "threads_content_publish"],
  insights: ["threads_basic", "threads_manage_insights"],
  replies: ["threads_basic", "threads_read_replies", "threads_manage_replies"],
};

function getClientUrl() {
  return getAppConfig().clientBaseUrl;
}

function mapProviderErrorReason(error, errorDescription = "") {
  const normalizedDescription = (errorDescription || "").toLowerCase();
  if (error === "access_denied") return "login_canceled";
  if (error === "invalid_scope") return "invalid_scope";
  if (normalizedDescription.includes("invalid scopes")) return "invalid_scope";
  return errorDescription || error || "oauth_error";
}

function mapCallbackReason(callbackError) {
  if (!callbackError?.message) return "oauth_callback_failed";
  const normalized = callbackError.message.toLowerCase();
  const detailsBlob = JSON.stringify(callbackError?.details || "").toLowerCase();
  if (
    normalized.includes("used_authorization_code") ||
    detailsBlob.includes("used_authorization_code") ||
    callbackError?.code === "threads_invalid_auth_code"
  ) {
    return "threads_invalid_auth_code";
  }
  if (callbackError?.code) return callbackError.code;
  if (normalized.includes("missing authorization code")) return "missing_code";
  if (normalized.includes("missing oauth state") || normalized.includes("invalid oauth state")) return "invalid_state";
  if (normalized.includes("redirect uri")) return "callback_mismatch";
  if (normalized.includes("token exchange")) return "token_error";
  if (normalized.includes("invalid scope")) return "invalid_scope";
  return "oauth_callback_failed";
}

function resolveRequestedThreadsScopes(req) {
  const scopeSetKey = (req.query?.scope_set || "").toString().trim().toLowerCase();
  if (scopeSetKey && THREADS_SCOPE_SETS[scopeSetKey]) {
    return { scopeSet: scopeSetKey, scopes: THREADS_SCOPE_SETS[scopeSetKey] };
  }

  const rawScopes = (req.query?.scopes || "").toString().trim();
  const scopes = rawScopes
    ? rawScopes
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : THREADS_SCOPE_SETS.publish;

  return { scopeSet: scopeSetKey || "publish", scopes };
}

export async function connectThreads(req, res) {
  try {
    const flow = normalizeOAuthFlow(req.query?.flow);
    const providerConfig = validateProviderConfig("threads");
    if (!providerConfig.valid) {
      return errorResponse(res, "threads OAuth config is missing required environment variables.", 400, providerConfig.missing);
    }

    const credentialCheck = await threadsService.verifyAppCredentials();
    if (!credentialCheck.valid) {
      console.error("[oauth:threads:connect:invalid-credentials]", {
        platform: "threads",
        userId: req.auth.userId,
        code: credentialCheck.code,
        graphMessage: credentialCheck.graphMessage,
      });
      return errorResponse(
        res,
        credentialCheck.message,
        400,
        credentialCheck.code || "threads_app_credentials_invalid"
      );
    }

    const state = createOAuthState({ userId: req.auth.userId, platform: "threads", flow });
    const { scopeSet, scopes } = resolveRequestedThreadsScopes(req);
    const authUrl = threadsService.getAuthUrl(state, scopes);

    console.info("[oauth:threads:connect:start]", {
      platform: "threads",
      flow,
      userId: req.auth.userId,
      threadsAppIdSuffix: process.env.THREADS_APP_ID ? `***${String(process.env.THREADS_APP_ID).slice(-6)}` : "missing",
      credentialCheckMethod: credentialCheck.method || "unknown",
      redirectUri: getAppConfig().threadsRedirectUri || "missing",
      authEndpoint: "https://threads.net/oauth/authorize",
      scopeSet,
      scopes,
      debug: getSafeProviderDebugInfo("threads"),
    });

    const redirectUri = getAppConfig().threadsRedirectUri || "";
    return successResponse(
      res,
      { url: authUrl, state, scopeSet, scopes, redirectUri },
      "Threads OAuth URL generated. Add redirectUri in Meta → Threads use case → Customize → Settings if connect fails."
    );
  } catch (error) {
    console.error("[oauth:threads:connect:error]", {
      platform: "threads",
      userId: req.auth?.userId,
      message: error?.message,
      code: error?.code,
    });
    return errorResponse(res, error.message || "Unable to start Threads OAuth flow.", error?.status || 400, error?.code || error.message);
  }
}

export async function threadsOauthCallback(req, res) {
  const { code, state, error, error_description: errorDescription } = req.query;
  const clientBaseUrl = getClientUrl();
  const makeRedirectUrl = (flow, status, reason = "", detail = "") => {
    const path = getOAuthReturnPath(flow);
    const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    const detailParam = detail ? `&oauth_detail=${encodeURIComponent(detail)}` : "";
    return `${clientBaseUrl}${path}?social_platform=threads&social_status=${status}${reasonParam}${detailParam}`;
  };

  let flowForRedirect = "settings";
  let decodedStateForFallback = null;
  try {
    const decodedState = validateOAuthState(state, "threads");
    decodedStateForFallback = decodedState;
    const flow = normalizeOAuthFlow(decodedState?.flow);
    flowForRedirect = flow;

    if (error) {
      console.error("[oauth:threads:callback:provider-error]", {
        platform: "threads",
        flow,
        userId: decodedState?.userId,
        providerError: error,
        providerErrorDescription: errorDescription,
      });
      return res.redirect(makeRedirectUrl(flow, "error", mapProviderErrorReason(error, errorDescription)));
    }

    if (!code) {
      const missing = new Error("Missing authorization code.");
      missing.code = "missing_code";
      missing.status = 400;
      throw missing;
    }

    const authCode = sanitizeAuthorizationCode(code);
    if (!authCode) {
      const missing = new Error("Missing authorization code.");
      missing.code = "missing_code";
      missing.status = 400;
      throw missing;
    }

    const tokenData = await threadsService.exchangeCodeForToken(authCode);
    if (!tokenData?.accessToken) {
      throw new Error("No access token received from Threads.");
    }

    const profile = await threadsService.getProfile(tokenData.accessToken);
    if (!profile?.platformUserId) {
      throw new Error("Unable to identify Threads account from profile.");
    }

    await upsertConnectedAccount({
      userId: new ObjectId(decodedState.userId),
      platform: "threads",
      profile,
      tokenData,
    });

    console.info("[oauth:threads:callback:result]", {
      platform: "threads",
      flow,
      userId: decodedState.userId,
      status: "connected",
    });

    return res.redirect(makeRedirectUrl(flow, "connected"));
  } catch (callbackError) {
    const callbackReason = mapCallbackReason(callbackError);
    if (callbackReason === "threads_invalid_auth_code" && decodedStateForFallback?.userId) {
      try {
        const existingAccount = await getStoredAccountForProvider(
          new ObjectId(decodedStateForFallback.userId),
          "threads"
        );
        if (existingAccount?.isConnected) {
          console.info("[oauth:threads:callback:already-connected]", {
            platform: "threads",
            flow: flowForRedirect,
            userId: decodedStateForFallback.userId,
          });
          return res.redirect(makeRedirectUrl(flowForRedirect, "connected"));
        }
      } catch (fallbackError) {
        console.warn("[oauth:threads:callback:fallback-check-failed]", {
          platform: "threads",
          flow: flowForRedirect,
          message: fallbackError?.message,
        });
      }
    }

    console.error("[oauth:threads:callback:error]", {
      platform: "threads",
      message: callbackError?.message,
      code: callbackError?.code,
      providerError: callbackError?.details || null,
    });
    const detail =
      callbackError?.message && typeof callbackError.message === "string" ? callbackError.message : "";
    return res.redirect(makeRedirectUrl(flowForRedirect, "error", callbackReason, detail));
  }
}

export async function disconnectThreads(req, res) {
  try {
    await threadsService.disconnectAccount();
    const account = await disconnectAccount(new ObjectId(req.auth.userId), "threads");
    return successResponse(res, { account }, "threads disconnected.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to disconnect threads.", 400, error?.code || error.message);
  }
}

const THREADS_POST_BODY_KEYS = new Set(["text", "mediaUrl", "mediaType", "imageUrl", "videoUrl"]);
const THREADS_MEDIA_TYPES = new Set(["TEXT", "IMAGE", "VIDEO"]);

function assertPublicHttpsMediaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const e = new Error("Invalid media URL.");
    e.status = 400;
    e.code = "invalid_media_url";
    throw e;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const e = new Error("Media URL must use http or https.");
    e.status = 400;
    e.code = "invalid_media_url";
    throw e;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local")) {
    const e = new Error(
      "Media URL must be publicly reachable on the internet. Localhost and local-only URLs cannot be fetched by Threads."
    );
    e.status = 400;
    e.code = "media_url_not_public";
    throw e;
  }
}

function parseThreadsPostPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const e = new Error("Invalid request body.");
    e.status = 400;
    e.code = "invalid_body";
    throw e;
  }
  for (const key of Object.keys(body)) {
    if (!THREADS_POST_BODY_KEYS.has(key)) {
      const e = new Error(`Unsupported field: ${key}`);
      e.status = 400;
      e.code = "unsupported_field";
      throw e;
    }
  }

  const mediaType = (body.mediaType ?? "").toString().trim().toUpperCase();
  if (!mediaType || !THREADS_MEDIA_TYPES.has(mediaType)) {
    const e = new Error("mediaType is required and must be TEXT, IMAGE, or VIDEO.");
    e.status = 400;
    e.code = "invalid_media_type";
    throw e;
  }

  const rawText = body.text !== undefined && body.text !== null ? String(body.text) : "";
  const text = rawText.trim();
  const rawMediaUrl = (body.mediaUrl ?? body.imageUrl ?? body.videoUrl ?? "").toString().trim();

  if (mediaType === "TEXT") {
    if (rawMediaUrl) {
      const e = new Error("Media URL must be empty when mediaType is TEXT.");
      e.status = 400;
      e.code = "validation_error";
      throw e;
    }
    if (!text.length) {
      const e = new Error("Text is required for a TEXT post.");
      e.status = 400;
      e.code = "validation_error";
      throw e;
    }
    if (text.length > THREADS_TEXT_MAX_LENGTH) {
      const e = new Error(`Text cannot exceed ${THREADS_TEXT_MAX_LENGTH} characters.`);
      e.status = 400;
      e.code = "validation_error";
      throw e;
    }
    return { mediaType: "TEXT", text, mediaUrl: "" };
  }

  if (!rawMediaUrl) {
    const e = new Error(`A public media URL is required when mediaType is ${mediaType}.`);
    e.status = 400;
    e.code = "validation_error";
    throw e;
  }
  assertPublicHttpsMediaUrl(rawMediaUrl);

  if (text.length > THREADS_TEXT_MAX_LENGTH) {
    const e = new Error(`Caption cannot exceed ${THREADS_TEXT_MAX_LENGTH} characters.`);
    e.status = 400;
    e.code = "validation_error";
    throw e;
  }

  return { mediaType, text, mediaUrl: rawMediaUrl };
}

const RECONNECT_MSG = "Threads account is not connected or token expired. Please reconnect your Threads account.";

export async function createThreadsPost(req, res) {
  let payload;
  try {
    payload = parseThreadsPostPayload(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);

  try {
    const account = await getStoredAccountForProvider(userId, "threads");
    if (!account || !account.isConnected) {
      return errorResponse(res, RECONNECT_MSG, 401, "not_connected");
    }

    const scopes = Array.isArray(account.scopes) ? account.scopes : [];
    if (!scopes.includes("threads_content_publish")) {
      return errorResponse(
        res,
        "Threads posting permission is missing. Reconnect your Threads account and approve content publishing (threads_content_publish).",
        403,
        "missing_publish_scope"
      );
    }

    let accessToken = typeof account.getDecryptedAccessToken === "function" ? account.getDecryptedAccessToken() : "";
    if (!accessToken) {
      return errorResponse(res, RECONNECT_MSG, 401, "no_token");
    }

    const tokenExpired = account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (tokenExpired) {
      return errorResponse(res, RECONNECT_MSG, 401, "token_expired");
    }

    const threadsUserId = (account.platformUserId || "").toString().trim();
    if (!threadsUserId) {
      return errorResponse(res, RECONNECT_MSG, 401, "missing_profile_id");
    }

    const { postId, published } = await threadsService.createAndPublishPost(threadsUserId, accessToken, payload);

    const safeData = {};
    if (published && typeof published === "object") {
      if (published.id !== undefined) safeData.publishedId = String(published.id);
    }

    const threadsUsername = (account.username || "").replace(/^@/, "");
    const externalPostUrl =
      threadsUsername && postId
        ? `https://www.threads.net/@${encodeURIComponent(threadsUsername)}/post/${encodeURIComponent(postId)}`
        : "";

    await recordSuccessfulPublish({
      userId,
      platform: "threads",
      platformAccountId: threadsUserId,
      platformAccountName: account.accountName || account.username || "",
      targetType: "profile",
      targetId: threadsUserId,
      targetName: account.username || account.accountName || threadsUserId,
      content: payload.text || "",
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl || "",
      linkUrl: "",
      externalPostId: String(postId || ""),
      externalPostUrl,
      apiSnapshot: safeData,
    });

    return successResponse(
      res,
      { postId, data: safeData },
      "Post published successfully on Threads"
    );
  } catch (error) {
    console.error("[threads:post:error]", {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });

    const status = error?.status >= 400 && error?.status < 600 ? error.status : 502;
    if (status === 401 || status === 403) {
      return errorResponse(res, RECONNECT_MSG, status, error?.code || "threads_auth_error");
    }

    const msg =
      error?.message && typeof error.message === "string"
        ? error.message
        : "Could not publish post on Threads.";
    return errorResponse(res, msg, status, error?.code || "threads_post_failed");
  }
}
