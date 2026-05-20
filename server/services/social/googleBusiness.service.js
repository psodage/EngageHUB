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
  const accounts = await getBusinessAccounts(accessToken);
  const entities = [];
  for (const account of accounts) {
    const accountId = String(account?.accountId || "").trim();
    if (!accountId) continue;
    const locations = await getBusinessLocations(accountId, accessToken, {
      accountName: account.accountName,
      accountDisplayName: account.accountDisplayName,
    });
    for (const loc of locations) {
      entities.push({
        entityType: "location",
        entityId: loc.locationId,
        name: loc.title || `Location ${loc.locationId}`,
        profileImage: "",
        googleBusinessAccountId: loc.accountId,
        googleBusinessAccountName: loc.accountName,
        googleBusinessLocationResourceName: loc.resourceName || "",
        metadata: {
          address: loc.address || "",
          phone: loc.phone || "",
          website: loc.website || "",
          primaryCategory: loc.primaryCategory || "",
          verificationStatus: loc.verificationStatus || "",
          storefrontUrl: loc.storefrontUrl || "",
        },
      });
    }
  }
  return entities;
}

function joinAddress(addr) {
  const lines = Array.isArray(addr?.addressLines) ? addr.addressLines.filter(Boolean) : [];
  const extras = [addr?.locality, addr?.administrativeArea, addr?.postalCode, addr?.regionCode].filter(Boolean);
  return [...lines, ...extras].join(", ");
}

export async function getBusinessAccounts(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  let response;
  try {
    response = await axios.get(`${MYBUSINESS_V4}/accounts`, { headers, validateStatus: () => true });
  } catch (error) {
    const err = new Error("Failed to fetch Google Business accounts.");
    err.code = "google_business_accounts_failed";
    err.status = error?.response?.status || 502;
    throw err;
  }
  if (response.status < 200 || response.status >= 300) {
    const message = response?.data?.error?.message || "Failed to fetch Google Business accounts.";
    const err = new Error(message);
    err.code = response.status === 403 ? "google_business_scope_missing" : "google_business_accounts_failed";
    err.status = response.status || 502;
    throw err;
  }
  const accounts = Array.isArray(response.data?.accounts) ? response.data.accounts : [];
  return accounts
    .map((acc) => {
      const accountName = typeof acc?.name === "string" ? acc.name : "";
      const accountId = accountName.startsWith("accounts/") ? accountName.replace(/^accounts\//, "") : "";
      if (!accountId) return null;
      return {
        accountName,
        accountId,
        type: acc?.type || "",
        accountDisplayName: acc?.accountName || acc?.name || `Account ${accountId}`,
      };
    })
    .filter(Boolean);
}

export async function getBusinessLocations(accountId, accessToken, accountInfo = {}) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const rows = [];
  let pageToken = "";
  for (;;) {
    const params = pageToken ? { pageToken } : {};
    let response;
    try {
      response = await axios.get(`${MYBUSINESS_V4}/accounts/${encodeURIComponent(accountId)}/locations`, {
        headers,
        params,
        validateStatus: () => true,
      });
    } catch (error) {
      const err = new Error("Failed to fetch Google Business locations.");
      err.code = "google_business_locations_failed";
      err.status = error?.response?.status || 502;
      throw err;
    }
    if (response.status < 200 || response.status >= 300) {
      const message = response?.data?.error?.message || "Failed to fetch Google Business locations.";
      const err = new Error(message);
      err.code = response.status === 403 ? "google_business_scope_missing" : "google_business_locations_failed";
      err.status = response.status || 502;
      throw err;
    }
    const locations = Array.isArray(response.data?.locations) ? response.data.locations : [];
    for (const loc of locations) {
      const resourceName = typeof loc?.name === "string" ? loc.name : "";
      const parts = resourceName.split("/locations/");
      const locationId = parts.length >= 2 ? parts[parts.length - 1] : "";
      if (!locationId) continue;
      rows.push({
        locationId,
        resourceName,
        title: loc?.title || loc?.locationName || "",
        address: joinAddress(loc?.storefrontAddress || loc?.address || {}),
        phone: loc?.primaryPhone || "",
        website: loc?.websiteUri || "",
        primaryCategory: loc?.primaryCategory?.displayName || loc?.primaryCategory?.categoryId || "",
        verificationStatus: loc?.metadata?.verification?.verificationState || loc?.openInfo?.status || "",
        storefrontUrl: loc?.metadata?.mapsUri || loc?.websiteUri || "",
        accountId: String(accountId),
        accountName: accountInfo.accountDisplayName || accountInfo.accountName || `Account ${accountId}`,
      });
    }
    pageToken = typeof response.data?.nextPageToken === "string" ? response.data.nextPageToken : "";
    if (!pageToken) break;
  }
  return rows;
}

export function getGoogleBusinessLocationName(account) {
  if (!account || typeof account !== "object") return "";
  return (
    account?.accountName ||
    account?.metadata?.locationTitle ||
    account?.metadata?.managedEntity?.name ||
    account?.metadata?.managedEntity?.title ||
    ""
  );
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
