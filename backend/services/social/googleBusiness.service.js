import axios from "axios";
import { google } from "googleapis";
import { createOAuthService } from "./sharedOAuth.js";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const MYBUSINESS_V4 = "https://mybusiness.googleapis.com/v4";
const BUSINESS_ACCOUNT_MGMT_V1 = "https://mybusinessaccountmanagement.googleapis.com/v1";
/** Required on Business Information API v1 locations.list */
const BUSINESS_INFO_READ_MASK =
  "name,title,storefrontAddress,primaryPhone,websiteUri,primaryCategory,metadata,openInfo";
const BUSINESS_INFO_V1 = "https://mybusinessbusinessinformation.googleapis.com/v1";
/** Pause between per-account location list calls to avoid GBP API per-minute limits. */
const LOCATION_FETCH_DELAY_MS = 2000;
/** After a 429, block further GBP calls briefly so retries do not hammer the quota. */
const QUOTA_COOLDOWN_MS = 90_000;
let quotaCooldownUntil = 0;

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
  resolveRedirectUri: () => resolveProviderRedirectUri("googleBusiness"),
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
  const locations = await listBusinessLocationsForAccounts(accessToken, accounts);
  const entities = [];
  for (const loc of locations) {
    const account = accounts.find((a) => String(a.accountId) === String(loc.accountId));
    entities.push({
      entityType: "location",
      entityId: loc.locationId,
      name: loc.title || `Location ${loc.locationId}`,
      profileImage: "",
      googleBusinessAccountId: loc.accountId,
      googleBusinessAccountName:
        loc.accountName || account?.accountDisplayName || account?.accountName || "",
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
  return entities;
}

/** Fetch locations for each account with a short delay between accounts (GBP API rate limits). */
export async function listBusinessLocationsForAccounts(accessToken, accounts) {
  const rows = [];
  let index = 0;
  for (const account of accounts) {
    const accountId = String(account?.accountId || "").trim();
    if (!accountId) continue;
    if (index > 0) {
      await sleep(LOCATION_FETCH_DELAY_MS);
    }
    index += 1;
    const locs = await getBusinessLocations(accountId, accessToken, account);
    rows.push(...locs);
  }
  return rows;
}

function joinAddress(addr) {
  const lines = Array.isArray(addr?.addressLines) ? addr.addressLines.filter(Boolean) : [];
  const extras = [addr?.locality, addr?.administrativeArea, addr?.postalCode, addr?.regionCode].filter(Boolean);
  return [...lines, ...extras].join(", ");
}

function googleApiErrorMessage(response) {
  return response?.data?.error?.message || "Google Business Profile API request failed.";
}

function googleApiErrorReason(response) {
  return response?.data?.error?.errors?.[0]?.reason || response?.data?.error?.status || "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaExceeded(response) {
  const status = Number(response?.status || 0);
  const combined = `${googleApiErrorMessage(response)} ${googleApiErrorReason(response)}`.toLowerCase();
  return status === 429 || combined.includes("quota exceeded") || combined.includes("rate limit");
}

/** v4 is deprecated — only fall back when v1 is unavailable, not when rate-limited. */
function shouldTryLegacyV4Fallback(status) {
  const code = Number(status || 0);
  return [400, 404, 410, 501].includes(code);
}

function parseAccountsFromResponse(response) {
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

function assertNotInQuotaCooldown() {
  if (Date.now() < quotaCooldownUntil) {
    const waitSec = Math.ceil((quotaCooldownUntil - Date.now()) / 1000);
    const err = new Error(
      `Google Business Profile API rate limit active. Wait about ${waitSec} seconds before retrying.`
    );
    err.code = "google_business_quota_exceeded";
    err.status = 429;
    throw err;
  }
}

function markQuotaCooldown() {
  quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
}

async function googleBusinessGet(url, { headers, params, maxAttempts = 6 } = {}) {
  assertNotInQuotaCooldown();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await axios.get(url, { headers, params, validateStatus: () => true });
    if (!isQuotaExceeded(response)) {
      return response;
    }
    markQuotaCooldown();
    if (attempt >= maxAttempts) {
      return response;
    }
    const retryAfterSec = Number(response.headers?.["retry-after"] || 0);
    const waitMs =
      retryAfterSec > 0 ? retryAfterSec * 1000 : Math.min(3000 * 2 ** (attempt - 1), 45000);
    console.warn("[googleBusiness:rate-limit:retry]", { url, attempt, waitMs });
    await sleep(waitMs);
  }
  return axios.get(url, { headers, params, validateStatus: () => true });
}

/**
 * Load accounts (1 API call) then locations (1+ calls, throttled). Used after OAuth before selection UI.
 */
export async function discoverGoogleBusinessProfiles(accessToken, accounts = null) {
  const resolvedAccounts = accounts?.length ? accounts : await getBusinessAccounts(accessToken);
  if (!resolvedAccounts.length) {
    return { accounts: [], locations: [] };
  }
  const locations = await listBusinessLocationsForAccounts(accessToken, resolvedAccounts);
  return { accounts: resolvedAccounts, locations };
}

function classifyGoogleBusinessError(response, fallbackCode) {
  const message = googleApiErrorMessage(response);
  const reason = googleApiErrorReason(response);
  const status = Number(response?.status || 0);
  const combined = `${message} ${reason}`.toLowerCase();
  const apiDisabled =
    combined.includes("has not been used") ||
    combined.includes("is disabled") ||
    combined.includes("accessnotconfigured") ||
    reason === "accessNotConfigured";
  const err = new Error(message);
  err.status = status || 502;
  if (isQuotaExceeded(response)) {
    err.code = "google_business_quota_exceeded";
    return err;
  }
  if (apiDisabled) {
    err.code = "google_business_api_disabled";
    return err;
  }
  if (status === 403) {
    err.code = "google_business_scope_missing";
    return err;
  }
  err.code = fallbackCode;
  return err;
}

function logGoogleBusinessApiWarning(tag, response, extra = {}) {
  console.warn(tag, {
    ...extra,
    status: response?.status,
    message: googleApiErrorMessage(response),
    reason: googleApiErrorReason(response),
  });
}

export async function getBusinessAccounts(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  try {
    let response = await googleBusinessGet(`${BUSINESS_ACCOUNT_MGMT_V1}/accounts`, { headers });
    if (response.status >= 200 && response.status < 300) {
      return parseAccountsFromResponse(response);
    }
    if (isQuotaExceeded(response)) {
      logGoogleBusinessApiWarning("[googleBusiness:accounts:v1:quota]", response);
      throw classifyGoogleBusinessError(response, "google_business_accounts_failed");
    }
    if (shouldTryLegacyV4Fallback(response.status)) {
      logGoogleBusinessApiWarning("[googleBusiness:accounts:v1:fallback-v4]", response);
      response = await googleBusinessGet(`${MYBUSINESS_V4}/accounts`, { headers });
      if (response.status >= 200 && response.status < 300) {
        return parseAccountsFromResponse(response);
      }
    }
    logGoogleBusinessApiWarning("[googleBusiness:accounts:error]", response);
    throw classifyGoogleBusinessError(response, "google_business_accounts_failed");
  } catch (error) {
    if (error?.code) throw error;
    const err = new Error("Failed to fetch Google Business accounts.");
    err.code = "google_business_accounts_failed";
    err.status = error?.response?.status || 502;
    throw err;
  }
}

export async function getBusinessLocations(accountId, accessToken, accountInfo = {}) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const rows = [];
  let pageToken = "";
  for (;;) {
    const params = { ...(pageToken ? { pageToken } : {}), readMask: BUSINESS_INFO_READ_MASK };
    let response;
    try {
      const v1Url = `${BUSINESS_INFO_V1}/accounts/${encodeURIComponent(accountId)}/locations`;
      response = await googleBusinessGet(v1Url, { headers, params });
      if (response.status < 200 || response.status >= 300) {
        if (isQuotaExceeded(response)) {
          logGoogleBusinessApiWarning("[googleBusiness:locations:v1:quota]", response, { accountId });
          throw classifyGoogleBusinessError(response, "google_business_locations_failed");
        }
        if (shouldTryLegacyV4Fallback(response.status)) {
          logGoogleBusinessApiWarning("[googleBusiness:locations:v1:fallback-v4]", response, { accountId });
          const v4Params = pageToken ? { pageToken } : {};
          response = await googleBusinessGet(
            `${MYBUSINESS_V4}/accounts/${encodeURIComponent(accountId)}/locations`,
            { headers, params: v4Params }
          );
        }
        if (response.status < 200 || response.status >= 300) {
          logGoogleBusinessApiWarning("[googleBusiness:locations:error]", response, { accountId });
          throw classifyGoogleBusinessError(response, "google_business_locations_failed");
        }
      }
    } catch (error) {
      if (error?.code) throw error;
      const err = new Error("Failed to fetch Google Business locations.");
      err.code = "google_business_locations_failed";
      err.status = error?.response?.status || 502;
      throw err;
    }
    const locations = Array.isArray(response.data?.locations) ? response.data.locations : [];
    for (const loc of locations) {
      const resourceName = typeof loc?.name === "string" ? loc.name : "";
      const parts = resourceName.split("/locations/");
      const locationId =
        parts.length >= 2
          ? parts[parts.length - 1]
          : resourceName.startsWith("locations/")
            ? resourceName.replace(/^locations\//, "")
            : "";
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
