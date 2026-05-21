import axios from "axios";
import SocialAccount from "../../models/SocialAccount.js";
import { decryptToken, encryptToken } from "../../utils/crypto.js";
import { getFacebookAccountForPublish } from "./socialAccount.service.js";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v20.0";

export function isMetaTokenAuthError(apiError) {
  if (isMetaPermissionOrCapabilityError(apiError)) return false;
  const code = apiError?.details?.error?.code;
  const sub = apiError?.details?.error?.error_subcode;
  return (
    apiError?.status === 401 ||
    code === 190 ||
    code === 102 ||
    sub === 463 ||
    sub === 467
  );
}

/** Permission / capability errors (often 403) — not fixed by reconnecting. */
export function isMetaPermissionOrCapabilityError(apiError) {
  const code = apiError?.details?.error?.code;
  const sub = apiError?.details?.error?.error_subcode;
  const msg = String(
    apiError?.details?.error?.error_user_msg || apiError?.details?.error?.message || apiError?.message || ""
  ).toLowerCase();
  if (code === 10 || code === 200 || code === 294) return true;
  if (sub === 1366051 || sub === 1366046) return true;
  if (msg.includes("permission") || msg.includes("publish") || msg.includes("capability")) return true;
  if (msg.includes("used in an ad") || msg.includes("does not have")) return true;
  return false;
}

export async function getFacebookProfileAccountDoc(userId) {
  const profile = await SocialAccount.findOne({
    userId,
    platform: "facebook",
    entityType: "profile",
    isConnected: true,
  });
  if (profile) return profile;

  const primary = await SocialAccount.findOne({
    userId,
    platform: "facebook",
    isPrimary: true,
    isConnected: true,
    entityType: { $ne: "page" },
  });
  if (primary) return primary;

  return SocialAccount.findOne({
    userId,
    platform: "facebook",
    isConnected: true,
    entityType: { $nin: ["page"] },
  });
}

/**
 * @param {string} userAccessToken
 * @param {string} pageId
 */
export async function fetchPageAccessTokenFromGraph(userAccessToken, pageId) {
  const { data } = await axios.get(`${META_GRAPH_BASE_URL}/${encodeURIComponent(pageId)}`, {
    params: { fields: "access_token", access_token: userAccessToken },
  });
  return data?.access_token ? String(data.access_token) : "";
}

/**
 * @param {string} userAccessToken
 * @returns {Promise<Record<string, string>>}
 */
export async function listPageAccessTokensFromGraph(userAccessToken) {
  const { data } = await axios.get(`${META_GRAPH_BASE_URL}/me/accounts`, {
    params: {
      fields: "id,access_token",
      access_token: userAccessToken,
      limit: 100,
    },
  });
  const rows = Array.isArray(data?.data) ? data.data : [];
  /** @type {Record<string, string>} */
  const out = {};
  for (const row of rows) {
    const id = row?.id != null ? String(row.id).trim() : "";
    const token = row?.access_token ? String(row.access_token) : "";
    if (id && token) out[id] = token;
  }
  return out;
}

/**
 * @param {import("mongodb").ObjectId} userId
 * @param {string} pageId
 * @param {string} pageAccessToken
 */
export async function persistPagePublishingToken(userId, pageId, pageAccessToken) {
  const pid = String(pageId || "").trim();
  const token = String(pageAccessToken || "").trim();
  if (!pid || !token) return;

  const enc = encryptToken(token);
  if (!enc) return;

  const profileAccount = await getFacebookProfileAccountDoc(userId);
  if (!profileAccount) return;

  const map =
    profileAccount.pagePublishingTokens && typeof profileAccount.pagePublishingTokens === "object"
      ? { ...profileAccount.pagePublishingTokens }
      : {};
  map[pid] = enc;
  profileAccount.pagePublishingTokens = map;
  await profileAccount.save();
}

/**
 * @param {import("mongodb").ObjectId} userId
 * @param {string | null | undefined} entityId
 * @param {"page" | ""} [entityTypeHint]
 */
export async function resolveFacebookPublishCredentials(userId, entityId, entityTypeHint = "") {
  const account = await getFacebookAccountForPublish(userId, entityId, entityTypeHint);
  if (!account || !account.isConnected) {
    return { ok: false, code: "not_connected", account: null };
  }

  const entityType = String(entityTypeHint || account.entityType || "page").trim().toLowerCase();
  if (entityType === "profile") {
    return { ok: false, code: "profile_not_supported", account: null };
  }
  const isPage = entityType === "page" || account.entityType === "page";
  const pageId = isPage ? String(account.entityId || account.platformUserId || "").trim() : "";
  const profileId = isPage ? "" : String(account.entityId || account.platformUserId || "").trim();

  if (isPage && !pageId) {
    return { ok: false, code: "invalid_page", account };
  }

  const profileAccount = isPage ? await getFacebookProfileAccountDoc(userId) : account;
  let accessToken = isPage ? account.getDecryptedAccessToken?.() || "" : profileAccount?.getDecryptedAccessToken?.() || "";

  if (isPage) {
    const storedEnc = profileAccount?.pagePublishingTokens?.[pageId];
    const storedToken = storedEnc ? decryptToken(storedEnc) : "";
    const pageRowToken = accessToken;
    let userToken = profileAccount?.getDecryptedAccessToken?.() || "";

    if (
      userToken &&
      profileAccount?.expiresAt &&
      new Date(profileAccount.expiresAt).getTime() <= Date.now()
    ) {
      try {
        const facebookService = (await import("./meta.service.js")).default;
        const refreshed = await facebookService.refreshTokenIfNeeded(profileAccount);
        if (refreshed?.accessToken) {
          profileAccount.setEncryptedAccessToken(refreshed.accessToken);
          if (refreshed.expiresIn) {
            profileAccount.expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
          }
          profileAccount.lastSyncedAt = new Date();
          await profileAccount.save();
          userToken = refreshed.accessToken;
        }
      } catch {
        /* fall through to graph fetch with existing token */
      }
    }

    let graphToken = "";
    if (userToken) {
      try {
        graphToken = await fetchPageAccessTokenFromGraph(userToken, pageId);
      } catch {
        /* try bulk list next */
      }
      if (!graphToken) {
        try {
          const all = await listPageAccessTokensFromGraph(userToken);
          graphToken = all[pageId] || "";
        } catch {
          graphToken = "";
        }
      }
    }

    accessToken = pageRowToken || graphToken || storedToken || "";

    if (!accessToken) {
      return { ok: false, code: "token_missing", account };
    }

    if (accessToken !== pageRowToken) {
      account.setEncryptedAccessToken(accessToken);
      account.lastSyncedAt = new Date();
      await account.save();
    }
    await persistPagePublishingToken(userId, pageId, accessToken);
  } else {
    return { ok: false, code: "profile_not_supported", account: null };
  }

  return {
    ok: true,
    account,
    profileAccount: profileAccount || account,
    accessToken,
    entityType: "page",
    targetType: "page",
    pageId,
    profileId,
    platformAccountId: isPage ? pageId : profileId,
    targetName: account.accountName || account.username || pageId || profileId || "Facebook",
  };
}

/**
 * Refresh user token on profile row, then resolve a fresh page access token.
 * @param {import("mongodb").ObjectId} userId
 * @param {string} pageId
 * @param {import("./meta.service.js").default} facebookProvider
 */
export async function refreshFacebookPageAccessToken(userId, pageId, facebookProvider) {
  const profileAccount = await getFacebookProfileAccountDoc(userId);
  if (!profileAccount) return "";

  let userToken = profileAccount.getDecryptedAccessToken?.() || "";
  if (!userToken) return "";

  if (profileAccount.expiresAt && new Date(profileAccount.expiresAt).getTime() <= Date.now()) {
    const refreshed = await facebookProvider.refreshTokenIfNeeded(profileAccount);
    if (refreshed?.accessToken) {
      profileAccount.setEncryptedAccessToken(refreshed.accessToken);
      if (refreshed.expiresIn) {
        profileAccount.expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
      }
      profileAccount.lastSyncedAt = new Date();
      await profileAccount.save();
      userToken = refreshed.accessToken;
    }
  }

  let pageToken = "";
  try {
    pageToken = await fetchPageAccessTokenFromGraph(userToken, pageId);
  } catch {
    const all = await listPageAccessTokensFromGraph(userToken);
    pageToken = all[pageId] || "";
  }

  if (!pageToken) return "";

  const pageAccount = await SocialAccount.findOne({
    userId,
    platform: "facebook",
    entityType: "page",
    entityId: pageId,
    isConnected: true,
  });
  if (pageAccount) {
    pageAccount.setEncryptedAccessToken(pageToken);
    pageAccount.lastSyncedAt = new Date();
    await pageAccount.save();
  }
  await persistPagePublishingToken(userId, pageId, pageToken);
  return pageToken;
}
