import axios from "axios";
import { google } from "googleapis";
import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const MYBUSINESS_V4 = "https://mybusiness.googleapis.com/v4";

function maskClientId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function createGbOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = resolveProviderRedirectUri("googleBusiness");
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Business OAuth is not configured.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

const baseGoogleBusinessService = createOAuthService({
  platform: "googleBusiness",
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: resolveProviderRedirectUri("googleBusiness"),
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  profileUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/business.manage",
  ],
  additionalAuthParams: {
    access_type: "offline",
    prompt: "consent",
  },
  mapProfile: (data, normalized) => ({
    ...normalized,
    platformUserId: data?.sub?.toString() || normalized.platformUserId,
    accountName: data?.name || normalized.accountName,
    username: data?.email || normalized.username,
    email: data?.email || normalized.email,
    profileImage: data?.picture || normalized.profileImage,
    metadata: {
      ...normalized.metadata,
      capabilities: ["posting", "analytics", "business-updates"],
    },
  }),
});

/**
 * List Business Profile locations for OAuth linking (Google My Business API v4).
 * @param {string} accessToken
 * @returns {Promise<object[]>}
 */
async function fetchManagedLocations(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const entities = [];

  let accountsResponse;
  try {
    accountsResponse = await axios.get(`${MYBUSINESS_V4}/accounts`, {
      headers,
      validateStatus: () => true,
    });
  } catch (error) {
    console.warn("[googleBusiness:accounts:error]", {
      message: error?.message,
      status: error?.response?.status,
    });
    return [];
  }

  if (accountsResponse.status < 200 || accountsResponse.status >= 300) {
    console.warn("[googleBusiness:accounts:failed]", {
      status: accountsResponse.status,
      data: accountsResponse.data,
    });
    return [];
  }

  const accounts = Array.isArray(accountsResponse.data?.accounts) ? accountsResponse.data.accounts : [];

  for (const acc of accounts) {
    const accountName = typeof acc?.name === "string" ? acc.name : "";
    if (!accountName.startsWith("accounts/")) continue;
    const accountId = accountName.replace(/^accounts\//, "");

    let pageToken = "";
    for (;;) {
      const params = pageToken ? { pageToken } : {};
      let locResponse;
      try {
        locResponse = await axios.get(`${MYBUSINESS_V4}/accounts/${encodeURIComponent(accountId)}/locations`, {
          headers,
          params,
          validateStatus: () => true,
        });
      } catch (error) {
        console.warn("[googleBusiness:locations:error]", {
          accountName,
          message: error?.message,
        });
        break;
      }

      if (locResponse.status < 200 || locResponse.status >= 300) {
        console.warn("[googleBusiness:locations:failed]", {
          accountName,
          status: locResponse.status,
          data: locResponse.data,
        });
        break;
      }

      const locations = Array.isArray(locResponse.data?.locations) ? locResponse.data.locations : [];
      for (const loc of locations) {
        const locName = typeof loc?.name === "string" ? loc.name : "";
        const parts = locName.split("/locations/");
        const locationId = parts.length >= 2 ? parts[parts.length - 1] : "";
        if (!locationId) continue;
        const title =
          loc.title ||
          loc.locationName ||
          loc.storefrontAddress?.addressLines?.[0] ||
          `Location ${locationId}`;

        entities.push({
          entityType: "location",
          entityId: locationId,
          name: title,
          profileImage: "",
          googleBusinessAccountId: accountId,
          googleBusinessLocationResourceName: locName,
        });
      }

      pageToken = typeof locResponse.data?.nextPageToken === "string" ? locResponse.data.nextPageToken : "";
      if (!pageToken) break;
    }
  }

  return entities;
}

const googleBusinessService = {
  ...baseGoogleBusinessService,
  async getManagedEntities(accessToken) {
    if (!accessToken) return [];
    try {
      const rows = await fetchManagedLocations(accessToken);
      return rows;
    } catch (error) {
      console.warn("[googleBusiness:getManagedEntities:error]", { message: error?.message });
      return [];
    }
  },
  async refreshTokenIfNeeded(account) {
    const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (!isExpired) {
      return null;
    }

    const refreshToken = account?.getDecryptedRefreshToken?.();
    if (!refreshToken) {
      const err = new Error("Google refresh token is unavailable. Please reconnect Google Business Profile.");
      err.code = "google_refresh_missing";
      throw err;
    }

    try {
      const oauth2Client = createGbOAuthClient();
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      const expiresIn = credentials.expiry_date
        ? Math.max(Math.floor((credentials.expiry_date - Date.now()) / 1000), 60)
        : credentials.expires_in || 3600;

      return {
        accessToken: credentials.access_token || "",
        refreshToken: credentials.refresh_token || "",
        tokenType: credentials.token_type || "Bearer",
        expiresIn,
      };
    } catch (error) {
      console.error("[googleBusiness:refresh:error]", {
        message: error?.message,
        clientId: maskClientId(process.env.GOOGLE_CLIENT_ID),
      });
      const err = new Error("Google Business Profile token refresh failed. Please reconnect your Google account.");
      err.code = "google_refresh_failed";
      throw err;
    }
  },
};

export default googleBusinessService;
