import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getAppConfig, getProviderEnvStatus, getRequiredEnvStatus } from "../config/social.config.js";
import { createOAuthState, validateOAuthState } from "../utils/oauthState.js";
import { getOAuthReturnPath, normalizeOAuthFlow } from "../utils/oauthReturnPath.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import { getProvider } from "../services/social/providerRegistry.js";
import instagramService, { publishInstagramContent, INSTAGRAM_CAPTION_MAX_LENGTH } from "../services/social/instagram.service.js";
import { META_SCOPE_SETS } from "../services/social/meta.service.js";
import { decryptToken, encryptToken } from "../utils/crypto.js";
import {
  publishFacebookPagePost,
  publishFacebookPhotoFromBuffer,
} from "../services/social/facebookPublish.service.js";
import {
  ingestRemoteUrlToUploads,
  isAppHostedUploadUrl,
  loadMediaBufferFromUrl,
} from "../services/social/hostedMedia.service.js";
import {
  isMetaTokenAuthError,
  persistPagePublishingToken,
  refreshFacebookPageAccessToken,
  resolveFacebookPublishCredentials,
} from "../services/social/facebookPublishCredentials.service.js";
import facebookService from "../services/social/facebook.service.js";
import { getSafeProviderDebugInfo, validateProviderConfig } from "../utils/providerConfig.util.js";
import { resolveInstagramRedirectUri, resolveProviderRedirectUri } from "../utils/redirectUri.util.js";
import { getPlatformCapabilities } from "../config/platformCapabilities.js";
import {
  disconnectAccount,
  disconnectAccountById,
  findDiscordTargetFromAccount,
  disconnectGoogleBusinessLocation,
  getAccountsForUser,
  getAccountStatus,
  getGoogleBusinessAccountForToken,
  getGoogleBusinessLocationAccount,
  getLinkedInAccountForToken,
  getLinkedInOrganizationAccount,
  getFacebookAccountForPublish,
  getStoredAccountForProvider,
  refreshAccountToken,
  refreshAccountTokenById,
  replaceDiscordPostingTargets,
  replaceTelegramPostingTargets,
  resolveTelegramPostingTargetForUser,
  resolveYouTubeAccountForUpload,
  upsertConnectedAccount,
} from "../services/social/socialAccount.service.js";
import {
  buildDiscordMessagePayload,
  fetchDiscordChannelWithBot,
  fetchDiscordUserGuildIds,
  isValidDiscordHttpUrl,
  publishDiscordViaBot,
  publishDiscordViaWebhook,
  refreshDiscordAccessToken,
} from "../services/social/discordPublish.service.js";
import { publishTelegramPost } from "../services/social/telegramPublish.service.js";
import SocialAccount from "../models/SocialAccount.js";
import SocialOAuthSession from "../models/SocialOAuthSession.js";
import linkedinProvider from "../services/social/linkedin.service.js";
import { getLinkedInAuthorUrn } from "../services/social/linkedinAuthor.util.js";
import youtubeService from "../services/social/youtube.service.js";
import { publishGoogleBusinessLocalPost } from "../services/social/googleBusinessPublish.service.js";
import {
  getGoogleBusinessLocationName,
  discoverGoogleBusinessProfiles,
} from "../services/social/googleBusiness.service.js";
import { listPostHistoryForUser, recordSuccessfulPublish } from "../services/social/postHistory.service.js";

const META_PLATFORMS = new Set(["facebook"]);
const META_UPGRADE_SCOPE_SETS = {
  pages_show_list: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.pagePosting],
  instagram_basic: [...META_SCOPE_SETS.pages, ...META_SCOPE_SETS.pagePosting, ...META_SCOPE_SETS.instagramBasic],
  publishing: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.pagePosting,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.publishing,
  ],
  insights: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.pagePosting,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.insights,
  ],
  all: [
    ...META_SCOPE_SETS.pages,
    ...META_SCOPE_SETS.pagePosting,
    ...META_SCOPE_SETS.instagramBasic,
    ...META_SCOPE_SETS.publishing,
    ...META_SCOPE_SETS.insights,
  ],
};

function toBase64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = toBase64Url(crypto.randomBytes(48));
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function getClientUrl() {
  return getAppConfig().clientBaseUrl;
}

function normalizePlatform(platform) {
  if (platform === "google") return "youtube";
  return platform;
}

function resolvePlatform(platform) {
  const normalized = normalizePlatform(platform);
  const provider = getProvider(normalized);
  if (!provider) {
    throw new Error("Unsupported social platform.");
  }
  return { platform: normalized, provider };
}

function mapProviderErrorReason(error, errorDescription = "") {
  const normalizedDescription = (errorDescription || "").toLowerCase();
  if (error === "access_denied") return "login_canceled";
  if (error === "invalid_scope") return "invalid_scope";
  if (normalizedDescription.includes("invalid scopes")) return "invalid_scope";
  if (
    error === "redirect_uri_mismatch" ||
    normalizedDescription.includes("redirect_uri_mismatch")
  ) {
    return "google_redirect_uri_mismatch";
  }
  if (
    normalizedDescription.includes("invalid redirect_uri") ||
    normalizedDescription.includes("invalid redirect uri") ||
    (normalizedDescription.includes("invalid request") && normalizedDescription.includes("redirect_uri"))
  ) {
    return "instagram_redirect_uri_mismatch";
  }
  return errorDescription || error || "oauth_error";
}

function isGooglePlatform(platform) {
  const key = String(platform || "").toLowerCase();
  return key === "googlebusiness" || key === "youtube";
}

function resolveGoogleRedirectUriForPlatform(platform) {
  const key = String(platform || "").toLowerCase();
  if (key === "googlebusiness") return resolveProviderRedirectUri("googleBusiness") || "";
  if (key === "youtube") return resolveProviderRedirectUri("youtube") || "";
  return "";
}

function isLowValueOAuthDetail(detail) {
  const normalized = String(detail || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  if (normalized === "bad request" || normalized === "forbidden") return true;
  if (normalized.startsWith("request failed")) return true;
  if (normalized.includes("token exchange failed")) return true;
  return !normalized.includes("http") && normalized.length < 12;
}

/** Prefer configured redirect URI for mismatch errors; avoid generic HTTP text like "Bad Request". */
function buildOAuthRedirectParams(platform, reason, callbackError = null) {
  const normalizedReason = String(reason || "").toLowerCase();
  const isRedirectMismatch =
    normalizedReason.includes("google_redirect_uri_mismatch") ||
    normalizedReason.includes("redirect_uri_mismatch") ||
    normalizedReason.includes("instagram_redirect_uri_mismatch");

  if (normalizedReason.includes("instagram_redirect_uri_mismatch") && platform === "instagram") {
    return {
      detail: "",
      redirectUri: resolveProviderRedirectUri("instagram"),
    };
  }

  if (isRedirectMismatch && isGooglePlatform(platform)) {
    return {
      detail: "",
      redirectUri: resolveGoogleRedirectUriForPlatform(platform),
    };
  }

  const rawDetail =
    callbackError?.details?.error_description ||
    callbackError?.details?.error?.message ||
    callbackError?.details?.error_message ||
    (typeof callbackError?.message === "string" ? callbackError.message : "") ||
    "";

  return {
    detail: isLowValueOAuthDetail(rawDetail) ? "" : String(rawDetail).trim(),
    redirectUri: "",
  };
}

function mapCallbackReason(callbackError) {
  if (!callbackError?.message) return "oauth_callback_failed";
  const normalized = callbackError.message.toLowerCase();
  if (callbackError?.code) return callbackError.code;
  if (normalized.includes("missing authorization code")) return "missing_code";
  if (normalized.includes("missing oauth state") || normalized.includes("invalid oauth state")) return "invalid_state";
  if (normalized.includes("no facebook pages")) return "no_facebook_pages";
  if (normalized.includes("no linked instagram professional account")) return "no_instagram_professional_account";
  if (callbackError?.code === "instagram_personal_account") return "instagram_personal_account";
  if (normalized.includes("invalid scope")) return "invalid_scope";
  if (normalized.includes("permission")) return "invalid_scope";
  if (normalized.includes("profile fetch failed")) return "invalid_scope";
  if (normalized.includes("unable to identify social account")) return "profile_identification_failed";
  if (normalized.includes("unable to read facebook pages")) return "no_page_found";
  if (normalized.includes("already linked to another engagehub user")) return "account_already_linked";
  if (normalized.includes("already connected to your engagehub")) return "account_already_connected";
  if (normalized.includes("google business permission")) return "google_business_scope_missing";
  if (normalized.includes("no google business profiles")) return "no_google_business_locations";
  if (normalized.includes("selected location not found")) return "selected_location_not_found";
  if (normalized.includes("connection session expired")) return "expired_session";
  if (callbackError?.code === "oauth_code_invalid") return "oauth_code_invalid";
  if (normalized.includes("token")) return "token_error";
  return "oauth_callback_failed";
}

function sanitizeFacebookSessionProfile(payload) {
  const profile = payload?.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const id = profile?.id ? String(profile.id).trim() : "";
  if (!id) return null;
  return {
    id,
    entityType: "profile",
    name: profile.name || "",
    category: profile.category || "Personal profile",
    pictureUrl: profile.pictureUrl || "",
    email: profile.email || "",
    instagram_business_account: null,
  };
}

function sanitizeFacebookSessionPages(payload) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  return pages.map((p) => ({
    id: p?.id || "",
    entityType: "page",
    name: p?.name || "",
    category: p?.category || "",
    pictureUrl: p?.pictureUrl || "",
    instagram_business_account: p?.instagram_business_account
      ? {
          id: p.instagram_business_account?.id || "",
          username: p.instagram_business_account?.username || "",
          profile_picture_url: p.instagram_business_account?.profile_picture_url || "",
        }
      : null,
  }));
}

function sanitizeInstagramSessionAccounts(payload) {
  const accounts = Array.isArray(payload?.instagramAccounts) ? payload.instagramAccounts : [];
  return accounts
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      return {
        instagramAccountId: item.instagramAccountId ? String(item.instagramAccountId) : "",
        username: item.username || "",
        name: item.name || "",
        profilePicture: item.profilePicture || "",
        accountType: item.accountType || "business",
        linkedPageId: item.linkedPageId || "",
        linkedPageName: item.linkedPageName || "",
        pageCategory: item.pageCategory || "",
      };
    })
    .filter((item) => item && item.instagramAccountId && item.linkedPageId);
}

export async function facebookPagesSession(req, res) {
  try {
    const sessionId = req.query?.session ? String(req.query.session).trim() : "";
    if (!sessionId) {
      return errorResponse(res, "Missing session id.", 400, "missing_session");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "facebook") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    const profile = sanitizeFacebookSessionProfile(doc.payload || {});
    const pages = sanitizeFacebookSessionPages(doc.payload || {});
    return successResponse(
      res,
      {
        sessionId: doc._id,
        platform: doc.platform,
        flow: doc.flow || "settings",
        profile,
        pages,
      },
      "Fetched Facebook accounts for selection."
    );
  } catch (error) {
    return errorResponse(res, error.message || "Unable to load Facebook Pages.", 400, error?.code || error.message);
  }
}

/** Stores Meta user token (not a posting destination) so Page tokens can be refreshed. */
async function ensureFacebookOAuthUserRow(userId, doc, sessionProfile) {
  const profileId = sessionProfile?.id ? String(sessionProfile.id).trim() : "";
  const userToken = doc?.accessTokenEnc ? decryptToken(doc.accessTokenEnc) : "";
  if (!profileId || !userToken) return;

  const tokenExpiresIn = doc.expiresAt
    ? Math.max(1, Math.floor((new Date(doc.expiresAt).getTime() - Date.now()) / 1000))
    : null;

  await upsertConnectedAccount({
    userId,
    platform: "facebook",
    profile: {
      platformUserId: profileId,
      entityType: "profile",
      entityId: profileId,
      accountName: sessionProfile.name || "",
      username: "",
      email: sessionProfile.email || "",
      profileImage: sessionProfile.pictureUrl || "",
      isPrimary: false,
      capabilities: [],
      metadata: {
        oauthOnly: true,
        category: "Meta login (not a posting destination)",
        pictureUrl: sessionProfile.pictureUrl || "",
      },
    },
    tokenData: {
      accessToken: userToken,
      refreshToken: "",
      tokenType: doc.tokenType || "Bearer",
      expiresIn: tokenExpiresIn,
      scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
    },
  });
}

async function connectFacebookDestinationFromSession({
  userId,
  doc,
  sessionProfile,
  pages,
  destinationId,
  assignPrimary,
}) {
  const profileId = sessionProfile?.id ? String(sessionProfile.id).trim() : "";
  const pageId = String(destinationId || "").trim();

  if (profileId && pageId === profileId) {
    const err = new Error("Personal Facebook profiles cannot be connected for publishing. Select a Facebook Page.");
    err.status = 400;
    err.code = "facebook_profile_not_supported";
    throw err;
  }

  const tokenExpiresIn = doc.expiresAt
    ? Math.max(1, Math.floor((new Date(doc.expiresAt).getTime() - Date.now()) / 1000))
    : null;

  const selected = pages.find((p) => String(p?.id || "").trim() === pageId) || null;
  if (!selected) {
    const err = new Error("Selected Facebook Page not found.");
    err.status = 404;
    err.code = "selected_page_not_found";
    throw err;
  }
  const pageAccessTokenEnc = selected?.pageAccessTokenEnc || null;
  const accessToken = pageAccessTokenEnc ? decryptToken(pageAccessTokenEnc) : "";
  if (!accessToken) {
    const err = new Error("Page access token is unavailable. Please reconnect.");
    err.status = 400;
    err.code = "token_missing";
    throw err;
  }
  const entityType = "page";

  const facebookAccount = await upsertConnectedAccount({
    userId,
    platform: "facebook",
    profile: {
      platformUserId: String(selected.id || "").trim(),
      entityType,
      entityId: String(selected.id || "").trim(),
      accountName: selected.name || "",
      username: "",
      email: selected.email || "",
      profileImage: selected.pictureUrl || "",
      isPrimary: assignPrimary,
      capabilities: ["posting", "analytics"],
      metadata: {
        metaUserId: profileId,
        category: selected.category || "Page",
        pageId: entityType === "page" ? String(selected.id || "").trim() : "",
        pageName: entityType === "page" ? selected.name || "" : "",
        pictureUrl: selected.pictureUrl || "",
        selectedAt: new Date().toISOString(),
      },
    },
    tokenData: {
      accessToken,
      refreshToken: "",
      tokenType: doc.tokenType || "Bearer",
      expiresIn: tokenExpiresIn,
      scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
    },
  });

  if (entityType === "page" && accessToken) {
    await persistPagePublishingToken(userId, String(selected.id || "").trim(), accessToken);
  }

  let instagramAccount = null;
  let instagramWarning = "";
  const ig = entityType === "page" ? selected?.instagram_business_account : null;
  if (ig?.id) {
    const pageAccessToken = accessToken;
    instagramAccount = await upsertConnectedAccount({
      userId,
      platform: "instagram",
      profile: {
        platformUserId: String(ig.id || "").trim(),
        entityType: "business",
        entityId: String(ig.id || "").trim(),
        accountName: ig.username || "",
        username: ig.username || "",
        email: "",
        profileImage: ig.profile_picture_url || "",
        isPrimary: false,
        capabilities: ["posting", "analytics"],
        metadata: {
          metaUserId: profileId,
          parentPageId: String(selected.id || "").trim(),
        },
      },
      tokenData: {
        accessToken: pageAccessToken,
        refreshToken: "",
        tokenType: doc.tokenType || "Bearer",
        expiresIn: tokenExpiresIn,
        scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
      },
    });

    if (instagramAccount?.id) {
      await SocialAccount.updateOne(
        { _id: instagramAccount.id, userId },
        { $set: { parentAccountId: facebookAccount?.id || null } }
      );
    }

    if (facebookAccount?.id) {
      await SocialAccount.updateOne(
        { _id: facebookAccount.id, userId },
        {
          $set: {
            "metadata.linkedInstagramAccount": {
              id: String(ig.id || "").trim(),
              username: ig.username || "",
              profile_picture_url: ig.profile_picture_url || "",
            },
          },
        }
      );
    }
  } else if (entityType === "page") {
    instagramWarning = "No Instagram professional account linked to this Facebook Page.";
  }

  return { facebookAccount, instagramAccount, instagramWarning, entityType };
}

export async function selectFacebookPage(req, res) {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
    const sessionId = body?.sessionId != null ? String(body.sessionId).trim() : "";
    const pageIds = Array.isArray(body?.pageIds)
      ? body.pageIds.map((id) => String(id || "").trim()).filter(Boolean)
      : body?.pageId != null
        ? [String(body.pageId).trim()]
        : [];
    if (!sessionId || !pageIds.length) {
      return errorResponse(res, "sessionId and pageId (or pageIds) are required.", 400, "validation_error");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "facebook") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    const userId = new ObjectId(req.auth.userId);
    const sessionProfile = doc?.payload?.profile;
    const pages = Array.isArray(doc?.payload?.pages) ? doc.payload.pages : [];

    let assignPrimary = !(await SocialAccount.exists({
      userId,
      platform: "facebook",
      isPrimary: true,
      isConnected: true,
    }));

    /** @type {object[]} */
    const connectedFacebook = [];
    /** @type {object[]} */
    const connectedInstagram = [];
    const warnings = [];

    await ensureFacebookOAuthUserRow(userId, doc, sessionProfile);

    for (const destinationId of pageIds) {
      const result = await connectFacebookDestinationFromSession({
        userId,
        doc,
        sessionProfile,
        pages,
        destinationId,
        assignPrimary,
      });
      connectedFacebook.push(result.facebookAccount);
      if (result.instagramAccount) connectedInstagram.push(result.instagramAccount);
      if (result.instagramWarning) warnings.push(result.instagramWarning);
      if (assignPrimary) assignPrimary = false;
    }

    doc.status = "consumed";
    await doc.save();

    const connectedCount = connectedFacebook.length;
    const message =
      connectedCount === 1
        ? "Facebook Page connected successfully."
        : `${connectedCount} Facebook Pages connected successfully.`;

    return successResponse(
      res,
      {
        facebook: connectedFacebook.length === 1 ? connectedFacebook[0] : connectedFacebook,
        instagram: connectedInstagram.length === 1 ? connectedInstagram[0] : connectedInstagram,
        warning: warnings.length ? warnings.join(" ") : null,
        flow: doc.flow || "settings",
        connectedCount,
      },
      message
    );
  } catch (error) {
    const message = error?.message || "Unable to finish Facebook connection.";
    return errorResponse(res, message, error?.status || 400, error?.code || message);
  }
}

export async function instagramAccountsSession(req, res) {
  try {
    const sessionId = req.query?.session ? String(req.query.session).trim() : "";
    if (!sessionId) {
      return errorResponse(res, "Missing session id.", 400, "missing_session");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "instagram") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    return successResponse(
      res,
      {
        sessionId: doc._id,
        platform: doc.platform,
        flow: doc.flow || "settings",
        instagramAccounts: sanitizeInstagramSessionAccounts(doc.payload || {}),
      },
      "Fetched Instagram professional accounts for selection."
    );
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to load Instagram professional accounts.",
      400,
      error?.code || error.message
    );
  }
}

export async function selectInstagramAccount(req, res) {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
    const sessionId = body?.sessionId != null ? String(body.sessionId).trim() : "";
    const instagramAccountId = body?.instagramAccountId != null ? String(body.instagramAccountId).trim() : "";
    const autoConnectLinkedFacebookPage = Boolean(body?.autoConnectLinkedFacebookPage);

    if (!sessionId || !instagramAccountId) {
      return errorResponse(res, "sessionId and instagramAccountId are required.", 400, "validation_error");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "instagram") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    const pages = Array.isArray(doc?.payload?.pages) ? doc.payload.pages : [];
    const accounts = Array.isArray(doc?.payload?.instagramAccounts) ? doc.payload.instagramAccounts : [];
    const selected =
      accounts.find((item) => String(item?.instagramAccountId || "").trim() === instagramAccountId) || null;
    if (!selected) {
      return errorResponse(res, "Selected Instagram account not found.", 404, "selected_instagram_account_not_found");
    }

    const linkedPage =
      pages.find((p) => String(p?.id || "").trim() === String(selected.linkedPageId || "").trim()) || null;
    if (!linkedPage) {
      return errorResponse(res, "Linked Facebook Page was not found in this session.", 404, "linked_page_not_found");
    }
    const pageAccessToken = linkedPage.pageAccessTokenEnc ? decryptToken(linkedPage.pageAccessTokenEnc) : null;
    if (!pageAccessToken) {
      return errorResponse(res, "Page access token is unavailable. Please reconnect.", 400, "token_missing");
    }

    const tokenExpiresIn = doc.expiresAt
      ? Math.max(1, Math.floor((new Date(doc.expiresAt).getTime() - Date.now()) / 1000))
      : null;

    const instagramAccount = await upsertConnectedAccount({
      userId: new ObjectId(req.auth.userId),
      platform: "instagram",
      profile: {
        platformUserId: selected.instagramAccountId,
        entityType: "business",
        entityId: selected.instagramAccountId,
        accountName: selected.username || selected.name || "",
        username: selected.username || "",
        email: "",
        profileImage: selected.profilePicture || "",
        isPrimary: true,
        capabilities: ["posting", "analytics"],
        metadata: {
          accountType: (selected.accountType || "business").toLowerCase(),
          parentPageId: selected.linkedPageId || "",
          linkedPageName: selected.linkedPageName || "",
          pageCategory: selected.pageCategory || "",
        },
      },
      tokenData: {
        accessToken: pageAccessToken,
        refreshToken: "",
        tokenType: doc.tokenType || "Bearer",
        expiresIn: tokenExpiresIn,
        scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
      },
    });

    let facebookAccount = null;
    if (autoConnectLinkedFacebookPage) {
      facebookAccount = await upsertConnectedAccount({
        userId: new ObjectId(req.auth.userId),
        platform: "facebook",
        profile: {
          platformUserId: String(linkedPage.id || "").trim(),
          entityType: "page",
          entityId: String(linkedPage.id || "").trim(),
          accountName: linkedPage.name || "",
          username: "",
          email: "",
          profileImage: linkedPage.pictureUrl || "",
          isPrimary: true,
          capabilities: ["posting", "analytics"],
          metadata: {
            category: linkedPage.category || "",
            pageId: String(linkedPage.id || "").trim(),
            pageName: linkedPage.name || "",
            pictureUrl: linkedPage.pictureUrl || "",
            selectedAt: new Date().toISOString(),
          },
        },
        tokenData: {
          accessToken: pageAccessToken,
          refreshToken: "",
          tokenType: doc.tokenType || "Bearer",
          expiresIn: tokenExpiresIn,
          scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
        },
      });
    }

    if (instagramAccount?.id && facebookAccount?.id) {
      await SocialAccount.updateOne(
        { _id: instagramAccount.id, userId: new ObjectId(req.auth.userId) },
        { $set: { parentAccountId: facebookAccount.id } }
      );
    }

    doc.status = "consumed";
    await doc.save();

    return successResponse(
      res,
      {
        instagram: instagramAccount,
        facebook: facebookAccount,
        flow: doc.flow || "settings",
      },
      "Instagram account connected successfully."
    );
  } catch (error) {
    const message = error?.message || "Unable to finish Instagram connection.";
    return errorResponse(res, message, error?.status || 400, error?.code || message);
  }
}

function sanitizeLinkedInDestinations(payload) {
  const destinations = Array.isArray(payload?.destinations) ? payload.destinations : [];
  return destinations
    .map((d) => {
      if (!d || typeof d !== "object" || Array.isArray(d)) return null;
      return {
        type: d.type === "organization" ? "organization" : "profile",
        platform: "linkedin",
        id: d.id ? String(d.id) : "",
        name: d.name || "",
        avatar: d.avatar || "",
        email: d.email || "",
        canPost: d.canPost !== false,
        role: d.role || "",
        permissionStatus: d.permissionStatus || "",
      };
    })
    .filter((d) => d && d.id);
}

function sanitizeGoogleBusinessLocations(payload) {
  const locations = Array.isArray(payload?.locations) ? payload.locations : [];
  return locations
    .map((loc) => {
      if (!loc || typeof loc !== "object" || Array.isArray(loc)) return null;
      const locationId = loc.locationId ? String(loc.locationId).trim() : "";
      if (!locationId) return null;
      return {
        locationId,
        title: loc.title || "",
        address: loc.address || "",
        phone: loc.phone || "",
        website: loc.website || "",
        primaryCategory: loc.primaryCategory || "",
        verificationStatus: loc.verificationStatus || "",
        storefrontUrl: loc.storefrontUrl || "",
        accountId: loc.accountId ? String(loc.accountId).trim() : "",
        accountName: loc.accountName || "",
      };
    })
    .filter(Boolean);
}

export async function linkedinAccountsSession(req, res) {
  try {
    const sessionId = req.query?.session ? String(req.query.session).trim() : "";
    if (!sessionId) {
      return errorResponse(res, "Missing session id.", 400, "missing_session");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "linkedin") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    const destinations = sanitizeLinkedInDestinations(doc.payload || {});
    const orgWarning =
      typeof doc?.payload?.orgWarning === "string" ? doc.payload.orgWarning : "";

    return successResponse(
      res,
      {
        sessionId: doc._id,
        platform: doc.platform,
        flow: doc.flow || "settings",
        destinations,
        orgWarning,
      },
      "Fetched LinkedIn destinations for selection."
    );
  } catch (error) {
    return errorResponse(res, error.message || "Unable to load LinkedIn accounts.", 400, error?.code || error.message);
  }
}

export async function selectLinkedInAccount(req, res) {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
    const sessionId = body?.sessionId != null ? String(body.sessionId).trim() : "";
    const accountId = body?.accountId != null ? String(body.accountId).trim() : "";
    const accountTypeRaw = body?.accountType != null ? String(body.accountType).trim().toLowerCase() : "";
    const accountType = accountTypeRaw === "organization" ? "organization" : "profile";

    if (!sessionId || !accountId) {
      return errorResponse(res, "sessionId and accountId are required.", 400, "validation_error");
    }
    if (!["profile", "organization"].includes(accountType)) {
      return errorResponse(res, "accountType must be profile or organization.", 400, "validation_error");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "linkedin") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    const accessToken = doc.accessTokenEnc ? decryptToken(doc.accessTokenEnc) : "";
    const refreshToken = doc.refreshTokenEnc ? decryptToken(doc.refreshTokenEnc) : "";
    if (!accessToken) {
      return errorResponse(res, "Access token is unavailable. Please reconnect LinkedIn.", 400, "token_missing");
    }

    const destinations = sanitizeLinkedInDestinations(doc.payload || {});
    const selected =
      destinations.find((d) => d.id === accountId && d.type === accountType) || null;
    if (!selected) {
      return errorResponse(res, "Selected LinkedIn destination not found.", 404, "selected_account_not_found");
    }

    const tokenExpiresIn = doc.expiresAt
      ? Math.max(1, Math.floor((new Date(doc.expiresAt).getTime() - Date.now()) / 1000))
      : null;

    const platformUserId = doc.providerUserId ? String(doc.providerUserId).trim() : "";
    if (!platformUserId) {
      return errorResponse(res, "LinkedIn profile identity is missing. Please reconnect.", 400, "profile_identification_failed");
    }

    const metadataBase = {
      selectedAt: new Date().toISOString(),
    };
    const organizationDiscoveryErrorCode =
      typeof doc?.payload?.organizationDiscoveryErrorCode === "string"
        ? doc.payload.organizationDiscoveryErrorCode
        : "";

    const tokenData = {
      accessToken,
      refreshToken,
      tokenType: doc.tokenType || "Bearer",
      expiresIn: tokenExpiresIn,
      scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
    };

    const userObjectId = new ObjectId(req.auth.userId);
    const profileDest =
      destinations.find((d) => d.type === "profile") ||
      destinations.find((d) => d.id === platformUserId) ||
      null;

    let linkedinAccount = null;

    if (profileDest) {
      linkedinAccount = await upsertConnectedAccount({
        userId: userObjectId,
        platform: "linkedin",
        profile: {
          platformUserId,
          entityType: "profile",
          entityId: profileDest.id,
          accountName: profileDest.name || "",
          username: "",
          email: profileDest.email || "",
          profileImage: profileDest.avatar || "",
          isPrimary: accountType === "profile",
          capabilities: ["posting", "analytics"],
          metadata: {
            ...metadataBase,
            personUrn: `urn:li:person:${platformUserId}`,
            canPost: true,
            ...(organizationDiscoveryErrorCode ? { organizationDiscoveryErrorCode } : {}),
          },
        },
        tokenData,
      });
    }

    for (const org of destinations.filter((d) => d.type === "organization")) {
      const orgAccount = await upsertConnectedAccount({
        userId: userObjectId,
        platform: "linkedin",
        profile: {
          platformUserId,
          entityType: "organization",
          entityId: org.id,
          accountName: org.name || "",
          username: "",
          email: "",
          profileImage: org.avatar || "",
          isPrimary: false,
          capabilities: ["posting", "analytics"],
          metadata: {
            ...metadataBase,
            organizationId: org.id,
            organizationUrn: `urn:li:organization:${org.id}`,
            role: org.role || "",
            canPost: org.canPost !== false,
          },
        },
        tokenData,
      });
      if (accountType === "organization" && org.id === selected.id) {
        linkedinAccount = orgAccount;
      }
    }

    if (!linkedinAccount) {
      linkedinAccount = await upsertConnectedAccount({
        userId: userObjectId,
        platform: "linkedin",
        profile: {
          platformUserId,
          entityType: accountType,
          entityId: selected.id,
          accountName: selected.name || "",
          username: "",
          email: selected.email || "",
          profileImage: selected.avatar || "",
          isPrimary: accountType === "profile",
          capabilities: ["posting", "analytics"],
          metadata:
            accountType === "organization"
              ? {
                  ...metadataBase,
                  organizationId: selected.id,
                  organizationUrn: `urn:li:organization:${selected.id}`,
                  role: selected.role || "",
                  canPost: selected.canPost !== false,
                }
              : {
                  ...metadataBase,
                  personUrn: `urn:li:person:${platformUserId}`,
                  canPost: true,
                  ...(organizationDiscoveryErrorCode ? { organizationDiscoveryErrorCode } : {}),
                },
        },
        tokenData,
      });
    }

    doc.status = "consumed";
    await doc.save();

    const orgCount = destinations.filter((d) => d.type === "organization").length;

    return successResponse(
      res,
      {
        account: linkedinAccount,
        flow: doc.flow || "settings",
        syncedOrganizations: orgCount,
      },
      orgCount
        ? "LinkedIn connected. Personal profile and company pages are available."
        : "LinkedIn connected successfully."
    );
  } catch (error) {
    return errorResponse(res, error.message || "Unable to finish LinkedIn connection.", error?.status || 400, error?.code || "linkedin_select_failed");
  }
}

export async function googleBusinessLocationsSession(req, res) {
  try {
    const sessionId = req.query?.session ? String(req.query.session).trim() : "";
    if (!sessionId) {
      return errorResponse(res, "Missing session id.", 400, "missing_session");
    }
    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "googleBusiness") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }
    let locations = sanitizeGoogleBusinessLocations(doc.payload || {});
    let accounts = Array.isArray(doc?.payload?.accounts) ? doc.payload.accounts : [];

    if (!locations.length) {
      const accessToken = doc.accessTokenEnc ? decryptToken(doc.accessTokenEnc) : "";
      if (!accessToken) {
        return errorResponse(res, "Access token is unavailable. Please reconnect Google Business Profile.", 400, "token_missing");
      }
      const discovered = await discoverGoogleBusinessProfiles(accessToken, accounts.length ? accounts : null);
      accounts = discovered.accounts;
      locations = sanitizeGoogleBusinessLocations({ locations: discovered.locations });
      doc.payload = {
        ...(doc.payload || {}),
        accounts,
        locations: discovered.locations,
      };
      doc.markModified("payload");
      await doc.save();
    }

    if (!locations.length) {
      return errorResponse(res, "No Google Business Profiles found for this account.", 404, "no_google_business_locations");
    }
    return successResponse(
      res,
      {
        sessionId: doc._id,
        platform: doc.platform,
        flow: doc.flow || "settings",
        googleUser: doc?.payload?.googleUser || null,
        accounts,
        locations,
      },
      "Fetched Google Business locations for selection."
    );
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to load Google Business Profiles.",
      error?.status || 400,
      error?.code || "google_business_locations_session_failed"
    );
  }
}

export async function selectGoogleBusinessLocations(req, res) {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
    const sessionId = body?.sessionId != null ? String(body.sessionId).trim() : "";
    const locationIdsRaw = Array.isArray(body?.locationIds) ? body.locationIds : [];
    const locationIds = [...new Set(locationIdsRaw.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!sessionId) {
      return errorResponse(res, "sessionId is required.", 400, "validation_error");
    }
    if (!locationIds.length) {
      return errorResponse(res, "Select at least one business profile.", 400, "no_locations_selected");
    }

    const doc = await SocialOAuthSession.findById(sessionId);
    if (!doc) {
      return errorResponse(res, "Connection session expired. Please reconnect.", 404, "expired_session");
    }
    if (String(doc.userId) !== String(req.auth.userId)) {
      return errorResponse(res, "Invalid connection session.", 403, "invalid_session");
    }
    if (doc.status === "consumed") {
      return errorResponse(res, "Connection session already used. Please reconnect.", 400, "session_consumed");
    }
    if (doc.platform !== "googleBusiness") {
      return errorResponse(res, "Invalid session platform.", 400, "invalid_session_platform");
    }

    const accessToken = doc.accessTokenEnc ? decryptToken(doc.accessTokenEnc) : "";
    const refreshToken = doc.refreshTokenEnc ? decryptToken(doc.refreshTokenEnc) : "";
    if (!accessToken) {
      return errorResponse(res, "Access token is unavailable. Please reconnect Google Business Profile.", 400, "token_missing");
    }

    const allLocations = sanitizeGoogleBusinessLocations(doc.payload || {});
    const selectedLocations = allLocations.filter((loc) => locationIds.includes(loc.locationId));
    if (!selectedLocations.length || selectedLocations.length !== locationIds.length) {
      return errorResponse(res, "Selected location not found.", 404, "selected_location_not_found");
    }

    const tokenExpiresIn = doc.expiresAt
      ? Math.max(1, Math.floor((new Date(doc.expiresAt).getTime() - Date.now()) / 1000))
      : null;

    const profileId = doc.providerUserId ? String(doc.providerUserId).trim() : "";
    const googleUser = doc?.payload?.googleUser && typeof doc.payload.googleUser === "object" ? doc.payload.googleUser : {};
    const accountRows = [];
    for (const loc of selectedLocations) {
      const account = await upsertConnectedAccount({
        userId: new ObjectId(req.auth.userId),
        platform: "googleBusiness",
        profile: {
          platformUserId: profileId || loc.locationId,
          entityType: "location",
          entityId: loc.locationId,
          accountName: loc.title || `Location ${loc.locationId}`,
          username: googleUser?.email || "",
          email: googleUser?.email || "",
          profileImage: "",
          isPrimary: false,
          capabilities: ["posting", "analytics", "business-updates"],
          metadata: {
            accountId: loc.accountId || "",
            googleBusinessAccountId: loc.accountId || "",
            accountName: loc.accountName || "",
            address: loc.address || "",
            category: loc.primaryCategory || "",
            website: loc.website || "",
            verificationStatus: loc.verificationStatus || "",
            locationTitle: loc.title || "",
            locationType: "business_location",
            storefrontUrl: loc.storefrontUrl || "",
            managedEntity: {
              googleBusinessAccountId: loc.accountId || "",
              googleBusinessAccountName: loc.accountName || "",
              title: loc.title || "",
              address: loc.address || "",
              primaryCategory: loc.primaryCategory || "",
            },
            selectedAt: new Date().toISOString(),
          },
        },
        tokenData: {
          accessToken,
          refreshToken,
          tokenType: doc.tokenType || "Bearer",
          expiresIn: tokenExpiresIn,
          scopes: Array.isArray(doc.scopes) ? doc.scopes : [],
        },
      });
      accountRows.push(account);
    }
    doc.status = "consumed";
    await doc.save();
    return successResponse(
      res,
      { accounts: accountRows, count: accountRows.length, flow: doc.flow || "settings" },
      "Google Business Profiles connected successfully."
    );
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to finish Google Business connection.",
      error?.status || 400,
      error?.code || "google_business_select_failed"
    );
  }
}

export async function disconnectGoogleBusinessLocationAccount(req, res) {
  try {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : null;
    const locationId = body?.locationId != null ? String(body.locationId).trim() : "";
    if (!locationId) {
      return errorResponse(res, "locationId is required.", 400, "validation_error");
    }
    const result = await disconnectGoogleBusinessLocation(new ObjectId(req.auth.userId), locationId);
    return successResponse(res, result, "Google Business location disconnected.");
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to disconnect Google Business location.",
      error?.status || 400,
      error?.code || "google_business_disconnect_location_failed"
    );
  }
}

function resolveMetaUpgradeScopes(scopeSet) {
  const normalizedScopeSet = (scopeSet || "all").toString().toLowerCase();
  const scopes = META_UPGRADE_SCOPE_SETS[normalizedScopeSet];
  if (!scopes) {
    const error = new Error("Invalid scope_set. Use pages_show_list, instagram_basic, publishing, insights, or all.");
    error.code = "invalid_scope_set";
    error.status = 400;
    throw error;
  }
  return { normalizedScopeSet, scopes };
}

export async function listSocialAccounts(req, res) {
  try {
    const accounts = await getAccountsForUser(new ObjectId(req.auth.userId));
    return successResponse(res, { accounts }, "Fetched social accounts.");
  } catch (error) {
    return errorResponse(res, "Unable to fetch connected accounts.", 500, error.message);
  }
}

export async function listSocialPostHistory(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const { data, pagination } = await listPostHistoryForUser({ userId, query: req.query });
    return res.status(200).json({
      success: true,
      message: "Post history fetched successfully",
      data,
      pagination,
      error: null,
    });
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to fetch post history.", status, error.code || "history_fetch_failed");
  }
}

export async function connectSocialPlatform(req, res) {
  try {
    const requestedPlatform = req.params.platform;
    const flow = normalizeOAuthFlow(req.query?.flow);
    const { platform, provider } = resolvePlatform(requestedPlatform);
    const providerConfig = validateProviderConfig(platform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${platform} OAuth config is missing required environment variables.`, 400, providerConfig.missing);
    }
    const pkce = platform === "x" ? createPkcePair() : null;
    const state = createOAuthState({
      userId: req.auth.userId,
      platform,
      flow,
      ...(pkce ? { pkceVerifier: pkce.verifier } : {}),
    });
    const authUrl = provider.getAuthUrl(
      state,
      pkce
        ? {
            code_challenge: pkce.challenge,
            code_challenge_method: "S256",
          }
        : {}
    );
    console.info("[oauth:connect:start]", {
      platform,
      flow,
      userId: req.auth.userId,
      callbackPath: `/api/social/${requestedPlatform}/callback`,
      debug: getSafeProviderDebugInfo(platform),
    });
    return successResponse(res, { url: authUrl, state }, "OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:connect:error]", {
      platform: req.params?.platform,
      userId: req.auth?.userId,
      message: error?.message,
    });
    return errorResponse(res, error.message || "Unable to start OAuth flow.", 400, error.message);
  }
}

export async function manualConnectSocialPlatform(req, res) {
  try {
    const requestedPlatform = req.params.platform;
    const { platform, provider } = resolvePlatform(requestedPlatform);
    const capabilities = getPlatformCapabilities(platform);
    if (capabilities?.oauth !== false) {
      return errorResponse(res, `${platform} uses OAuth connect flow.`, 400, "oauth_required");
    }

    const providerConfig = validateProviderConfig(platform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${platform} manual setup is missing required environment variables.`, 400, providerConfig.missing);
    }

    const profile = await provider.getProfile();
    if (!profile?.platformUserId) {
      return errorResponse(res, `Unable to identify ${platform} profile from environment settings.`, 400, "profile_identification_failed");
    }

    const tokenData = {
      accessToken: process.env.TELEGRAM_BOT_TOKEN || "",
      refreshToken: "",
      tokenType: "Bot",
      expiresIn: null,
      scopes: [],
    };

    const account = await upsertConnectedAccount({
      userId: new ObjectId(req.auth.userId),
      platform,
      profile: {
        ...profile,
        entityType: profile.entityType || "bot",
        entityId: profile.entityId || profile.platformUserId,
      },
      tokenData,
    });

    return successResponse(res, { account }, `${platform} connected via manual bot setup.`);
  } catch (error) {
    return errorResponse(res, error.message || "Unable to manually connect platform.", 400, error.message);
  }
}

export async function connectInstagramPlatform(req, res) {
  const flow = normalizeOAuthFlow(req.query?.flow);
  try {
    const provider = getProvider("instagram");
    if (!provider) {
      return errorResponse(res, "Unsupported Meta platform.", 400);
    }
    const providerConfig = validateProviderConfig("instagram");
    if (!providerConfig.valid) {
      return errorResponse(res, "instagram OAuth config is missing required environment variables.", 400, providerConfig.missing);
    }
    const redirectUri = resolveInstagramRedirectUri(req);
    const state = createOAuthState({ userId: req.auth.userId, platform: "instagram", flow, redirectUri });
    const authUrl = provider.getAuthUrl({ state, redirectUri });
    console.info("[oauth:instagram:connect:start]", {
      userId: req.auth.userId,
      flow,
      redirectUri,
      requestHost: req.get("host"),
    });
    return successResponse(res, { url: authUrl, state, redirectUri }, "Instagram OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:instagram:connect:error]", {
      userId: req.auth?.userId,
      message: error?.message,
      code: error?.code,
    });
    return errorResponse(res, error.message || "Unable to start Instagram OAuth flow.", error?.status || 400, error?.code || error.message);
  }
}

export async function connectMetaPlatform(req, res) {
  const requestedMetaPlatform = (req.query?.platform || "facebook").toString().toLowerCase();
  if (requestedMetaPlatform !== "facebook") {
    return errorResponse(
      res,
      "Facebook uses /api/social/meta/connect. Instagram uses its own app credentials via /api/social/instagram/login.",
      400
    );
  }
  const flow = normalizeOAuthFlow(req.query?.flow);
  try {
    const provider = getProvider(requestedMetaPlatform);
    if (!provider) {
      return errorResponse(res, "Unsupported Meta platform.", 400);
    }
    const providerConfig = validateProviderConfig(requestedMetaPlatform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${requestedMetaPlatform} OAuth config is missing required environment variables.`, 400, providerConfig.missing);
    }
    const configId = req.query?.config_id != null ? String(req.query.config_id).trim() : "";
    const state = createOAuthState({ userId: req.auth.userId, platform: requestedMetaPlatform, flow });
    const authUrl = provider.getAuthUrl({ state, configId });
    console.info("[oauth:meta:connect:start]", {
      requestedMetaPlatform,
      flow,
      userId: req.auth.userId,
      hasMetaAppId: Boolean(process.env.META_APP_ID),
      redirectUri: getAppConfig().metaRedirectUri || "missing",
      authMode: configId ? "config_id" : "classic_scope",
      scopes: Array.isArray(provider.defaultScopes) ? provider.defaultScopes.join(",") : "",
    });
    return successResponse(res, { url: authUrl, state }, "Meta OAuth URL generated.");
  } catch (error) {
    console.error("[oauth:meta:connect:error]", {
      requestedMetaPlatform,
      userId: req.auth?.userId,
      message: error?.message,
      code: error?.code,
    });
    return errorResponse(res, error.message || "Unable to start Meta OAuth flow.", error?.status || 400, error?.code || error.message);
  }
}

export async function connectMetaUpgradePlatform(req, res) {
  const requestedMetaPlatform = (req.query?.platform || "facebook").toString().toLowerCase();
  if (requestedMetaPlatform !== "facebook") {
    return errorResponse(res, "Permission upgrade is only supported for Facebook.", 400);
  }

  try {
    const provider = getProvider(requestedMetaPlatform);
    if (!provider?.getAdvancedAuthUrl) {
      return errorResponse(res, "Unsupported Meta provider for permission upgrade.", 400);
    }
    const providerConfig = validateProviderConfig(requestedMetaPlatform);
    if (!providerConfig.valid) {
      return errorResponse(res, `${requestedMetaPlatform} OAuth config is missing required environment variables.`, 400, providerConfig.missing);
    }
    const { normalizedScopeSet, scopes } = resolveMetaUpgradeScopes(req.query?.scope_set);
    const flow = normalizeOAuthFlow(req.query?.flow);
    const state = createOAuthState({ userId: req.auth.userId, platform: requestedMetaPlatform, flow });
    const authUrl = provider.getAdvancedAuthUrl(state, scopes);
    return successResponse(
      res,
      { url: authUrl, state, scopeSet: normalizedScopeSet, scopes },
      "Meta permission upgrade URL generated."
    );
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to start Meta permission upgrade flow.",
      error?.status || 400,
      error?.code || error.message
    );
  }
}

async function handleOAuthCallback(req, res, requestedPlatform) {
  const normalizedPlatform = normalizePlatform(requestedPlatform || "meta");
  const { code, state, error, error_description: errorDescription } = req.query;
  const clientBaseUrl = getClientUrl();

  const makeRedirectUrl = (
    flow,
    status,
    reason = "",
    platform = normalizedPlatform,
    detail = "",
    redirectUri = ""
  ) => {
    const path = getOAuthReturnPath(flow);
    const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    const detailParam = detail ? `&oauth_detail=${encodeURIComponent(detail)}` : "";
    const redirectUriParam = redirectUri
      ? `&oauth_redirect_uri=${encodeURIComponent(redirectUri)}`
      : "";
    return `${clientBaseUrl}${path}?social_platform=${platform}&social_status=${status}${reasonParam}${detailParam}${redirectUriParam}`;
  };

  let flowForRedirect = "settings";
  let platformForRedirect = normalizedPlatform;
  try {
    const decodedState = validateOAuthState(state, requestedPlatform === "meta" ? undefined : normalizedPlatform);
    const statePlatform = normalizePlatform(decodedState.platform);
    const { platform, provider } = resolvePlatform(statePlatform);
    const flow = normalizeOAuthFlow(decodedState?.flow);
    flowForRedirect = flow;
    platformForRedirect = platform;
    if (error) {
      console.error("[oauth:callback:provider-error]", {
        platform,
        flow,
        userId: decodedState?.userId,
        providerError: error,
        providerErrorDescription: errorDescription,
      });
      const providerReason = mapProviderErrorReason(error, errorDescription);
      const { detail, redirectUri } = buildOAuthRedirectParams(platform, providerReason, {
        details: { error_description: errorDescription },
      });
      return res.redirect(makeRedirectUrl(flow, "error", providerReason, platform, detail, redirectUri));
    }
    if (!code) {
      throw new Error("Missing authorization code.");
    }

    if (platform === "googleBusiness" || platform === "youtube") {
      console.info("[oauth:callback:google:exchange]", {
        platform,
        flow,
        userId: decodedState.userId,
        redirectUri: resolveProviderRedirectUri(platform),
        callbackHost: req.get("host"),
      });
    }
    const tokenData = await provider.exchangeCodeForToken(code, {
      ...(platform === "x" && decodedState?.pkceVerifier ? { codeVerifier: decodedState.pkceVerifier } : {}),
      ...(platform === "x" ? { useBasicClientAuth: true } : {}),
      ...(platform === "instagram" && decodedState?.redirectUri
        ? { redirectUri: decodedState.redirectUri }
        : {}),
    });
    if (!tokenData?.accessToken) {
      throw new Error("No access token received from provider.");
    }
    if (META_PLATFORMS.has(platform)) {
      const userProfile = await provider.getUserProfile(tokenData.accessToken);
      if (!userProfile?.platformUserId) {
        throw new Error("Unable to identify Facebook account from Meta profile.");
      }

      let pages = [];
      let pageDiscoveryErrorCode = null;
      try {
        pages = await provider.getPages(tokenData.accessToken);
      } catch (pagesError) {
        pageDiscoveryErrorCode = pagesError?.code || "meta_pages_unavailable";
        console.warn("[oauth:facebook:pages-discovery]", {
          userId: decodedState.userId,
          message: pagesError?.message,
          code: pagesError?.code,
        });
      }

      const sessionProfile = {
        id: String(userProfile.platformUserId || "").trim(),
        name: userProfile.accountName || "",
        email: userProfile.email || "",
        category: "Personal profile",
        pictureUrl: userProfile.profileImage || "",
      };

      if (!sessionProfile.id) {
        throw new Error("Unable to identify Facebook account from Meta profile.");
      }

      if (!pages.length) {
        console.warn("[oauth:facebook:no-pages]", {
          userId: decodedState.userId,
          code: pageDiscoveryErrorCode || "no_facebook_pages",
        });
      }

      const encUserAccess = encryptToken(tokenData.accessToken || "");
      if (!encUserAccess) {
        const tokenErr = new Error("Token encryption failed.");
        tokenErr.code = "token_encryption_failed";
        tokenErr.status = 500;
        throw tokenErr;
      }

      // Create short-lived server-side session storing profile + pages + encrypted tokens; frontend only receives session id.
      const sessionPages = pages
        .map((page) => {
          const pid = page?.id != null ? String(page.id) : "";
          if (!pid) return null;
          const encToken = page?.access_token ? encryptToken(page.access_token) : null;
          if (page?.access_token && !encToken) {
            const tokenErr = new Error("Token encryption failed.");
            tokenErr.code = "token_encryption_failed";
            tokenErr.status = 500;
            throw tokenErr;
          }
          return {
            id: pid,
            name: page?.name || "",
            category: page?.category || "",
            pictureUrl: page?.picture?.data?.url || page?.picture?.url || "",
            pageAccessTokenEnc: encToken,
            instagram_business_account: page?.instagram_business_account
              ? {
                  id: page.instagram_business_account?.id ? String(page.instagram_business_account.id) : "",
                  username: page.instagram_business_account?.username || "",
                  name: page.instagram_business_account?.name || "",
                  profile_picture_url: page.instagram_business_account?.profile_picture_url || "",
                }
              : null,
          };
        })
        .filter(Boolean);

      if (platform === "instagram") {
        const instagramAccounts = [];
        for (const page of sessionPages) {
          const ig = page?.instagram_business_account;
          if (!ig?.id) continue;
          let accountType = "business";
          try {
            const details = await provider.getInstagramAccountDetails(tokenData.accessToken, ig.id);
            accountType = String(details?.account_type || "business").toLowerCase();
          } catch (detailsError) {
            console.warn("[oauth:instagram:details-warning]", {
              userId: decodedState.userId,
              pageId: page.id,
              igId: ig.id,
              message: detailsError?.message,
            });
          }
          instagramAccounts.push({
            instagramAccountId: String(ig.id || "").trim(),
            username: ig.username || "",
            name: ig.name || "",
            profilePicture: ig.profile_picture_url || "",
            accountType: accountType === "creator" ? "creator" : "business",
            linkedPageId: page.id || "",
            linkedPageName: page.name || "",
            pageCategory: page.category || "",
          });
        }

        if (!instagramAccounts.length) {
          const noInstagram = new Error("No linked Instagram professional account found.");
          noInstagram.code = "no_instagram_professional_account";
          noInstagram.status = 400;
          throw noInstagram;
        }

        const session = await SocialOAuthSession.create({
          userId: new ObjectId(decodedState.userId),
          platform: "instagram",
          flow,
          providerUserId: String(userProfile.platformUserId || ""),
          tokenType: tokenData.tokenType || "Bearer",
          scopes: Array.isArray(tokenData.scopes) ? tokenData.scopes : [],
          expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
          payload: {
            metaUser: {
              id: String(userProfile.platformUserId || ""),
              name: userProfile.accountName || "",
              email: userProfile.email || "",
            },
            pageDiscoveryErrorCode,
            pages: sessionPages,
            instagramAccounts,
          },
        });

        return res.redirect(
          `${clientBaseUrl}/connect/instagram/accounts?session=${encodeURIComponent(session._id.toString())}`
        );
      }

      const session = await SocialOAuthSession.create({
        userId: new ObjectId(decodedState.userId),
        platform: "facebook",
        flow,
        providerUserId: String(userProfile.platformUserId || ""),
        tokenType: tokenData.tokenType || "Bearer",
        scopes: Array.isArray(tokenData.scopes) ? tokenData.scopes : [],
        expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
        accessTokenEnc: encUserAccess,
        payload: {
          pageDiscoveryErrorCode,
          profile: sessionProfile,
          pages: sessionPages,
        },
      });

      console.info("[oauth:facebook:pages-session]", {
        userId: decodedState.userId,
        flow,
        sessionId: session?._id?.toString?.(),
        profileId: sessionProfile.id,
        pageCount: sessionPages.length,
      });

      return res.redirect(`${clientBaseUrl}/connect/facebook/pages?session=${encodeURIComponent(session._id.toString())}`);
    } else {
      const profile = await provider.getProfile(tokenData.accessToken);
      if (!profile?.platformUserId) {
        throw new Error("Unable to identify social account from provider profile.");
      }

      if (platform === "linkedin") {
        let managedEntities = [];
        let organizationDiscoveryErrorCode = null;
        if (typeof provider.getManagedEntities === "function") {
          try {
            managedEntities = await provider.getManagedEntities(tokenData.accessToken, profile);
          } catch (discoveryError) {
            const code = discoveryError?.code;
            if (code === "linkedin_orgs_forbidden" || code === "linkedin_orgs_failed") {
              organizationDiscoveryErrorCode = code;
              console.warn("[oauth:callback:linkedin-orgs]", {
                userId: decodedState.userId,
                code,
                message: discoveryError?.message,
              });
            } else {
              throw discoveryError;
            }
          }
        }

        const destinations = [
          {
            type: "profile",
            platform: "linkedin",
            id: String(profile.platformUserId || ""),
            name: profile.accountName || "",
            avatar: profile.profileImage || "",
            email: profile.email || "",
            canPost: true,
            permissionStatus: "granted",
          },
          ...(Array.isArray(managedEntities)
            ? managedEntities
                .map((e) => {
                  const oid = e?.entityId != null ? String(e.entityId).trim() : "";
                  if (!oid) return null;
                  const role = e?.metadata?.role || "";
                  return {
                    type: "organization",
                    platform: "linkedin",
                    id: oid,
                    name: e?.name || `Organization ${oid}`,
                    avatar: e?.profileImage || "",
                    email: "",
                    role,
                    canPost: true,
                    permissionStatus: role ? `admin: ${role}` : "admin",
                  };
                })
                .filter(Boolean)
            : []),
        ];

        const encAccess = encryptToken(tokenData.accessToken || "");
        const encRefresh = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : "";
        if (!encAccess) {
          const tokenErr = new Error("Token encryption failed.");
          tokenErr.code = "token_encryption_failed";
          tokenErr.status = 500;
          throw tokenErr;
        }

        const orgWarning =
          organizationDiscoveryErrorCode === "linkedin_orgs_forbidden" || organizationDiscoveryErrorCode === "linkedin_orgs_failed"
            ? "LinkedIn organization pages require additional LinkedIn permissions or approval."
            : "";

        const session = await SocialOAuthSession.create({
          userId: new ObjectId(decodedState.userId),
          platform: "linkedin",
          flow,
          providerUserId: String(profile.platformUserId || ""),
          tokenType: tokenData.tokenType || "Bearer",
          scopes: Array.isArray(tokenData.scopes) ? tokenData.scopes : [],
          expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
          accessTokenEnc: encAccess,
          refreshTokenEnc: encRefresh,
          payload: {
            organizationDiscoveryErrorCode,
            orgWarning,
            destinations,
          },
        });

        console.info("[oauth:linkedin:accounts-session]", {
          userId: decodedState.userId,
          flow,
          sessionId: session?._id?.toString?.(),
          destinationCount: destinations.length,
          orgCount: destinations.filter((d) => d.type === "organization").length,
          orgErrorCode: organizationDiscoveryErrorCode || undefined,
        });

        return res.redirect(
          `${clientBaseUrl}/connect/linkedin/accounts?session=${encodeURIComponent(session._id.toString())}`
        );
      }

      if (platform === "googleBusiness") {
        const encAccess = encryptToken(tokenData.accessToken || "");
        const encRefresh = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : "";
        if (!encAccess) {
          const tokenErr = new Error("Token encryption failed.");
          tokenErr.code = "token_encryption_failed";
          tokenErr.status = 500;
          throw tokenErr;
        }

        const googleUser = {
          id: String(profile.platformUserId || ""),
          email: profile.email || "",
          name: profile.accountName || "",
          avatar: profile.profileImage || "",
        };

        // Store tokens on profile row so refresh works even if the user has zero GBP locations.
        await upsertConnectedAccount({
          userId: new ObjectId(decodedState.userId),
          platform: "googleBusiness",
          profile: {
            ...profile,
            entityType: "profile",
            entityId: profile.entityId || profile.platformUserId,
            isPrimary: true,
            metadata: {
              ...(profile.metadata || {}),
              capabilities: ["posting", "analytics", "business-updates"],
            },
          },
          tokenData,
        });

        // Defer Google Business API calls to the location-select page (avoids burst quota on OAuth callback).
        const session = await SocialOAuthSession.create({
          userId: new ObjectId(decodedState.userId),
          platform: "googleBusiness",
          provider: "google_business",
          flow,
          providerUserId: String(profile.platformUserId || ""),
          tokenType: tokenData.tokenType || "Bearer",
          scopes: Array.isArray(tokenData.scopes) ? tokenData.scopes : [],
          expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
          accessTokenEnc: encAccess,
          refreshTokenEnc: encRefresh,
          payload: {
            provider: "google_business",
            googleUser,
            accounts: [],
            locations: [],
          },
        });

        return res.redirect(
          `${clientBaseUrl}/connect/google-business/locations?session=${encodeURIComponent(session._id.toString())}`
        );
      }

      let managedEntities = [];
      let organizationDiscoveryErrorCode = null;
      if (typeof provider.getManagedEntities === "function") {
        try {
          managedEntities = await provider.getManagedEntities(tokenData.accessToken, profile);
        } catch (discoveryError) {
          const code = discoveryError?.code;
          if (
            platform === "linkedin" &&
            (code === "linkedin_orgs_forbidden" || code === "linkedin_orgs_failed")
          ) {
            organizationDiscoveryErrorCode = code;
            console.warn("[oauth:callback:linkedin-orgs]", {
              userId: decodedState.userId,
              code,
              message: discoveryError?.message,
            });
          } else {
            throw discoveryError;
          }
        }
      }

      await upsertConnectedAccount({
        userId: new ObjectId(decodedState.userId),
        platform,
        profile: {
          ...profile,
          entityType: profile.entityType || "profile",
          entityId: profile.entityId || profile.platformUserId,
          metadata: {
            ...(profile.metadata || {}),
            ...(organizationDiscoveryErrorCode ? { organizationDiscoveryErrorCode } : {}),
          },
        },
        tokenData,
      });

      if (Array.isArray(managedEntities) && managedEntities.length) {
        for (const entity of managedEntities) {
          if (!entity?.entityId) continue;
          await upsertConnectedAccount({
            userId: new ObjectId(decodedState.userId),
            platform,
            profile: {
              platformUserId: profile.platformUserId,
              entityType: entity.entityType || "page",
              entityId: entity.entityId,
              accountName: entity.name || profile.accountName || "",
              username: profile.username || "",
              email: profile.email || "",
              profileImage: entity.profileImage || entity.metadata?.pictureUrl || "",
              capabilities: profile.capabilities || profile?.metadata?.capabilities || [],
              metadata: {
                ...profile.metadata,
                managedEntity: entity,
              },
              isPrimary: false,
            },
            tokenData,
          });
        }
      }
    }
    console.info("[oauth:callback:result]", {
      platform,
      flow,
      userId: decodedState.userId,
      status: "connected",
    });
    return res.redirect(makeRedirectUrl(flow, "connected", "", platform));
  } catch (callbackError) {
    const callbackReason = mapCallbackReason(callbackError);
    const { detail, redirectUri } = buildOAuthRedirectParams(
      platformForRedirect,
      callbackReason,
      callbackError
    );
    console.error("[oauth:callback:error]", {
      platform: platformForRedirect,
      message: callbackError?.message,
      code: callbackError?.code,
      oauthRedirectUri: redirectUri || undefined,
      oauthDetail: detail || undefined,
      graphCode: callbackError?.details?.error,
      graphDescription: callbackError?.details?.error_description,
    });
    console.info("[oauth:callback:result]", {
      platform: platformForRedirect,
      flow: flowForRedirect,
      status: "error",
      code: callbackError?.code || "oauth_callback_failed",
    });
    return res.redirect(
      makeRedirectUrl(flowForRedirect, "error", callbackReason, platformForRedirect, detail, redirectUri)
    );
  }
}

export async function oauthCallback(req, res) {
  return handleOAuthCallback(req, res, req.params.platform);
}

export async function googleBusinessOauthCallback(req, res) {
  return handleOAuthCallback(req, res, "googleBusiness");
}

export async function metaOauthCallback(req, res) {
  return handleOAuthCallback(req, res, "meta");
}

export async function instagramOauthCallback(req, res) {
  return handleOAuthCallback(req, res, "instagram");
}

export async function disconnectSocialPlatform(req, res) {
  try {
    const { platform } = req.params;
    const { provider, platform: normalizedPlatform } = resolvePlatform(platform);
    await provider.disconnectAccount();
    const account = await disconnectAccount(new ObjectId(req.auth.userId), normalizedPlatform);
    return successResponse(res, { account }, `${normalizedPlatform} disconnected.`);
  } catch (error) {
    return errorResponse(res, error.message || "Unable to disconnect account.", 400, error.message);
  }
}

export async function disconnectSocialAccountEntity(req, res) {
  try {
    const { platform } = req.params;
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const accountId = body.accountId != null ? String(body.accountId).trim() : "";
    if (!accountId) {
      return errorResponse(res, "accountId is required.", 400, "validation_error");
    }

    const { provider, platform: normalizedPlatform } = resolvePlatform(platform);
    const result = await disconnectAccountById(new ObjectId(req.auth.userId), accountId);

    if (!result.isConnected) {
      try {
        await provider.disconnectAccount();
      } catch (providerError) {
        console.warn("[social:disconnect-account:provider]", {
          platform: normalizedPlatform,
          message: providerError?.message,
        });
      }
    }

    const accounts = await getAccountsForUser(new ObjectId(req.auth.userId));
    const grouped = accounts.find((item) => item.platform === normalizedPlatform) || {
      platform: normalizedPlatform,
      isConnected: result.isConnected,
    };

    return successResponse(res, { account: grouped, ...result }, "Account disconnected.");
  } catch (error) {
    return errorResponse(
      res,
      error.message || "Unable to disconnect account.",
      error?.status || 400,
      error?.code || error.message
    );
  }
}

export async function refreshSocialPlatform(req, res) {
  try {
    const { platform } = req.params;
    const { provider, platform: normalizedPlatform } = resolvePlatform(platform);
    const account = await getStoredAccountForProvider(new ObjectId(req.auth.userId), normalizedPlatform);
    if (!account) {
      return errorResponse(res, "No connected account found.", 404, "Account not found.");
    }
    const refreshed = await provider.refreshTokenIfNeeded(account);
    if (!refreshed) {
      const status = await getAccountStatus(new ObjectId(req.auth.userId), normalizedPlatform);
      return successResponse(res, { account: status, refreshed: false }, "Token still valid.");
    }
    const status = await refreshAccountToken(new ObjectId(req.auth.userId), normalizedPlatform, refreshed);
    return successResponse(res, { account: status, refreshed: true }, "Token refreshed.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to refresh token.", 400, error.message);
  }
}

export async function socialPlatformStatus(req, res) {
  try {
    const { platform } = req.params;
    resolvePlatform(platform);
    const account = await getAccountStatus(new ObjectId(req.auth.userId), platform);
    return successResponse(res, { account }, "Fetched platform status.");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to fetch status.", 400, error.message);
  }
}

const X_POST_MAX_LENGTH = 280;

/** Prefer X's detail for quota/billing; 401/403 alone often misread as "reconnect". */
function messageForXPostApiError(apiError) {
  const raw = typeof apiError?.message === "string" ? apiError.message.trim() : "";
  const lower = raw.toLowerCase();
  const quotaOrBilling =
    lower.includes("credit") ||
    lower.includes("billing") ||
    lower.includes("subscription") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("per month");
  const oauthStyle = apiError?.status === 401 || (apiError?.status === 403 && !quotaOrBilling);
  if (oauthStyle) {
    return "X account is not connected or token expired. Please reconnect your X account.";
  }
  return raw || "Could not publish post on X.";
}

function parseXContent(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }
  const { content } = body;
  if (content === undefined || content === null) {
    const err = new Error("Post content is required.");
    err.status = 400;
    throw err;
  }
  if (typeof content !== "string") {
    const err = new Error("Post content must be a string.");
    err.status = 400;
    throw err;
  }
  if (content.length > 4096) {
    const err = new Error(`Post content cannot exceed ${X_POST_MAX_LENGTH} characters.`);
    err.status = 400;
    throw err;
  }
  const trimmed = content.trim();
  if (!trimmed.length) {
    const err = new Error("Post content cannot be empty.");
    err.status = 400;
    throw err;
  }
  if (trimmed.length > X_POST_MAX_LENGTH) {
    const err = new Error(`Post content cannot exceed ${X_POST_MAX_LENGTH} characters.`);
    err.status = 400;
    throw err;
  }
  return trimmed;
}

export async function createXPost(req, res) {
  let content;
  try {
    content = parseXContent(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);

  try {
    const account = await getStoredAccountForProvider(userId, "x");
    if (!account || !account.isConnected) {
      return errorResponse(
        res,
        "X account is not connected or token expired. Please reconnect your X account.",
        401,
        "not_connected"
      );
    }

    const { provider } = resolvePlatform("x");
    if (typeof provider.createTweet !== "function") {
      return errorResponse(res, "X publishing is not available.", 500, "provider_error");
    }

    let accessToken = account.getDecryptedAccessToken();
    if (!accessToken) {
      return errorResponse(
        res,
        "X account is not connected or token expired. Please reconnect your X account.",
        401,
        "no_token"
      );
    }

    const tokenExpired = account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
    if (tokenExpired) {
      try {
        const refreshed = await provider.refreshTokenIfNeeded(account);
        if (refreshed) {
          await refreshAccountToken(userId, "x", refreshed);
          accessToken = refreshed.accessToken;
        }
      } catch (refreshError) {
        console.error("[x:post:refresh:error]", { message: refreshError?.message, code: refreshError?.code });
        return errorResponse(
          res,
          refreshError.message || "X account is not connected or token expired. Please reconnect your X account.",
          refreshError.status || 401,
          refreshError.code || "token_refresh_failed"
        );
      }
    }

    if (!accessToken) {
      return errorResponse(
        res,
        "X account is not connected or token expired. Please reconnect your X account.",
        401,
        "no_token"
      );
    }

    let tweetData;
    let retriedUnauthorized = false;
    for (;;) {
      try {
        tweetData = await provider.createTweet(accessToken, content);
        break;
      } catch (apiError) {
        const canRetry =
          apiError.code === "x_unauthorized" &&
          !retriedUnauthorized &&
          typeof account.getDecryptedRefreshToken === "function" &&
          account.getDecryptedRefreshToken();
        if (canRetry) {
          retriedUnauthorized = true;
          try {
            const refreshed = await provider.refreshTokenIfNeeded({
              expiresAt: new Date(0),
              getDecryptedRefreshToken: () => account.getDecryptedRefreshToken(),
            });
            if (refreshed) {
              await refreshAccountToken(userId, "x", refreshed);
              accessToken = refreshed.accessToken;
              continue;
            }
          } catch (retryRefreshError) {
            console.error("[x:post:retry-refresh:error]", { message: retryRefreshError?.message });
          }
        }
        console.error("[x:post:api:error]", {
          message: apiError?.message,
          code: apiError?.code,
          status: apiError?.status,
        });
        const clientMessage = messageForXPostApiError(apiError);
        return errorResponse(res, clientMessage, apiError.status >= 400 && apiError.status < 600 ? apiError.status : 502, apiError.code || "x_post_failed");
      }
    }

    const postId = tweetData?.data?.id ? String(tweetData.data.id) : "";
    const safePayload = {
      id: tweetData?.data?.id ? String(tweetData.data.id) : undefined,
      text: typeof tweetData?.data?.text === "string" ? tweetData.data.text : undefined,
    };

    await recordSuccessfulPublish({
      userId,
      platform: "x",
      platformAccountId: String(account.platformUserId || ""),
      platformAccountName: account.accountName || account.username || "",
      targetType: "profile",
      targetId: String(account.platformUserId || ""),
      targetName: account.username || account.accountName || "",
      content,
      mediaType: "TEXT",
      mediaUrl: "",
      linkUrl: "",
      externalPostId: postId,
      externalPostUrl: postId ? `https://x.com/i/web/status/${encodeURIComponent(postId)}` : "",
      apiSnapshot: safePayload,
    });

    return successResponse(
      res,
      { postId, data: safePayload },
      "Post published successfully on X"
    );
  } catch (error) {
    console.error("[x:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish post on X.", 500, error.code || "x_post_error");
  }
}

const LINKEDIN_POST_MAX_LENGTH = 3000;
const LINKEDIN_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const LINKEDIN_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function assertLinkedInMediaFile(mediaTypeRaw, file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const err = new Error(
      'A media file is required for image and video posts. Send multipart/form-data with field "media".'
    );
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  const mime = (file.mimetype || "").toLowerCase();
  if (mediaTypeRaw === "IMAGE") {
    const ok = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
    if (!ok) {
      const err = new Error("Image must be JPG, PNG, GIF, or WebP.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (file.size > LINKEDIN_IMAGE_MAX_BYTES) {
      const err = new Error("Image exceeds maximum size (15MB).");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else if (mediaTypeRaw === "VIDEO") {
    const ok = ["video/mp4", "video/quicktime"].includes(mime);
    if (!ok) {
      const err = new Error("Video must be MP4 or MOV.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (file.size > LINKEDIN_VIDEO_MAX_BYTES) {
      const err = new Error("Video exceeds maximum size (100MB).");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }
}

function parseLinkedInPostBody(body, file = null) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }

  const targetType = typeof body.targetType === "string" ? body.targetType.trim().toLowerCase() : "";
  if (!targetType) {
    const err = new Error("targetType is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (!["profile", "organization"].includes(targetType)) {
    const err = new Error("targetType must be profile or organization.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  let organizationId = null;
  if (body.organizationId !== undefined && body.organizationId !== null && body.organizationId !== "") {
    organizationId = String(body.organizationId).trim();
  }

  if (targetType === "organization") {
    if (!organizationId) {
      const err = new Error("organizationId is required for organization posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!/^\d+$/.test(organizationId)) {
      const err = new Error("organizationId must be a numeric LinkedIn organization ID.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else if (organizationId) {
    const err = new Error("organizationId must be omitted when targetType is profile.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const mediaTypeRaw = typeof body.mediaType === "string" ? body.mediaType.trim().toUpperCase() : "TEXT";
  if (!["TEXT", "IMAGE", "VIDEO", "LINK"].includes(mediaTypeRaw)) {
    const err = new Error("mediaType must be one of: TEXT, IMAGE, VIDEO, LINK.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const content =
    typeof body.content === "string" ? body.content.trim() : body.content != null ? String(body.content).trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";

  if (file?.buffer && mediaTypeRaw !== "IMAGE" && mediaTypeRaw !== "VIDEO") {
    const err = new Error("Remove the media file when posting text or link content only.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO") {
    if (mediaUrl) {
      const err = new Error('Remote mediaUrl is not supported. Upload a file using multipart field "media".');
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    assertLinkedInMediaFile(mediaTypeRaw, file);
  } else if (mediaUrl) {
    const err = new Error("Media URL is not supported for LinkedIn text or link posts.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "LINK") {
    if (!linkUrl) {
      const err = new Error("linkUrl is required for link posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(linkUrl)) {
      const err = new Error("linkUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else if (mediaTypeRaw === "TEXT") {
    if (linkUrl) {
      const err = new Error("linkUrl is only allowed when mediaType is LINK.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!content) {
      const err = new Error("Post content is required for text posts and cannot be only spaces.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else {
    if (linkUrl) {
      const err = new Error("linkUrl is only allowed when mediaType is LINK.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  const hasPayload =
    Boolean(content || linkUrl || mediaUrl) || mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO";
  if (!hasPayload) {
    const err = new Error("Either content, mediaUrl, or linkUrl is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (content.length > LINKEDIN_POST_MAX_LENGTH) {
    const err = new Error(`Post content cannot exceed ${LINKEDIN_POST_MAX_LENGTH} characters.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  return {
    targetType,
    organizationId: targetType === "organization" ? organizationId : null,
    mediaType: mediaTypeRaw,
    content,
    linkUrl: mediaTypeRaw === "LINK" ? linkUrl : "",
  };
}

const FACEBOOK_MESSAGE_MAX = 63206;

function inferFacebookMediaTypeFromUrl(mediaUrl) {
  const u = String(mediaUrl || "").toLowerCase();
  if (/\.(mp4|mov|webm|m4v|avi)(\?|#|$)/i.test(u)) return "VIDEO";
  if (/\.(jpe?g|png|gif|webp|bmp|heic)(\?|#|$)/i.test(u)) return "IMAGE";
  return null;
}

function normalizeFacebookMediaType(mediaType, mediaUrl) {
  if (!mediaUrl || mediaType === "TEXT" || mediaType === "LINK") return mediaType;
  const inferred = inferFacebookMediaTypeFromUrl(mediaUrl);
  if (!inferred) return mediaType;
  if (mediaType === "IMAGE" && inferred === "VIDEO") return "VIDEO";
  if (mediaType === "VIDEO" && inferred === "IMAGE") return "IMAGE";
  return mediaType;
}

function assertFacebookMediaUrlReachable(mediaUrl) {
  if (!mediaUrl) return;
  let host = "";
  try {
    host = new URL(mediaUrl).hostname.toLowerCase();
  } catch {
    const err = new Error("mediaUrl must be a valid http(s) URL.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    const err = new Error(
      "Media URL must be publicly reachable by Facebook. Set APP_BASE_URL (or VITE_APP_URL) to your public HTTPS domain—not localhost—and upload again."
    );
    err.status = 400;
    err.code = "media_not_public";
    throw err;
  }
}

function parseFacebookPostBody(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }

  const mediaTypeRaw = typeof body.mediaType === "string" ? body.mediaType.trim().toUpperCase() : "";
  if (!mediaTypeRaw || !["TEXT", "IMAGE", "VIDEO", "LINK"].includes(mediaTypeRaw)) {
    const err = new Error("mediaType is required and must be one of: TEXT, IMAGE, VIDEO, LINK.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (typeof body.message !== "string" && body.message != null) {
    const err = new Error("message must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.mediaUrl !== "string" && body.mediaUrl != null) {
    const err = new Error("mediaUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.linkUrl !== "string" && body.linkUrl != null) {
    const err = new Error("linkUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";
  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";
  const entityType =
    typeof body.entityType === "string" ? body.entityType.trim().toLowerCase() : "";
  if (entityType && entityType !== "page") {
    const err = new Error("entityType must be page when provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (message.length > FACEBOOK_MESSAGE_MAX) {
    const err = new Error(`message cannot exceed ${FACEBOOK_MESSAGE_MAX} characters.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (body.message != null && typeof body.message === "string" && body.message.length > 0 && !message.length) {
    const err = new Error("message cannot be only spaces.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "TEXT") {
    if (mediaUrl || linkUrl) {
      const err = new Error("mediaUrl and linkUrl must be empty when mediaType is TEXT.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!message) {
      const err = new Error("message is required for text posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "LINK") {
    if (mediaUrl) {
      const err = new Error("mediaUrl is not used for link posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!linkUrl) {
      const err = new Error("linkUrl is required for link posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(linkUrl)) {
      const err = new Error("linkUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO") {
    if (linkUrl) {
      const err = new Error("linkUrl must be empty for image or video posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!mediaUrl) {
      const err = new Error(`mediaUrl is required for ${mediaTypeRaw.toLowerCase()} posts.`);
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(mediaUrl)) {
      const err = new Error("mediaUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  const hasPayload = Boolean(message || mediaUrl || linkUrl);
  if (!hasPayload) {
    const err = new Error("Either message, mediaUrl, or linkUrl is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  return {
    mediaType: mediaTypeRaw,
    message,
    mediaUrl: mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO" ? mediaUrl : "",
    linkUrl: mediaTypeRaw === "LINK" ? linkUrl : "",
    entityId,
    entityType,
  };
}

export async function createFacebookPost(req, res) {
  let parsed;
  try {
    parsed = parseFacebookPostBody(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "Facebook is not connected or token expired. Please reconnect Facebook.";

  if (parsed.entityType === "profile") {
    return errorResponse(
      res,
      "Personal Facebook profiles are not supported. Post to a connected Facebook Page.",
      400,
      "facebook_profile_not_supported"
    );
  }

  parsed.mediaType = normalizeFacebookMediaType(parsed.mediaType, parsed.mediaUrl);
  if (parsed.mediaUrl) {
    try {
      assertFacebookMediaUrlReachable(parsed.mediaUrl);
    } catch (validationError) {
      return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
    }
  }

  try {
    let ctx = await resolveFacebookPublishCredentials(userId, parsed.entityId, parsed.entityType);
    if (!ctx.ok) {
      if (ctx.code === "not_connected" || ctx.code === "token_missing") {
        return errorResponse(res, reconnectMessage, 401, ctx.code);
      }
      return errorResponse(res, "Invalid Facebook Page destination. Reconnect the Page under Channels.", 400, ctx.code);
    }

    if (ctx.targetType !== "page") {
      return errorResponse(
        res,
        "Invalid Facebook Page destination. Reconnect a Facebook Page under Channels.",
        400,
        "invalid_page"
      );
    }

    let { account, accessToken, targetType, pageId, platformAccountId, targetName } = ctx;

    if (
      (parsed.mediaType === "IMAGE" || parsed.mediaType === "VIDEO") &&
      parsed.mediaUrl &&
      !isAppHostedUploadUrl(parsed.mediaUrl)
    ) {
      try {
        parsed.mediaUrl = await ingestRemoteUrlToUploads(parsed.mediaUrl);
      } catch (ingestErr) {
        console.error("[facebook:post:ingest:error]", { message: ingestErr?.message });
        return errorResponse(
          res,
          ingestErr?.message || "Could not download media from that URL.",
          502,
          "remote_ingest_failed"
        );
      }
    }

    const runPublish = async (token) => {
      if (parsed.mediaType === "IMAGE" && parsed.mediaUrl) {
        const { buffer, mime } = await loadMediaBufferFromUrl(parsed.mediaUrl);
        return publishFacebookPhotoFromBuffer({
          targetType: "page",
          pageId,
          pageAccessToken: token,
          buffer,
          mime,
          message: parsed.message,
        });
      }

      return publishFacebookPagePost({
        pageId,
        pageAccessToken: token,
        mediaType: parsed.mediaType,
        message: parsed.message,
        mediaUrl: parsed.mediaUrl,
        linkUrl: parsed.linkUrl,
      });
    };

    let result;
    try {
      result = await runPublish(accessToken);
    } catch (apiError) {
      console.error("[facebook:post:api:error]", {
        message: apiError?.message,
        code: apiError?.code,
        status: apiError?.status,
        targetType,
        pageId: pageId || undefined,
      });

      if (isMetaTokenAuthError(apiError)) {
        try {
          const pageToken = await refreshFacebookPageAccessToken(userId, pageId, facebookService);
          if (pageToken) {
            result = await runPublish(pageToken);
          } else {
            return errorResponse(res, reconnectMessage, 401, "token_expired");
          }
        } catch (retryErr) {
          console.warn("[facebook:post:retry-refresh-failed]", { message: retryErr?.message });
          return errorResponse(res, reconnectMessage, 401, "token_expired");
        }
      } else {
        const clientMessage = apiError.message || "Could not publish post on Facebook.";
        return errorResponse(
          res,
          clientMessage,
          apiError.status >= 400 && apiError.status < 600 ? apiError.status : 502,
          apiError.code || "facebook_post_failed"
        );
      }
    }

    const safeRaw = result.raw && typeof result.raw === "object" ? result.raw : {};

    await recordSuccessfulPublish({
      userId,
      platform: "facebook",
      platformAccountId,
      platformAccountName: account.accountName || account.username || "",
      targetType,
      targetId: platformAccountId,
      targetName,
      content: parsed.message || "",
      mediaType: parsed.mediaType,
      mediaUrl: parsed.mediaUrl || "",
      linkUrl: parsed.linkUrl || "",
      externalPostId: result.postId,
      externalPostUrl: result.postId ? `https://www.facebook.com/${encodeURIComponent(result.postId)}` : "",
      apiSnapshot: safeRaw,
    });

    return successResponse(res, { postId: result.postId, data: safeRaw }, "Post published successfully on Facebook");
  } catch (error) {
    console.error("[facebook:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish post on Facebook.", 500, error.code || "facebook_post_error");
  }
}

const YOUTUBE_TITLE_MAX = 100;
const YOUTUBE_DESC_MAX = 5000;

function youtubeValidationError(message, code = "validation_error") {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

function parseYouTubeMultipartBoolean(value) {
  if (value === true || value === false) return { ok: true, value };
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return { ok: true, value: true };
  if (s === "false" || s === "0" || s === "no") return { ok: true, value: false };
  return { ok: false, value: false };
}

function parseYouTubeVideoPostRequest(body, file) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    throw youtubeValidationError("Invalid request body.", "invalid_body");
  }
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw youtubeValidationError('Video file is required (multipart field "video").', "validation_error");
  }
  const mime = (file.mimetype || "").toLowerCase();
  if (!mime.startsWith("video/")) {
    throw youtubeValidationError("Video MIME type must start with video/.", "validation_error");
  }

  const channelIdRaw = body.channelId != null && body.channelId !== "" ? String(body.channelId).trim() : "";

  const titleRaw = typeof body.title === "string" ? body.title : body.title != null ? String(body.title) : "";
  const title = titleRaw.trim();
  if (!title) {
    throw youtubeValidationError("Title is required and cannot be only spaces.", "validation_error");
  }
  if (title.length > YOUTUBE_TITLE_MAX) {
    throw youtubeValidationError(`Title cannot exceed ${YOUTUBE_TITLE_MAX} characters.`, "validation_error");
  }

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : body.description != null
        ? String(body.description).trim()
        : "";
  if (description.length > YOUTUBE_DESC_MAX) {
    throw youtubeValidationError(`Description cannot exceed ${YOUTUBE_DESC_MAX} characters.`, "validation_error");
  }

  let categoryId = "22";
  if (body.categoryId !== undefined && body.categoryId !== null && String(body.categoryId).trim() !== "") {
    categoryId = String(body.categoryId).trim();
    if (!/^\d{1,6}$/.test(categoryId)) {
      throw youtubeValidationError("categoryId must be a numeric YouTube category id.", "validation_error");
    }
  }

  const privacyRaw = typeof body.privacyStatus === "string" ? body.privacyStatus.trim().toLowerCase() : "";
  if (!["public", "private", "unlisted"].includes(privacyRaw)) {
    throw youtubeValidationError("privacyStatus must be public, private, or unlisted.", "validation_error");
  }

  if (!Object.prototype.hasOwnProperty.call(body, "madeForKids")) {
    throw youtubeValidationError("madeForKids is required.", "validation_error");
  }
  const mf = parseYouTubeMultipartBoolean(body.madeForKids);
  if (!mf.ok) {
    throw youtubeValidationError("madeForKids must be a boolean.", "validation_error");
  }

  const tagsStr = typeof body.tags === "string" ? body.tags : body.tags != null ? String(body.tags) : "";
  const tags = tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((t) => (t.length > 30 ? t.slice(0, 30) : t));

  return {
    channelIdRaw,
    title,
    description,
    categoryId,
    privacyStatus: privacyRaw,
    madeForKids: mf.value,
    tags,
    mimeType: mime,
  };
}

function mapYouTubeClientError(err) {
  const apiMsg = err?.response?.data?.error?.message;
  const message = typeof apiMsg === "string" && apiMsg ? apiMsg : err?.message || "YouTube upload failed.";
  const status = Number(err?.response?.status);
  const httpStatus = Number.isFinite(status) && status >= 400 && status < 600 ? status : 502;
  return { message, httpStatus, code: "youtube_upload_failed" };
}

function isYouTubeUnauthorized(err) {
  const s = Number(err?.response?.status);
  return s === 401 || s === 403;
}

export async function createYouTubePost(req, res) {
  let parsed;
  try {
    parsed = parseYouTubeVideoPostRequest(req.body, req.file || null);
  } catch (validationError) {
    return errorResponse(
      res,
      validationError.message,
      validationError.status || 400,
      validationError.code || "validation_error"
    );
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "YouTube is not connected or the token expired. Please reconnect your YouTube channel.";

  try {
    const resolved = await resolveYouTubeAccountForUpload(userId, parsed.channelIdRaw);
    if (resolved.error === "not_connected") {
      return errorResponse(res, reconnectMessage, 401, "not_connected");
    }
    if (resolved.error === "channel_required") {
      return errorResponse(
        res,
        "Multiple YouTube channels are connected. Select which channel to upload to.",
        400,
        "channel_required"
      );
    }
    if (resolved.error === "channel_not_allowed") {
      return errorResponse(
        res,
        "You cannot upload to a YouTube channel that is not connected to your account.",
        403,
        "channel_not_allowed"
      );
    }
    if (resolved.error === "channel_incomplete") {
      return errorResponse(
        res,
        "Your YouTube connection is missing a channel id. Reconnect YouTube and try again.",
        400,
        "channel_incomplete"
      );
    }

    let accountDoc = resolved.account;
    let accessToken = accountDoc.getDecryptedAccessToken?.();

    const ensureFreshAccess = async () => {
      const tokenMissing = !accessToken;
      const expired = accountDoc.expiresAt && new Date(accountDoc.expiresAt).getTime() <= Date.now();
      if (!tokenMissing && !expired) return;
      const refreshed = await youtubeService.refreshTokenIfNeeded(
        tokenMissing
          ? {
              expiresAt: new Date(0),
              getDecryptedRefreshToken: () => accountDoc.getDecryptedRefreshToken?.(),
            }
          : accountDoc
      );
      if (refreshed) {
        await refreshAccountTokenById(accountDoc._id, refreshed);
        const reloaded = await SocialAccount.findById(accountDoc._id);
        if (reloaded) accountDoc = reloaded;
        accessToken = accountDoc.getDecryptedAccessToken?.();
      }
    };

    await ensureFreshAccess();

    if (!accessToken) {
      return errorResponse(res, reconnectMessage, 401, "no_token");
    }

    const channelTitle = accountDoc.accountName || accountDoc.metadata?.youtubeChannelTitle || "";
    const channelId = resolved.resolvedChannelId;

    const runUpload = async (token) =>
      youtubeService.uploadVideo(token, {
        buffer: req.file.buffer,
        mimeType: parsed.mimeType,
        title: parsed.title,
        description: parsed.description,
        tags: parsed.tags,
        categoryId: parsed.categoryId,
        privacyStatus: parsed.privacyStatus,
        madeForKids: parsed.madeForKids,
      });

    let data;
    try {
      data = await runUpload(accessToken);
    } catch (uploadErr) {
      if (isYouTubeUnauthorized(uploadErr) && accountDoc.getDecryptedRefreshToken?.()) {
        try {
          const refreshed = await youtubeService.refreshTokenIfNeeded({
            expiresAt: new Date(0),
            getDecryptedRefreshToken: () => accountDoc.getDecryptedRefreshToken(),
          });
          if (refreshed?.accessToken) {
            await refreshAccountTokenById(accountDoc._id, refreshed);
            const reloaded = await SocialAccount.findById(accountDoc._id);
            if (reloaded) accountDoc = reloaded;
            accessToken = accountDoc.getDecryptedAccessToken?.();
            if (accessToken) {
              try {
                data = await runUpload(accessToken);
              } catch (retryUploadErr) {
                const mapped = mapYouTubeClientError(retryUploadErr);
                const clientMsg = isYouTubeUnauthorized(retryUploadErr) ? reconnectMessage : mapped.message;
                return errorResponse(res, clientMsg, mapped.httpStatus, mapped.code);
              }
            } else {
              return errorResponse(res, reconnectMessage, 401, "no_token");
            }
          } else {
            return errorResponse(res, reconnectMessage, 401, "token_refresh_failed");
          }
        } catch (refreshErr) {
          console.error("[youtube:post:refresh-retry:error]", { message: refreshErr?.message });
          const mapped = mapYouTubeClientError(uploadErr);
          const clientMsg = isYouTubeUnauthorized(uploadErr) ? reconnectMessage : mapped.message;
          return errorResponse(res, clientMsg, mapped.httpStatus, mapped.code);
        }
      } else {
        const mapped = mapYouTubeClientError(uploadErr);
        const clientMsg = isYouTubeUnauthorized(uploadErr) ? reconnectMessage : mapped.message;
        return errorResponse(res, clientMsg, mapped.httpStatus, mapped.code);
      }
    }

    const videoId = data?.id ? String(data.id) : "";
    if (!videoId) {
      return errorResponse(res, "YouTube did not return a video id.", 502, "youtube_no_video_id");
    }

    const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const content = [parsed.title, parsed.description].filter(Boolean).join("\n\n");

    await recordSuccessfulPublish({
      userId,
      platform: "youtube",
      platformAccountId: channelId,
      platformAccountName: channelTitle || channelId,
      targetType: "channel",
      targetId: channelId,
      targetName: channelTitle || channelId,
      content,
      mediaType: "VIDEO",
      mediaUrl: videoUrl,
      externalPostId: videoId,
      externalPostUrl: videoUrl,
      apiSnapshot: { id: videoId },
    });

    return res.status(200).json({
      success: true,
      message: "Video uploaded successfully on YouTube",
      postId: videoId,
      videoUrl,
      data: {},
    });
  } catch (error) {
    console.error("[youtube:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not upload video to YouTube.", 500, error.code || "youtube_post_error");
  }
}

export async function createLinkedInPost(req, res) {
  let parsed;
  try {
    parsed = parseLinkedInPostBody(req.body, req.file || null);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "LinkedIn account is not connected or token expired. Please reconnect your LinkedIn account.";

  try {
    const tokenAccount = await getLinkedInAccountForToken(userId);
    if (!tokenAccount || !tokenAccount.isConnected) {
      return errorResponse(res, reconnectMessage, 401, "not_connected");
    }

    let accessToken = tokenAccount.getDecryptedAccessToken();
    if (!accessToken) {
      return errorResponse(res, reconnectMessage, 401, "no_token");
    }

    const tokenExpired = tokenAccount.expiresAt && new Date(tokenAccount.expiresAt).getTime() <= Date.now();
    if (tokenExpired) {
      console.warn("[linkedin:post:token-expired]", { userId: String(userId) });
      return errorResponse(res, reconnectMessage, 401, "token_expired");
    }

    const personId = tokenAccount.platformUserId ? String(tokenAccount.platformUserId).trim() : "";
    if (!personId) {
      console.error("[linkedin:post:missing-person-id]", { userId: String(userId) });
      return errorResponse(res, reconnectMessage, 401, "invalid_account");
    }

    let authorUrn;
    /** @type {{ targetType: string, targetId: string, targetName: string }} */
    let historyTarget = {
      targetType: "profile",
      targetId: personId,
      targetName: tokenAccount.accountName || tokenAccount.username || personId,
    };
    if (parsed.targetType === "profile") {
      authorUrn = getLinkedInAuthorUrn(tokenAccount);
      if (!authorUrn) {
        return errorResponse(res, reconnectMessage, 401, "invalid_account");
      }
    } else {
      const orgAccount = await getLinkedInOrganizationAccount(userId, parsed.organizationId);
      if (!orgAccount) {
        return errorResponse(
          res,
          "You do not have access to post as this LinkedIn company page, or it is not connected. Pick a page you manage or reconnect LinkedIn.",
          403,
          "organization_not_allowed"
        );
      }
      authorUrn = getLinkedInAuthorUrn(orgAccount);
      if (!authorUrn) {
        return errorResponse(res, "Invalid LinkedIn organization author identity. Please reconnect.", 400, "invalid_account");
      }
      historyTarget = {
        targetType: "organization",
        targetId: String(parsed.organizationId),
        targetName: orgAccount.accountName || orgAccount.name || String(parsed.organizationId),
      };
    }

    const commentary = parsed.content;
    const apiMediaType = parsed.mediaType;
    const linkUrl = parsed.linkUrl || "";

    let mediaAssetUrn = "";
    if (parsed.mediaType === "IMAGE" || parsed.mediaType === "VIDEO") {
      const recipe =
        parsed.mediaType === "IMAGE"
          ? linkedinProvider.FEEDSHARE_IMAGE_RECIPE
          : linkedinProvider.FEEDSHARE_VIDEO_RECIPE;
      try {
        const registered = await linkedinProvider.registerFeedshareUpload(accessToken, authorUrn, recipe);
        await linkedinProvider.uploadBinaryToLinkedIn(
          registered.uploadUrl,
          registered.uploadHeaders,
          req.file.buffer,
          req.file.mimetype
        );
        mediaAssetUrn = registered.assetUrn;
      } catch (uploadErr) {
        console.error("[linkedin:post:upload:error]", {
          message: uploadErr?.message,
          code: uploadErr?.code,
          status: uploadErr?.status,
        });
        const clientMessage =
          uploadErr?.status === 401 || uploadErr?.status === 403 || uploadErr?.code === "linkedin_unauthorized"
            ? reconnectMessage
            : uploadErr.message || "Could not upload media to LinkedIn.";
        return errorResponse(
          res,
          clientMessage,
          uploadErr.status >= 400 && uploadErr.status < 600 ? uploadErr.status : 502,
          uploadErr.code || "linkedin_upload_failed"
        );
      }
    }

    let result;
    try {
      result = await linkedinProvider.createUgcPost(accessToken, {
        authorUrn,
        commentary,
        mediaType:
          apiMediaType === "LINK"
            ? "LINK"
            : apiMediaType === "IMAGE"
              ? "IMAGE"
              : apiMediaType === "VIDEO"
                ? "VIDEO"
                : "TEXT",
        linkUrl: apiMediaType === "LINK" ? linkUrl : undefined,
        mediaAssetUrn: mediaAssetUrn || undefined,
      });
    } catch (apiError) {
      console.error("[linkedin:post:api:error]", {
        message: apiError?.message,
        code: apiError?.code,
        status: apiError?.status,
      });
      const clientMessage =
        apiError?.status === 401 || apiError?.status === 403 || apiError?.code === "linkedin_unauthorized"
          ? reconnectMessage
          : apiError.message || "Could not publish post on LinkedIn.";
      return errorResponse(
        res,
        clientMessage,
        apiError.status >= 400 && apiError.status < 600 ? apiError.status : 502,
        apiError.code || "linkedin_post_failed"
      );
    }

    const postId = result.id || "";
    const historyContent =
      parsed.mediaType === "LINK"
        ? [parsed.content, parsed.linkUrl].filter(Boolean).join("\n") || parsed.linkUrl
        : parsed.mediaType === "IMAGE" || parsed.mediaType === "VIDEO"
          ? [parsed.content, req.file?.originalname].filter(Boolean).join("\n") ||
            (parsed.mediaType === "IMAGE" ? "Image post" : "Video post")
          : parsed.content;

    await recordSuccessfulPublish({
      userId,
      platform: "linkedin",
      platformAccountId: personId,
      platformAccountName: tokenAccount.accountName || tokenAccount.username || "",
      targetType: historyTarget.targetType,
      targetId: historyTarget.targetId,
      targetName: historyTarget.targetName,
      content: historyContent,
      mediaType: parsed.mediaType,
      mediaUrl: "",
      linkUrl: parsed.mediaType === "LINK" ? parsed.linkUrl : "",
      externalPostId: postId,
      externalPostUrl: postId ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}` : "",
      apiSnapshot: { id: postId },
    });

    return successResponse(
      res,
      { postId, data: { id: postId } },
      "Post published successfully on LinkedIn"
    );
  } catch (error) {
    console.error("[linkedin:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish post on LinkedIn.", 500, error.code || "linkedin_post_error");
  }
}

const GB_RECONNECT_MESSAGE =
  "Google Business Profile is not connected or token expired. Please reconnect your Google account.";
const GB_SUMMARY_MAX = 1500;
const GB_SAFE_RESOURCE_ID = /^[a-zA-Z0-9_-]{1,256}$/;
const GB_CTA_TYPES = new Set(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]);

function parseIsoDateParts(value, label) {
  if (value === undefined || value === null || value === "") {
    const err = new Error(`${label} is required.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const err = new Error(`${label} must be a date in YYYY-MM-DD format.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  const [ys, ms, ds] = s.split("-");
  const year = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    const err = new Error(`${label} is not a valid calendar date.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  return { year, month, day };
}

function calendarDateCompare(a, b) {
  const ta = Date.UTC(a.year, a.month - 1, a.day);
  const tb = Date.UTC(b.year, b.month - 1, b.day);
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

function parseGoogleBusinessPostBody(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }

  const rejectPrototypePollution = () => {
    const err = new Error("Invalid request payload.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  };
  if ("__proto__" in body || "constructor" in body) rejectPrototypePollution();

  const trimStr = (v) => (typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "");

  const locationId = trimStr(body.locationId);
  const accountId = trimStr(body.accountId);
  const postTypeRaw = trimStr(body.postType).toUpperCase();

  if (!locationId) {
    const err = new Error("locationId is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (!accountId) {
    const err = new Error("accountId is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (!GB_SAFE_RESOURCE_ID.test(locationId) || !GB_SAFE_RESOURCE_ID.test(accountId)) {
    const err = new Error("accountId and locationId contain invalid characters.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (!postTypeRaw) {
    const err = new Error("postType is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (!["STANDARD", "UPDATE", "EVENT", "OFFER"].includes(postTypeRaw)) {
    const err = new Error("postType must be one of: UPDATE, STANDARD, EVENT, OFFER.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const summary =
    body.summary === undefined || body.summary === null ? "" : typeof body.summary === "string" ? body.summary.trim() : String(body.summary).trim();

  if (typeof body.summary !== "string" && body.summary != null) {
    const err = new Error("summary must be a string.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const normalizedPostType = postTypeRaw === "UPDATE" ? "STANDARD" : postTypeRaw;

  if (normalizedPostType === "STANDARD") {
    if (!summary.replace(/\s/g, "").length) {
      const err = new Error("summary is required for STANDARD posts and cannot be only spaces.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (summary.length > GB_SUMMARY_MAX) {
    const err = new Error(`summary cannot exceed ${GB_SUMMARY_MAX} characters.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const mediaUrl = trimStr(body.mediaUrl);
  if (mediaUrl && !isValidHttpUrl(mediaUrl)) {
    const err = new Error("mediaUrl must be a valid public http(s) URL.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const ctaTypeRaw = trimStr(body.ctaType).toUpperCase();
  const ctaUrl = trimStr(body.ctaUrl);

  if (ctaTypeRaw) {
    if (!GB_CTA_TYPES.has(ctaTypeRaw)) {
      const err = new Error(
        "ctaType must be one of: BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL."
      );
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (ctaTypeRaw !== "CALL") {
      if (!ctaUrl) {
        const err = new Error("ctaUrl is required when ctaType is provided and is not CALL.");
        err.status = 400;
        err.code = "validation_error";
        throw err;
      }
      if (!isValidHttpUrl(ctaUrl)) {
        const err = new Error("ctaUrl must be a valid http(s) URL.");
        err.status = 400;
        err.code = "validation_error";
        throw err;
      }
    }
  } else if (ctaUrl) {
    const err = new Error("ctaUrl cannot be set without ctaType.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const eventTitle = trimStr(body.eventTitle);
  const offerTitle = trimStr(body.offerTitle);
  const couponCode = trimStr(body.couponCode);
  const redeemUrl = trimStr(body.redeemUrl);
  const termsConditions = trimStr(body.termsConditions);

  if (redeemUrl && !isValidHttpUrl(redeemUrl)) {
    const err = new Error("redeemUrl must be a valid http(s) URL.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  let startDateParts = null;
  let endDateParts = null;

  if (normalizedPostType === "EVENT") {
    if (!eventTitle.replace(/\s/g, "").length) {
      const err = new Error("eventTitle is required for EVENT posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    startDateParts = parseIsoDateParts(body.startDate, "startDate");
    endDateParts = parseIsoDateParts(body.endDate, "endDate");
  } else if (normalizedPostType === "OFFER") {
    if (!offerTitle.replace(/\s/g, "").length) {
      const err = new Error("offerTitle is required for OFFER posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    startDateParts = parseIsoDateParts(body.startDate, "startDate");
    endDateParts = parseIsoDateParts(body.endDate, "endDate");
  }

  if (startDateParts && endDateParts) {
    if (calendarDateCompare(endDateParts, startDateParts) < 0) {
      const err = new Error("endDate cannot be before startDate.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  const inferMediaFormat = () => {
    if (!mediaUrl) return null;
    const pathOnly = mediaUrl.split("?")[0].toLowerCase();
    if (
      pathOnly.endsWith(".mp4") ||
      pathOnly.endsWith(".mov") ||
      pathOnly.endsWith(".webm") ||
      pathOnly.endsWith(".m4v")
    ) {
      return "VIDEO";
    }
    return "PHOTO";
  };

  return {
    locationId,
    accountId,
    postType: normalizedPostType,
    requestedPostType: postTypeRaw,
    summary,
    mediaUrl,
    mediaFormat: inferMediaFormat(),
    ctaType: ctaTypeRaw || "",
    ctaUrl: ctaTypeRaw === "CALL" ? "" : ctaUrl,
    eventTitle,
    offerTitle,
    startDateParts,
    endDateParts,
    couponCode,
    redeemUrl,
    termsConditions,
  };
}

export async function createGoogleBusinessPost(req, res) {
  let parsed;
  try {
    parsed = parseGoogleBusinessPostBody(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);

  try {
    const tokenAccount = await getGoogleBusinessAccountForToken(userId);
    if (!tokenAccount || !tokenAccount.isConnected) {
      return errorResponse(res, GB_RECONNECT_MESSAGE, 401, "not_connected");
    }

    let accessToken = tokenAccount.getDecryptedAccessToken();
    if (!accessToken) {
      return errorResponse(res, GB_RECONNECT_MESSAGE, 401, "no_token");
    }

    const { provider } = resolvePlatform("googleBusiness");

    const tokenExpired = tokenAccount.expiresAt && new Date(tokenAccount.expiresAt).getTime() <= Date.now();
    if (tokenExpired) {
      try {
        const refreshed = await provider.refreshTokenIfNeeded(tokenAccount);
        if (refreshed?.accessToken) {
          await refreshAccountToken(userId, "googleBusiness", refreshed);
          accessToken = refreshed.accessToken;
        }
      } catch (refreshError) {
        console.error("[googleBusiness:post:refresh:error]", { message: refreshError?.message });
        return errorResponse(
          res,
          GB_RECONNECT_MESSAGE,
          401,
          refreshError?.code || "token_refresh_failed"
        );
      }
    }

    if (!accessToken) {
      return errorResponse(res, GB_RECONNECT_MESSAGE, 401, "no_token");
    }

    const dryRunEnabled = String(process.env.GOOGLE_BUSINESS_DRY_RUN || "").trim().toLowerCase() === "true";
    let locationAccount = null;

    if (!dryRunEnabled) {
      locationAccount = await getGoogleBusinessLocationAccount(userId, parsed.locationId);
      if (!locationAccount || !locationAccount.isConnected) {
        return errorResponse(
          res,
          "You do not have access to this Google Business Profile location, or it is not connected.",
          403,
          "location_not_allowed"
        );
      }

      const meta = locationAccount.metadata || {};
      const managed = meta.managedEntity || {};
      const storedAccountId = String(meta.googleBusinessAccountId || managed.googleBusinessAccountId || "").trim();
      if (!storedAccountId || storedAccountId !== parsed.accountId) {
        return errorResponse(
          res,
          "You do not have access to post to this location with the selected account.",
          403,
          "location_account_mismatch"
        );
      }
    } else {
      console.info("[googleBusiness:post:dry-run] skipping location access check", {
        locationId: parsed.locationId,
        accountId: parsed.accountId,
      });
    }

    let result;
    let retriedUnauthorized = false;
    for (;;) {
      try {
        result = await publishGoogleBusinessLocalPost({
          accessToken,
          accountId: parsed.accountId,
          locationId: parsed.locationId,
          parsed,
        });
        break;
      } catch (apiError) {
        const status = apiError.status || apiError.response?.status;
        const canRetry =
          status === 401 &&
          !retriedUnauthorized &&
          typeof tokenAccount.getDecryptedRefreshToken === "function" &&
          tokenAccount.getDecryptedRefreshToken();

        if (canRetry) {
          retriedUnauthorized = true;
          try {
            const refreshed = await provider.refreshTokenIfNeeded({
              expiresAt: new Date(0),
              getDecryptedRefreshToken: () => tokenAccount.getDecryptedRefreshToken(),
              getDecryptedAccessToken: () => tokenAccount.getDecryptedAccessToken(),
            });
            if (refreshed?.accessToken) {
              await refreshAccountToken(userId, "googleBusiness", refreshed);
              accessToken = refreshed.accessToken;
              continue;
            }
          } catch (retryRefreshError) {
            console.error("[googleBusiness:post:retry-refresh:error]", { message: retryRefreshError?.message });
          }
        }

        console.error("[googleBusiness:post:api:error]", {
          message: apiError?.message,
          code: apiError?.code,
          status,
        });

        const authLike = status === 401 || status === 403;
        const clientMessage = authLike ? GB_RECONNECT_MESSAGE : apiError.message || "Could not publish post on Google Business Profile.";
        return errorResponse(
          res,
          clientMessage,
          status >= 400 && status < 600 ? status : 502,
          apiError.code || "google_business_post_failed"
        );
      }
    }

    const postId = result.postId ? String(result.postId) : "";
    const rawName = typeof result.raw?.name === "string" ? result.raw.name : "";
    const raw = result.raw && typeof result.raw === "object" ? result.raw : {};
    const safeClientPayload = {};
    if (typeof raw.name === "string") safeClientPayload.name = raw.name;
    if (raw.createTime != null) safeClientPayload.createTime = raw.createTime;
    if (raw.topicType != null) safeClientPayload.topicType = raw.topicType;

    const historySummary =
      parsed.postType === "OFFER"
        ? [parsed.offerTitle, parsed.summary].filter(Boolean).join("\n")
        : parsed.postType === "EVENT"
          ? [parsed.eventTitle, parsed.summary].filter(Boolean).join("\n")
          : parsed.summary;

    const historyMediaType = parsed.mediaUrl ? (parsed.mediaFormat === "VIDEO" ? "VIDEO" : "IMAGE") : "TEXT";

    await recordSuccessfulPublish({
      userId,
      platform: "googleBusiness",
      platformAccountId: String(tokenAccount.platformUserId || ""),
      platformAccountName: tokenAccount.accountName || tokenAccount.username || "",
      targetType: "location",
      targetId: parsed.locationId,
      targetName: locationAccount ? getGoogleBusinessLocationName(locationAccount) || parsed.locationId : parsed.locationId,
      content: historySummary || parsed.summary,
      mediaType: historyMediaType,
      mediaUrl: parsed.mediaUrl || "",
      linkUrl: parsed.ctaUrl || parsed.redeemUrl || "",
      externalPostId: postId,
      externalPostUrl: "",
      apiSnapshot: rawName ? { name: rawName } : { id: postId },
    });

    const dryRun = Boolean(result.raw?.dryRun);
    return successResponse(
      res,
      { postId, data: safeClientPayload, dryRun },
      dryRun
        ? "Dry-run: post payload validated (Google API was not called). Set GOOGLE_BUSINESS_DRY_RUN=false to publish for real."
        : "Post published successfully on Google Business Profile"
    );
  } catch (error) {
    console.error("[googleBusiness:post:error]", { message: error?.message });
    return errorResponse(
      res,
      error.message || "Could not publish post on Google Business Profile.",
      500,
      error.code || "google_business_post_error"
    );
  }
}

const TELEGRAM_MESSAGE_MAX = 4096;
const TELEGRAM_MEDIA_URL_MAX = 2048;

function parseTelegramPostBody(body) {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    const err = new Error("Invalid request body.");
    err.status = 400;
    err.code = "invalid_body";
    throw err;
  }
  if ("__proto__" in body || "constructor" in body) {
    const err = new Error("Invalid request payload.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const chatId =
    typeof body.chatId === "string" ? body.chatId.trim() : body.chatId != null ? String(body.chatId).trim() : "";
  if (!chatId) {
    const err = new Error("chatId is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const mediaTypeRaw = typeof body.mediaType === "string" ? body.mediaType.trim().toUpperCase() : "";
  if (!["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LINK"].includes(mediaTypeRaw)) {
    const err = new Error("mediaType is required and must be one of: TEXT, IMAGE, VIDEO, DOCUMENT, LINK.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (typeof body.message !== "string" && body.message != null) {
    const err = new Error("message must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.mediaUrl !== "string" && body.mediaUrl != null) {
    const err = new Error("mediaUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.linkUrl !== "string" && body.linkUrl != null) {
    const err = new Error("linkUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.buttonText !== "string" && body.buttonText != null) {
    const err = new Error("buttonText must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (typeof body.buttonUrl !== "string" && body.buttonUrl != null) {
    const err = new Error("buttonUrl must be a string if provided.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  let message = typeof body.message === "string" ? body.message.trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  let linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";
  const buttonText = typeof body.buttonText === "string" ? body.buttonText.trim() : "";
  const buttonUrl = typeof body.buttonUrl === "string" ? body.buttonUrl.trim() : "";

  if (Object.prototype.hasOwnProperty.call(body, "message") && typeof body.message === "string" && body.message.length > 0 && !message.length) {
    const err = new Error("message cannot be only spaces.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (message.length > TELEGRAM_MESSAGE_MAX) {
    const err = new Error(`message cannot exceed ${TELEGRAM_MESSAGE_MAX} characters.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (buttonText && !buttonUrl) {
    const err = new Error("buttonUrl is required when buttonText is set.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (buttonUrl && !buttonText) {
    const err = new Error("buttonText is required when buttonUrl is set.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (buttonUrl && !isValidHttpUrl(buttonUrl)) {
    const err = new Error("buttonUrl must be a valid http(s) URL.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "TEXT") {
    if (mediaUrl) {
      const err = new Error("mediaUrl is not used when mediaType is TEXT.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "LINK") {
    if (mediaUrl) {
      const err = new Error("mediaUrl is not used when mediaType is LINK.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!linkUrl) {
      const err = new Error("linkUrl is required for LINK posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!isValidHttpUrl(linkUrl)) {
      const err = new Error("linkUrl must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  } else if (linkUrl && mediaTypeRaw !== "TEXT") {
    const err = new Error("linkUrl is only allowed for TEXT or LINK posts.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "IMAGE" || mediaTypeRaw === "VIDEO" || mediaTypeRaw === "DOCUMENT") {
    if (linkUrl) {
      const err = new Error("linkUrl must be empty for image, video, or document posts.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!mediaUrl) {
      const err = new Error(`mediaUrl is required for ${mediaTypeRaw.toLowerCase()} posts.`);
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (mediaUrl.length > TELEGRAM_MEDIA_URL_MAX || !isValidHttpUrl(mediaUrl)) {
      const err = new Error("mediaUrl must be a valid public http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  const hasPayload = Boolean(message || mediaUrl || linkUrl);
  if (!hasPayload) {
    const err = new Error("Either message, mediaUrl, or linkUrl is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "TEXT" && !message && !linkUrl) {
    const err = new Error("TEXT posts need message text and/or linkUrl.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  return {
    chatId,
    mediaType: mediaTypeRaw,
    message,
    mediaUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(mediaTypeRaw) ? mediaUrl : "",
    linkUrl: mediaTypeRaw === "LINK" ? linkUrl : mediaTypeRaw === "TEXT" ? linkUrl : "",
    buttonText,
    buttonUrl,
  };
}

const DISCORD_CONTENT_MAX = 2000;

function parseDiscordPostBody(body) {
  const guildId = body?.guildId != null ? String(body.guildId).trim() : "";
  const channelId = body?.channelId != null ? String(body.channelId).trim() : "";
  const mediaTypeRaw = typeof body?.mediaType === "string" ? body.mediaType.trim().toUpperCase() : "";

  if (!channelId || !/^\d{17,24}$/.test(channelId)) {
    const err = new Error("channelId is required and must be a valid Discord snowflake id.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (!["TEXT", "IMAGE", "EMBED", "LINK"].includes(mediaTypeRaw)) {
    const err = new Error("mediaType is required and must be one of: TEXT, IMAGE, EMBED, LINK.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const strFields = ["message", "mediaUrl", "linkUrl", "embedTitle", "embedDescription", "embedUrl"];
  for (const f of strFields) {
    if (body[f] != null && typeof body[f] !== "string") {
      const err = new Error(`${f} must be a string if provided.`);
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  let message = typeof body.message === "string" ? body.message.replace(/\u0000/g, "").trim() : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.replace(/\u0000/g, "").trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.replace(/\u0000/g, "").trim() : "";
  const embedTitle = typeof body.embedTitle === "string" ? body.embedTitle.replace(/\u0000/g, "").trim() : "";
  const embedDescription = typeof body.embedDescription === "string" ? body.embedDescription.replace(/\u0000/g, "").trim() : "";
  const embedUrl = typeof body.embedUrl === "string" ? body.embedUrl.replace(/\u0000/g, "").trim() : "";

  if (Object.prototype.hasOwnProperty.call(body, "message") && typeof body.message === "string" && body.message.length > 0 && !message.length) {
    const err = new Error("message cannot be only spaces.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (message.length > DISCORD_CONTENT_MAX) {
    const err = new Error(`message cannot exceed ${DISCORD_CONTENT_MAX} characters (Discord limit).`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (embedTitle.length > 256) {
    const err = new Error("embedTitle cannot exceed 256 characters.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (embedDescription.length > 4096) {
    const err = new Error("embedDescription cannot exceed 4096 characters.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaUrl.length > 2048 || linkUrl.length > 2048 || embedUrl.length > 2048) {
    const err = new Error("URL fields are too long.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  const globalPayload = Boolean(message || embedDescription || mediaUrl || linkUrl);
  const embedPayload =
    mediaTypeRaw === "EMBED" && (Boolean(embedTitle) || Boolean(embedDescription));
  if (!globalPayload && !embedPayload) {
    const err = new Error("Either message, embedDescription, mediaUrl, or linkUrl is required (for EMBED, title and/or description counts).");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  if (mediaTypeRaw === "IMAGE") {
    if (!mediaUrl || !isValidDiscordHttpUrl(mediaUrl)) {
      const err = new Error("mediaUrl is required for IMAGE posts and must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "LINK") {
    if (!linkUrl || !isValidDiscordHttpUrl(linkUrl)) {
      const err = new Error("linkUrl is required for LINK posts and must be a valid http(s) URL.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (mediaTypeRaw === "EMBED") {
    if (!embedTitle && !embedDescription) {
      const err = new Error("EMBED posts require embedTitle and/or embedDescription.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
  }

  if (embedUrl && !isValidDiscordHttpUrl(embedUrl)) {
    const err = new Error("embedUrl must be a valid http(s) URL.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  return {
    guildId,
    channelId,
    mediaType: mediaTypeRaw,
    message,
    mediaUrl,
    linkUrl,
    embedTitle,
    embedDescription,
    embedUrl,
  };
}

export async function updateDiscordTargets(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const account = await replaceDiscordPostingTargets(userId, req.body?.targets);
    return successResponse(res, { account }, "Discord posting targets saved.");
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to save Discord targets.", status, error.code || "validation_error");
  }
}

export async function createDiscordPost(req, res) {
  let parsed;
  try {
    parsed = parseDiscordPostBody(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "Discord is not connected. Connect Discord from Connected Platforms first.";

  try {
    let accountDoc = await getStoredAccountForProvider(userId, "discord");
    if (!accountDoc || !accountDoc.isConnected) {
      return errorResponse(res, reconnectMessage, 401, "not_connected");
    }

    const target = findDiscordTargetFromAccount(accountDoc, parsed.channelId, parsed.guildId);
    if (!target) {
      return errorResponse(
        res,
        "This channel is not in your saved Discord targets, or the server id does not match this bot target.",
        403,
        "discord_target_not_allowed"
      );
    }

    const discordPayload = buildDiscordMessagePayload(parsed);
    const connectionType = String(target.connectionType || "bot").toLowerCase();

    let result;
    if (connectionType === "webhook") {
      const wh = decryptToken(target.webhookUrlEnc);
      if (!wh) {
        return errorResponse(res, "Webhook credentials are missing. Re-save this target with a valid webhook URL.", 400, "discord_webhook_missing");
      }
      try {
        result = await publishDiscordViaWebhook(wh, discordPayload);
      } catch (apiError) {
        console.error("[discord:post:webhook:error]", { message: apiError?.message, code: apiError?.code });
        const status = apiError?.status >= 400 && apiError?.status < 600 ? apiError.status : 502;
        return errorResponse(res, apiError.message || "Could not publish to Discord webhook.", status, apiError.code || "discord_post_failed");
      }
    } else {
      const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
      if (!botToken) {
        return errorResponse(
          res,
          "Discord bot token is not configured on the server. Add DISCORD_BOT_TOKEN or use a webhook target.",
          503,
          "discord_bot_missing"
        );
      }

      let userAccess = accountDoc.getDecryptedAccessToken?.();
      if (!userAccess) {
        return errorResponse(res, reconnectMessage, 401, "no_token");
      }

      if (accountDoc.expiresAt && new Date(accountDoc.expiresAt).getTime() <= Date.now()) {
        const rt = accountDoc.getDecryptedRefreshToken?.();
        if (!rt) {
          return errorResponse(res, "Discord session expired. Please reconnect Discord.", 401, "discord_session_expired");
        }
        try {
          const refreshed = await refreshDiscordAccessToken(rt);
          await refreshAccountToken(userId, "discord", refreshed);
          accountDoc = await getStoredAccountForProvider(userId, "discord");
          userAccess = accountDoc?.getDecryptedAccessToken?.() || "";
        } catch (refreshErr) {
          const st = refreshErr?.status >= 400 && refreshErr?.status < 600 ? refreshErr.status : 401;
          return errorResponse(
            res,
            refreshErr.message || "Discord session expired. Please reconnect Discord.",
            st,
            refreshErr.code || "discord_refresh_failed"
          );
        }
      }

      let guildIds;
      try {
        guildIds = await fetchDiscordUserGuildIds(userAccess);
      } catch (ge) {
        const st = ge?.status >= 400 && ge?.status < 600 ? ge.status : 403;
        return errorResponse(res, ge.message || "Could not verify Discord server access.", st, ge.code || "discord_guilds_failed");
      }

      const gidStored = String(target.guildId || "").trim();
      if (!guildIds.has(gidStored)) {
        return errorResponse(
          res,
          "Your connected Discord user is not in that server (or the OAuth token cannot see it). Use the same Discord account that joined the server.",
          403,
          "discord_user_not_in_guild"
        );
      }

      try {
        const channelMeta = await fetchDiscordChannelWithBot(botToken, parsed.channelId);
        if (channelMeta.guild_id !== gidStored) {
          return errorResponse(res, "That channel does not belong to the selected server.", 403, "discord_channel_guild_mismatch");
        }
      } catch (ce) {
        const st = ce?.status >= 400 && ce?.status < 600 ? ce.status : 403;
        return errorResponse(res, ce.message || "Could not verify the channel with the bot.", st, ce.code || "discord_channel_failed");
      }

      try {
        result = await publishDiscordViaBot(botToken, parsed.channelId, discordPayload);
      } catch (apiError) {
        console.error("[discord:post:bot:error]", { message: apiError?.message, code: apiError?.code });
        const status = apiError?.status >= 400 && apiError?.status < 600 ? apiError.status : 502;
        return errorResponse(res, apiError.message || "Could not publish to Discord.", status, apiError.code || "discord_post_failed");
      }
    }

    const targetLabel = `${target.guildName || "Server"} — ${target.channelName || parsed.channelId}`;
    const historyContent =
      parsed.message || parsed.embedDescription || parsed.mediaUrl || parsed.linkUrl || "";

    await recordSuccessfulPublish({
      userId,
      platform: "discord",
      platformAccountId: String(accountDoc.platformUserId || ""),
      platformAccountName: accountDoc.accountName || accountDoc.username || "Discord",
      targetType: "server_channel",
      targetId: parsed.channelId,
      targetName: targetLabel.slice(0, 512),
      content: historyContent.slice(0, 65000),
      mediaType: parsed.mediaType,
      mediaUrl: parsed.mediaUrl || "",
      linkUrl: parsed.linkUrl || "",
      externalPostId: result.messageId,
      externalPostUrl: "",
      apiSnapshot: result.safePayload,
    });

    return res.status(200).json({
      success: true,
      message: "Post published successfully on Discord",
      postId: result.messageId,
      data: {},
      error: null,
    });
  } catch (error) {
    console.error("[discord:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish to Discord.", 500, error.code || "discord_post_error");
  }
}

export async function updateTelegramTargets(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const account = await replaceTelegramPostingTargets(userId, req.body?.targets);
    return successResponse(res, { account }, "Telegram posting targets saved.");
  } catch (error) {
    const status = error?.status >= 400 && error?.status < 600 ? error.status : 400;
    return errorResponse(res, error.message || "Unable to save Telegram targets.", status, error.code || "validation_error");
  }
}

export async function createTelegramPost(req, res) {
  let parsed;
  try {
    parsed = parseTelegramPostBody(req.body);
  } catch (validationError) {
    return errorResponse(res, validationError.message, validationError.status || 400, validationError.code || "validation_error");
  }

  const userId = new ObjectId(req.auth.userId);
  const reconnectMessage = "Telegram is not connected. Connect your bot from Connected Platforms first.";

  try {
    const targetMeta = await resolveTelegramPostingTargetForUser(userId, parsed.chatId);
    if (!targetMeta) {
      return errorResponse(
        res,
        "This chat is not in your saved Telegram targets. Add the channel or group under Telegram settings first.",
        403,
        "telegram_target_not_allowed"
      );
    }

    const account = await getStoredAccountForProvider(userId, "telegram");
    if (!account || !account.isConnected) {
      return errorResponse(res, reconnectMessage, 401, "not_connected");
    }

    const botToken = account.getDecryptedAccessToken?.();
    if (!botToken) {
      return errorResponse(res, reconnectMessage, 401, "no_token");
    }

    let result;
    try {
      result = await publishTelegramPost({
        botToken,
        chatId: parsed.chatId,
        message: parsed.message,
        mediaType: parsed.mediaType,
        mediaUrl: parsed.mediaUrl,
        linkUrl: parsed.linkUrl,
        buttonText: parsed.buttonText,
        buttonUrl: parsed.buttonUrl,
      });
    } catch (apiError) {
      console.error("[telegram:post:api:error]", {
        message: apiError?.message,
        code: apiError?.code,
        status: apiError?.status,
      });
      const status =
        apiError?.status >= 400 && apiError?.status < 600 ? apiError.status : 502;
      return errorResponse(res, apiError.message || "Could not publish to Telegram.", status, apiError.code || "telegram_post_failed");
    }

    const historyContent =
      parsed.mediaType === "LINK"
        ? [parsed.message, parsed.linkUrl].filter(Boolean).join("\n") || parsed.linkUrl
        : parsed.message || (parsed.mediaUrl ? "Media post" : "");

    await recordSuccessfulPublish({
      userId,
      platform: "telegram",
      platformAccountId: String(account.platformUserId || ""),
      platformAccountName: account.accountName || account.username || "Telegram Bot",
      targetType: targetMeta.chatType || "channel",
      targetId: parsed.chatId,
      targetName: targetMeta.chatTitle || parsed.chatId,
      content: historyContent,
      mediaType: parsed.mediaType,
      mediaUrl: parsed.mediaUrl || "",
      linkUrl: parsed.linkUrl || "",
      externalPostId: result.messageId,
      externalPostUrl: "",
      apiSnapshot: result.safePayload,
    });

    return res.status(200).json({
      success: true,
      message: "Post published successfully on Telegram",
      postId: result.messageId,
      data: {},
      error: null,
    });
  } catch (error) {
    console.error("[telegram:post:error]", { message: error?.message });
    return errorResponse(res, error.message || "Could not publish to Telegram.", 500, error.code || "telegram_post_error");
  }
}

export async function debugSocialEnvCheck(req, res) {
  const appConfig = getAppConfig();
  return successResponse(
    res,
    {
      required: getRequiredEnvStatus(),
      providers: getProviderEnvStatus(),
      appConfig: {
        appBaseUrl: appConfig.appBaseUrl,
        clientBaseUrl: appConfig.clientBaseUrl,
        googleRedirectUri: resolveProviderRedirectUri("youtube") || "missing",
        googleBusinessRedirectUri: resolveProviderRedirectUri("googleBusiness") || "missing",
        linkedinRedirectUri: appConfig.linkedinRedirectUri || "missing",
        metaRedirectUri: appConfig.metaRedirectUri || "missing",
        instagramRedirectUri: resolveProviderRedirectUri("instagram") || "missing",
        hasMetaAppId: Boolean(process.env.META_APP_ID),
        hasInstagramClientId: Boolean(process.env.INSTAGRAM_CLIENT_ID),
      },
    },
    "Environment diagnostics loaded."
  );
}

const INSTAGRAM_RECONNECT_MESSAGE =
  "Instagram account is not connected or token expired. Please reconnect your Instagram account.";

function stripInstagramCaption(caption) {
  if (caption == null) return "";
  return String(caption).replace(/\u0000/g, "").trim();
}

function validateInstagramMediaUrl(url, label = "mediaUrl") {
  if (url == null || typeof url !== "string" || !url.trim()) {
    const err = new Error(`${label} is required.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  const trimmed = url.trim();
  if (trimmed.length > 2048) {
    const err = new Error(`${label} is too long.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    const err = new Error(`${label} must be a valid URL.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const err = new Error(`${label} must use http or https.`);
    err.code = "validation";
    err.status = 400;
    throw err;
  }
  return trimmed;
}

function parseInstagramCarouselUrls(body) {
  const raw = body?.mediaUrls;
  if (Array.isArray(raw)) {
    return raw.map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [];
}

export async function postToInstagram(req, res) {
  try {
    const userId = new ObjectId(req.auth.userId);
    const captionRaw = stripInstagramCaption(req.body?.caption);
    if (captionRaw.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
      return errorResponse(res, `Caption must be at most ${INSTAGRAM_CAPTION_MAX_LENGTH} characters.`, 400, "caption_too_long");
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "caption") && captionRaw.length > 0 && !captionRaw.replace(/\s/g, "").length) {
      return errorResponse(res, "Caption cannot be only spaces.", 400, "caption_whitespace_only");
    }

    const mediaType = (req.body?.mediaType || "").toString().trim().toUpperCase();
    const hasSingleMedia = typeof req.body?.mediaUrl === "string" && req.body.mediaUrl.trim().length > 0;
    const hasCarouselMedia = Array.isArray(req.body?.mediaUrls) ? req.body.mediaUrls.length > 0 : false;
    if (!hasSingleMedia && !hasCarouselMedia) {
      return errorResponse(res, "Instagram requires an image or video.", 400, "instagram_media_required");
    }
    if (!["IMAGE", "VIDEO", "REEL", "CAROUSEL"].includes(mediaType)) {
      return errorResponse(res, "mediaType must be IMAGE, VIDEO, REEL, or CAROUSEL.", 400, "invalid_media_type");
    }

    let account = await getStoredAccountForProvider(userId, "instagram");
    if (!account?.isConnected) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_not_connected");
    }

    const accountType = (account.metadata?.accountType || "").toString().toUpperCase();
    if (accountType === "PERSONAL") {
      return errorResponse(
        res,
        "This Instagram account is a personal profile. Connect a Business or Creator account to publish.",
        400,
        "instagram_personal_account"
      );
    }

    let accessToken = account.getDecryptedAccessToken?.();
    if (!accessToken) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_missing");
    }

    try {
      const refreshed = await instagramService.refreshTokenIfNeeded(account);
      if (refreshed?.accessToken) {
        await refreshAccountToken(userId, "instagram", refreshed);
        account = await getStoredAccountForProvider(userId, "instagram");
        accessToken = account.getDecryptedAccessToken?.();
      }
    } catch (refreshErr) {
      const expired =
        account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
      if (expired) {
        console.warn("[instagram:post:refresh-failed]", { message: refreshErr?.message });
        return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_expired");
      }
    }

    if (!accessToken) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_token_missing");
    }

    const igUserId = account.platformUserId?.toString() || "";
    if (!igUserId) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, "instagram_user_unknown");
    }

    let mediaUrl;
    let mediaUrls;

    try {
      if (mediaType === "CAROUSEL") {
        const list = parseInstagramCarouselUrls(req.body);
        mediaUrls = list.map((u, i) => validateInstagramMediaUrl(u, `mediaUrls[${i}]`));
        if (mediaUrls.length < 2 || mediaUrls.length > 10) {
          return errorResponse(res, "Carousel requires between 2 and 10 media URLs.", 400, "instagram_carousel_count");
        }
      } else {
        mediaUrl = validateInstagramMediaUrl(req.body?.mediaUrl, "mediaUrl");
      }
    } catch (validationErr) {
      return errorResponse(res, validationErr.message || "Invalid request.", validationErr.status || 400, validationErr.code || "validation");
    }

    const result = await publishInstagramContent({
      accessToken,
      igUserId,
      mediaType,
      mediaUrl,
      mediaUrls,
      caption: captionRaw.length ? captionRaw : undefined,
    });

    let primaryMediaUrl = "";
    if (mediaType === "CAROUSEL" && Array.isArray(mediaUrls) && mediaUrls.length) {
      primaryMediaUrl = mediaUrls[0];
    } else if (mediaUrl) {
      primaryMediaUrl = mediaUrl;
    }

    await recordSuccessfulPublish({
      userId,
      platform: "instagram",
      platformAccountId: igUserId,
      platformAccountName: account.accountName || account.username || "",
      targetType: "professional",
      targetId: igUserId,
      targetName: account.accountName || account.username || igUserId,
      content: captionRaw,
      mediaType,
      mediaUrl: primaryMediaUrl,
      linkUrl: "",
      externalPostId: result.postId,
      externalPostUrl: "",
      apiSnapshot: { id: result.postId, creationId: result.creationId },
    });

    return res.status(200).json({
      success: true,
      message: "Post published successfully on Instagram",
      postId: result.postId,
      data: { creationId: result.creationId },
    });
  } catch (error) {
    const code = error?.code || "";
    const status = Number(error?.status) || 500;
    const metaCode = error?.details?.error?.code;
    console.error("[instagram:post:error]", {
      code,
      message: error?.message,
      metaCode,
    });

    if (
      code === "instagram_token_missing" ||
      code === "instagram_token_refresh_failed" ||
      status === 401 ||
      metaCode === 190
    ) {
      return errorResponse(res, INSTAGRAM_RECONNECT_MESSAGE, 401, code || "instagram_auth");
    }

    if (code === "instagram_graph_error" && error?.details?.error?.message) {
      const httpStatus = status >= 400 && status < 600 ? status : 400;
      return errorResponse(res, error.details.error.message, httpStatus, code);
    }

    const httpStatus = status >= 400 && status < 600 ? status : 500;
    return errorResponse(res, error.message || "Unable to publish to Instagram.", httpStatus, code);
  }
}
