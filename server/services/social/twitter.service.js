import axios from "axios";
import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const TWEETS_URL = "https://api.x.com/2/tweets";

const clientId = process.env.TWITTER_CLIENT_ID;
const clientSecret = process.env.TWITTER_CLIENT_SECRET;
const redirectUri = resolveProviderRedirectUri("x");
const tokenUrl = "https://api.x.com/2/oauth2/token";

const baseTwitterService = createOAuthService({
  platform: "x",
  clientId,
  clientSecret,
  redirectUri,
  authUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl,
  profileUrl: "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
  scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.data?.id?.toString() || normalized.platformUserId,
    accountName: data?.data?.name || normalized.accountName,
    username: data?.data?.username || normalized.username,
    profileImage: data?.data?.profile_image_url || normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "limited-api"],
    },
  }),
});

function summarizeAxiosError(error) {
  return {
    message: error?.message || "Unknown request error",
    status: error?.response?.status || null,
    data: error?.response?.data || null,
  };
}

async function exchangeRefreshToken(refreshToken) {
  if (!clientId || !clientSecret) {
    throw new Error("X OAuth is not configured.");
  }
  const response = await axios.post(
    tokenUrl,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    }
  );
  const data = response.data;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    tokenType: data.token_type || "Bearer",
    expiresIn: data.expires_in || 60 * 60 * 2,
    scopes: data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : [],
  };
}

const twitterService = {
  ...baseTwitterService,
  async refreshTokenIfNeeded(account) {
    const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (!isExpired) {
      return null;
    }

    const refreshToken = account.getDecryptedRefreshToken?.();
    if (!refreshToken) {
      const err = new Error("X account is not connected or token expired. Please reconnect your X account.");
      err.code = "x_token_missing";
      err.status = 401;
      throw err;
    }

    try {
      return await exchangeRefreshToken(refreshToken);
    } catch (error) {
      console.error("[x:token:refresh:error]", summarizeAxiosError(error));
      const err = new Error("X account is not connected or token expired. Please reconnect your X account.");
      err.code = "x_refresh_failed";
      err.status = 401;
      throw err;
    }
  },
  /**
   * @param {string} accessToken
   * @param {string} text trimmed post text
   * @returns {Promise<{ data?: { id?: string, text?: string } }>}
   */
  async createTweet(accessToken, text) {
    try {
      const response = await axios.post(TWEETS_URL, { text }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    } catch (error) {
      console.error("[x:tweet:create:error]", summarizeAxiosError(error));
      const status = error?.response?.status;
      const body = error?.response?.data;
      const detail =
        (typeof body?.detail === "string" && body.detail) ||
        (typeof body?.title === "string" && body.title) ||
        (Array.isArray(body?.errors) && body.errors[0]?.message) ||
        error?.message ||
        "Could not publish post on X.";
      const err = new Error(detail);
      err.status = status && status >= 400 && status < 600 ? status : 502;
      const detailLower = String(detail).toLowerCase();
      const likelyQuotaOrBilling =
        detailLower.includes("credit") ||
        detailLower.includes("billing") ||
        detailLower.includes("subscription") ||
        detailLower.includes("quota");
      err.code =
        (status === 401 || status === 403) && !likelyQuotaOrBilling ? "x_unauthorized" : "x_api_error";
      err.details = body;
      throw err;
    }
  },
};

export default twitterService;
