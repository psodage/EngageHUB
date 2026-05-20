import { ObjectId } from "mongodb";
import { getAppConfig } from "../config/social.config.js";
import { createOAuthState, validateOAuthState } from "../utils/oauthState.js";
import { getOAuthReturnPath, normalizeOAuthFlow } from "../utils/oauthReturnPath.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import githubService from "../services/social/github.service.js";
import {
  fetchGitHubRepos,
  getGitHubActivityFeed,
  getGitHubAnalytics,
  syncGitHubAccountMetadata,
} from "../services/social/githubApi.service.js";
import { listGitHubAutomationCapabilities, runGitHubAutomation } from "../services/social/githubAutomation.registry.js";
import { validateProviderConfig, getSafeProviderDebugInfo } from "../utils/providerConfig.util.js";
import { disconnectAccount, upsertConnectedAccount } from "../services/social/socialAccount.service.js";
import { recordSuccessfulPublish } from "../services/social/postHistory.service.js";

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
  if (callbackError?.code) return callbackError.code;
  if (normalized.includes("missing authorization code")) return "missing_code";
  if (normalized.includes("missing oauth state") || normalized.includes("invalid oauth state")) return "invalid_state";
  if (normalized.includes("rate limit")) return "github_rate_limited";
  if (normalized.includes("token")) return "token_error";
  return "oauth_callback_failed";
}

export async function connectGithub(req, res) {
  try {
    const flow = normalizeOAuthFlow(req.query?.flow);
    const providerConfig = validateProviderConfig("github");
    if (!providerConfig.valid) {
      return errorResponse(res, "GitHub OAuth config is missing required environment variables.", 400, providerConfig.missing);
    }

    const state = createOAuthState({ userId: req.auth.userId, platform: "github", flow });
    const authUrl = githubService.getAuthUrl(state);

    console.info("[oauth:github:connect:start]", {
      platform: "github",
      flow,
      userId: req.auth.userId,
      debug: getSafeProviderDebugInfo("github"),
    });

    return successResponse(res, { url: authUrl, state }, "GitHub OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:github:connect:error]", { userId: req.auth?.userId, message: error?.message });
    return errorResponse(res, error.message || "Unable to start GitHub OAuth flow.", error?.status || 400, error?.code || error.message);
  }
}

export async function githubOauthCallback(req, res) {
  const { code, state, error, error_description: errorDescription } = req.query;
  const clientBaseUrl = getClientUrl();
  const makeRedirectUrl = (flow, status, reason = "") => {
    const path = getOAuthReturnPath(flow);
    const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    return `${clientBaseUrl}${path}?social_platform=github&social_status=${status}${reasonParam}`;
  };

  let flowForRedirect = "settings";
  try {
    const decodedState = validateOAuthState(state, "github");
    const flow = normalizeOAuthFlow(decodedState?.flow);
    flowForRedirect = flow;

    if (error) {
      console.error("[oauth:github:callback:provider-error]", {
        userId: decodedState?.userId,
        providerError: error,
        providerErrorDescription: errorDescription,
      });
      return res.redirect(makeRedirectUrl(flow, "error", mapProviderErrorReason(error, errorDescription)));
    }

    if (!code) {
      const missing = new Error("Missing authorization code.");
      missing.code = "missing_code";
      throw missing;
    }

    const tokenData = await githubService.exchangeCodeForToken(code);
    if (!tokenData?.accessToken) {
      throw new Error("No access token received from GitHub.");
    }

    const profile = await githubService.getProfile(tokenData.accessToken);
    if (!profile?.platformUserId) {
      throw new Error("Unable to identify GitHub account from profile.");
    }

    await upsertConnectedAccount({
      userId: new ObjectId(decodedState.userId),
      platform: "github",
      profile,
      tokenData,
    });

    try {
      await syncGitHubAccountMetadata(new ObjectId(decodedState.userId));
    } catch (syncErr) {
      console.warn("[oauth:github:callback:sync-warn]", { message: syncErr?.message });
    }

    console.info("[oauth:github:callback:result]", {
      userId: decodedState.userId,
      status: "connected",
    });

    return res.redirect(makeRedirectUrl(flow, "connected"));
  } catch (callbackError) {
    console.error("[oauth:github:callback:error]", { message: callbackError?.message, code: callbackError?.code });
    return res.redirect(makeRedirectUrl(flowForRedirect, "error", mapCallbackReason(callbackError)));
  }
}

export async function disconnectGithub(req, res) {
  try {
    await githubService.disconnectAccount();
    const account = await disconnectAccount(new ObjectId(req.auth.userId), "github");
    return successResponse(res, { account }, "GitHub disconnected.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to disconnect GitHub.", 400, error.message);
  }
}

export async function listGithubRepos(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage, 10) || 30));
    const repos = await fetchGitHubRepos(new ObjectId(req.auth.userId), { page, perPage });
    return successResponse(res, { repos, page, perPage }, "GitHub repositories fetched.");
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to fetch repositories.", status, error.code || "github_repos_failed");
  }
}

export async function getGithubAnalytics(req, res) {
  try {
    const analytics = await getGitHubAnalytics(new ObjectId(req.auth.userId));
    return successResponse(res, analytics, "GitHub analytics fetched.");
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to fetch GitHub analytics.", status, error.code || "github_analytics_failed");
  }
}

export async function getGithubActivity(req, res) {
  try {
    const perPage = Math.min(100, parseInt(req.query.perPage, 10) || 30);
    const activity = await getGitHubActivityFeed(new ObjectId(req.auth.userId), { perPage });
    return successResponse(res, { activity }, "GitHub activity fetched.");
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to fetch GitHub activity.", status, error.code || "github_activity_failed");
  }
}

export async function syncGithub(req, res) {
  try {
    const data = await syncGitHubAccountMetadata(new ObjectId(req.auth.userId));
    return successResponse(res, data, "GitHub account synced.");
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to sync GitHub account.", status, error.code || "github_sync_failed");
  }
}

export async function createGithubActivityCard(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const { title, body, linkUrl, activityType, repoName } = req.body || {};
    const content = [title, body].filter(Boolean).join("\n\n").trim();
    if (!content) {
      return errorResponse(res, "Activity card requires a title or body.", 400, "validation_error");
    }

    const analytics = await getGitHubAnalytics(userId);
    const username = analytics?.profile?.username || "";

    const record = await recordSuccessfulPublish({
      userId,
      platform: "github",
      platformAccountId: username,
      platformAccountName: analytics?.profile?.accountName || username,
      targetType: "activity_card",
      targetId: activityType || "manual",
      targetName: repoName || "",
      content,
      mediaType: "LINK",
      linkUrl: linkUrl || analytics?.profile?.metadata?.profileUrl || "",
      externalPostUrl: linkUrl || "",
      apiSnapshot: { activityType, repoName },
    });

    return successResponse(
      res,
      { card: record, schedulingReady: true, automation: listGitHubAutomationCapabilities() },
      "GitHub activity card saved. Ready for cross-platform scheduling."
    );
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to create activity card.", status, error.code || "github_card_failed");
  }
}

export async function getGithubAutomationCatalog(req, res) {
  return successResponse(res, { automations: listGitHubAutomationCapabilities() }, "GitHub automation catalog.");
}

export async function previewGithubAutomation(req, res) {
  try {
    const type = (req.body?.type || "").toString();
    const result = await runGitHubAutomation(type, { userId: new ObjectId(req.auth.userId) });
    return successResponse(res, { preview: result }, "Automation preview.");
  } catch (error) {
    return errorResponse(res, error.message || "Automation preview failed.", 400, error.code);
  }
}
