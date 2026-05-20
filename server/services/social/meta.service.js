import axios from "axios";
import { resolveProviderRedirectUri } from "../../utils/redirectUri.util.js";

const META_GRAPH_VERSION = "v20.0";
const META_OAUTH_BASE_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const META_SCOPE_SETS = {
  initialLogin: ["public_profile", "email"],
  /**
   * Page-related scopes are omitted here by default: many Meta apps return “Invalid Scopes” until Pages /
   * Facebook Login for Business are configured and permissions are approved.
   * Append Page scopes via `FACEBOOK_LOGIN_EXTRA_SCOPES` in `facebook.service.js` when your app supports them.
   */
  pages: [],
  pagePosting: [],
  instagramBasic: ["instagram_basic"],
  publishing: ["instagram_content_publish"],
  insights: ["instagram_manage_insights"],
};

function maskAppId(value) {
  if (!value) return "missing";
  return `***${value.slice(-8)}`;
}

function createMetaError(message, code, status, details = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function normalizeMetaAxiosError(error, fallbackCode = "meta_request_failed") {
  const details = error?.response?.data || null;
  const status = error?.response?.status || 500;
  const providerMessage =
    details?.error?.error_user_msg ||
    details?.error?.message ||
    error?.message ||
    "Meta API request failed.";
  return createMetaError(providerMessage, fallbackCode, status, details);
}

function ensureMetaConfig(platform) {
  const isThreads = platform === "threads";
  const appId = isThreads ? process.env.THREADS_APP_ID : process.env.META_APP_ID;
  const appSecret = isThreads ? process.env.THREADS_APP_SECRET : process.env.META_APP_SECRET;
  const redirectUri = resolveProviderRedirectUri(platform);

  if (!appId || !appSecret || !redirectUri) {
    throw createMetaError("Meta OAuth is not configured.", "meta_config_missing", 400);
  }

  return { appId, appSecret, redirectUri };
}

async function fetchMetaGraph(path, accessToken, params = {}) {
  try {
    const response = await axios.get(`${META_GRAPH_BASE_URL}${path}`, {
      params: {
        ...params,
        access_token: accessToken,
      },
    });
    return response.data;
  } catch (error) {
    throw normalizeMetaAxiosError(error, "meta_graph_error");
  }
}

function mapFacebookProfile(profile) {
  return {
    platformUserId: profile?.id?.toString() || "",
    accountName: profile?.name || "",
    username: profile?.name || "",
    email: profile?.email || "",
    profileImage: profile?.picture?.data?.url || "",
    metadata: {
      rawProfile: profile,
      capabilities: ["account-discovery"],
    },
  };
}

function mapInstagramProfile(igAccount, sourcePage) {
  return {
    platformUserId: igAccount?.id?.toString() || "",
    accountName: igAccount?.name || igAccount?.username || "",
    username: igAccount?.username || "",
    email: "",
    profileImage: igAccount?.profile_picture_url || "",
    metadata: {
      linkedFacebookPage: sourcePage
        ? {
            pageId: sourcePage.id || "",
            pageName: sourcePage.name || "",
            pageAccessToken: sourcePage.access_token || "",
          }
        : null,
      rawProfile: igAccount,
      capabilities: ["account-discovery"],
    },
  };
}

function pickFirstLinkedInstagram(pages) {
  for (const page of pages) {
    if (page?.instagram_business_account?.id) {
      return {
        page,
        instagramAccount: page.instagram_business_account,
      };
    }
  }
  return null;
}

export function createMetaOAuthService({
  platform,
  profileFields = "id,name,email,picture",
  scopes = META_SCOPE_SETS.initialLogin,
}) {
  function buildAuthUrl(state, requestedScopes = scopes) {
    const { appId, redirectUri } = ensureMetaConfig(platform);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: requestedScopes.join(","),
    });
    console.info("[oauth:meta:auth-url]", {
      platform,
      appId: maskAppId(appId),
      redirectUri,
      scopeCount: requestedScopes.length,
      scopes: requestedScopes,
      flowType: "classic_facebook_login",
    });
    return `${META_OAUTH_BASE_URL}?${params.toString()}`;
  }

  return {
    platform,
    defaultScopes: scopes,
    validateConfig() {
      try {
        ensureMetaConfig(platform);
        return { valid: true, missing: [] };
      } catch {
        if (platform === "threads") {
          return { valid: false, missing: ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI"] };
        }
        return { valid: false, missing: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"] };
      }
    },
    getAuthUrl(input) {
      const state = typeof input === "string" ? input : input?.state;
      return buildAuthUrl(state, scopes);
    },
    getAdvancedAuthUrl(input, additionalScopes = []) {
      const state = typeof input === "string" ? input : input?.state;
      const mergedScopes = Array.from(new Set([...scopes, ...additionalScopes]));
      return buildAuthUrl(state, mergedScopes);
    },
    async exchangeCodeForToken(code) {
      const { appId, appSecret, redirectUri } = ensureMetaConfig(platform);
      try {
        const response = await axios.get(`${META_GRAPH_BASE_URL}/oauth/access_token`, {
          params: {
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
          },
        });
        const data = response.data || {};
        return {
          accessToken: data.access_token || "",
          refreshToken: "",
          tokenType: "Bearer",
          expiresIn: data.expires_in || 60 * 60 * 24 * 60,
          scopes: Array.isArray(data?.granted_scopes) ? data.granted_scopes : scopes,
        };
      } catch (error) {
        console.error("[oauth:meta:token:error]", {
          platform,
          appId: maskAppId(appId),
          redirectUri,
          error: error?.response?.data || error?.message,
        });
        throw normalizeMetaAxiosError(error, "meta_token_exchange_failed");
      }
    },
    async getUserProfile(accessToken) {
      const profile = await fetchMetaGraph("/me", accessToken, { fields: profileFields });
      return mapFacebookProfile(profile);
    },
    async getProfile(accessToken) {
      return this.getUserProfile(accessToken);
    },
    async getPages(accessToken) {
      try {
        const pagesResponse = await fetchMetaGraph("/me/accounts", accessToken, {
          fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
        });
        return Array.isArray(pagesResponse?.data) ? pagesResponse.data : [];
      } catch (error) {
        if (error?.details?.error?.code === 10 || error?.details?.error?.code === 200) {
          throw createMetaError(
            "Unable to read Facebook Pages. Ensure your Meta Login configuration grants Page access.",
            "meta_pages_permission_missing",
            403,
            error.details
          );
        }
        throw error;
      }
    },
    async getManagedEntities(accessToken) {
      const pages = await this.getPages(accessToken);
      return pages.map((page) => ({
        entityType: "page",
        entityId: page.id?.toString() || "",
        name: page.name || "",
        profileImage: "",
        metadata: {
          hasLinkedInstagram: Boolean(page.instagram_business_account?.id),
          linkedInstagramId: page.instagram_business_account?.id || "",
        },
      }));
    },
    async getLinkedInstagramAccount(accessToken, pages) {
      const availablePages = Array.isArray(pages) ? pages : await this.getPages(accessToken);
      const linked = pickFirstLinkedInstagram(availablePages);
      if (!linked) {
        return null;
      }

      let igDetails = linked.instagramAccount;
      if (!igDetails?.username || !igDetails?.name) {
        const fetched = await fetchMetaGraph(`/${linked.instagramAccount.id}`, accessToken, {
          fields: "id,username,name,profile_picture_url",
        });
        igDetails = {
          ...igDetails,
          ...fetched,
        };
      }

      return {
        page: linked.page,
        profile: mapInstagramProfile(igDetails, linked.page),
      };
    },
    async refreshTokenIfNeeded(account) {
      const isExpired = account?.expiresAt && new Date(account.expiresAt).getTime() <= Date.now();
      if (!isExpired) {
        return null;
      }

      const accessToken = account?.getDecryptedAccessToken?.();
      if (!accessToken) {
        throw createMetaError("Meta access token is unavailable.", "meta_token_missing", 400);
      }

      try {
        const { appId, appSecret } = ensureMetaConfig(platform);
        const response = await axios.get(`${META_GRAPH_BASE_URL}/oauth/access_token`, {
          params: {
            grant_type: "fb_exchange_token",
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: accessToken,
          },
        });
        const data = response.data || {};
        return {
          accessToken: data.access_token || "",
          refreshToken: "",
          tokenType: "Bearer",
          expiresIn: data.expires_in || 60 * 60 * 24 * 60,
        };
      } catch (error) {
        throw normalizeMetaAxiosError(error, "meta_token_refresh_failed");
      }
    },
    async disconnectAccount() {
      return { disconnected: true };
    },
    async publishPost() {
      throw createMetaError("Publishing is not yet implemented for this provider.", "meta_publish_not_implemented", 400);
    },
    async getAnalytics() {
      return { available: false, reason: "Not implemented yet." };
    },
  };
}
