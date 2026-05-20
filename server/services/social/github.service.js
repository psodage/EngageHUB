import axios from "axios";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";

const DEFAULT_SCOPES = ["read:user", "user:email", "repo"];

function configuredScopes() {
  const raw = process.env.GITHUB_SCOPES;
  if (!raw) return DEFAULT_SCOPES;
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function maskClientId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Unknown request error",
    status: error?.response?.status || null,
    data: error?.response?.data || null,
    rateLimitRemaining: error?.response?.headers?.["x-ratelimit-remaining"] || null,
  };
}

function buildGitHubError(message, code, status = 400, details = null) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.details = details;
  return err;
}

function ensureGitHubConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = resolveProviderRedirectUri("github");
  if (!clientId || !clientSecret || !redirectUri) {
    throw buildGitHubError(
      "GitHub OAuth is not configured.",
      "github_config_missing",
      400,
      ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_REDIRECT_URI"]
    );
  }
  return { clientId, clientSecret, redirectUri };
}

function githubHeaders(accessToken, extra = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

function mapRateLimitError(error) {
  const status = error?.response?.status;
  if (status === 403 && error?.response?.headers?.["x-ratelimit-remaining"] === "0") {
    return buildGitHubError(
      "GitHub API rate limit exceeded. Try again after the limit resets.",
      "github_rate_limited",
      429,
      error?.response?.data
    );
  }
  if (status === 401) {
    return buildGitHubError(
      "GitHub access was revoked or expired. Reconnect your GitHub account.",
      "github_token_invalid",
      401,
      error?.response?.data
    );
  }
  return null;
}

const githubService = {
  platform: "github",

  validateConfig() {
    try {
      ensureGitHubConfig();
      return { valid: true, missing: [] };
    } catch (err) {
      return { valid: false, missing: err.details || [] };
    }
  },

  getAuthUrl(state, scopes = configuredScopes()) {
    const { clientId, redirectUri } = ensureGitHubConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      allow_signup: "true",
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCodeForToken(code) {
    const { clientId, clientSecret, redirectUri } = ensureGitHubConfig();
    try {
      const response = await axios.post(
        GITHUB_TOKEN_URL,
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );
      const data = response.data;
      if (!data?.access_token) {
        throw buildGitHubError("No access token received from GitHub.", "token_exchange_failed", 502, data);
      }
      return {
        accessToken: data.access_token,
        refreshToken: "",
        tokenType: data.token_type || "Bearer",
        expiresIn: null,
        scopes: typeof data.scope === "string" ? data.scope.split(/[,\s]+/).filter(Boolean) : configuredScopes(),
      };
    } catch (error) {
      if (error?.code) throw error;
      console.error("[github:token:error]", {
        clientId: maskClientId(clientId),
        error: summarizeAxiosError(error),
      });
      throw buildGitHubError("Token exchange failed for GitHub.", "token_exchange_failed", error?.response?.status || 502);
    }
  },

  async getProfile(accessToken) {
    let user;
    try {
      const response = await axios.get(`${GITHUB_API_BASE}/user`, {
        headers: githubHeaders(accessToken),
      });
      user = response.data;
    } catch (error) {
      const mapped = mapRateLimitError(error);
      if (mapped) throw mapped;
      console.error("[github:profile:error]", summarizeAxiosError(error));
      throw buildGitHubError("Profile fetch failed for GitHub.", "profile_fetch_failed", error?.response?.status || 502);
    }

    let email = user.email || "";
    if (!email) {
      try {
        const emailsRes = await axios.get(`${GITHUB_API_BASE}/user/emails`, {
          headers: githubHeaders(accessToken),
        });
        const emails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
        email = primary?.email || "";
      } catch {
        /* optional */
      }
    }

    const login = user.login || "";
    return {
      platformUserId: String(user.id),
      accountName: user.name || login,
      username: login,
      email,
      profileImage: user.avatar_url || "",
      entityType: "profile",
      entityId: String(user.id),
      metadata: {
        githubUserId: String(user.id),
        avatarUrl: user.avatar_url || "",
        profileUrl: user.html_url || (login ? `https://github.com/${login}` : ""),
        repositoriesCount: user.public_repos ?? 0,
        followers: user.followers ?? 0,
        following: user.following ?? 0,
        bio: user.bio || "",
        company: user.company || "",
        location: user.location || "",
        capabilities: ["analytics", "activity", "scheduling-ready"],
        automationReady: true,
      },
    };
  },

  async githubApiGet(accessToken, path, params = {}) {
    try {
      const response = await axios.get(`${GITHUB_API_BASE}${path}`, {
        headers: githubHeaders(accessToken),
        params,
      });
      return response.data;
    } catch (error) {
      const mapped = mapRateLimitError(error);
      if (mapped) throw mapped;
      if (error?.response?.status === 401) {
        throw buildGitHubError(
          "GitHub access was revoked or expired. Reconnect your GitHub account.",
          "github_token_invalid",
          401
        );
      }
      throw buildGitHubError(error?.response?.data?.message || error.message || "GitHub API request failed.", "github_api_error", error?.response?.status || 502);
    }
  },

  async disconnectAccount() {
    return { disconnected: true };
  },

  async refreshTokenIfNeeded() {
    return null;
  },
};

export default githubService;
