import axios from "axios";
import { STORAGE_KEYS } from "../data/constants";
import { apiUnreachableMessage, getClientApiBaseUrl } from "../config/api.js";
import { formatHttpApiError } from "../utils/httpApiError";
import { isNgrokHttpUrl, ngrokSkipBrowserWarningHeader } from "../utils/tunnelApiHeaders";

const API_BASE_URL = getClientApiBaseUrl();

const socialClient = axios.create({
  baseURL: API_BASE_URL,
});

socialClient.interceptors.request.use((config) => {
  let token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (!token) {
    try {
      const rawDraft = sessionStorage.getItem(STORAGE_KEYS.draftSignupSession);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed?.authDraftToken) {
          token = parsed.authDraftToken;
        }
      }
    } catch {
      // Ignore parsing/access errors
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (isNgrokHttpUrl(API_BASE_URL)) {
    Object.assign(config.headers, ngrokSkipBrowserWarningHeader());
  }
  return config;
});

socialClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      const code = error?.code;
      const msg = error?.message || "";
      if (msg === "Network Error" || code === "ERR_NETWORK") {
        return Promise.reject(new Error(apiUnreachableMessage));
      }
    }
    return Promise.reject(error);
  }
);

function parseApiError(error, fallbackMessage) {
  return formatHttpApiError(error, fallbackMessage);
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

function pickGoogleRedirectUri(platformKey, oauthRedirectUri, oauthDetail) {
  const explicit = String(oauthRedirectUri || "").trim();
  if (explicit.startsWith("http")) return explicit;
  const detail = String(oauthDetail || "").trim();
  if (detail.startsWith("http") && !isLowValueOAuthDetail(detail)) return detail;
  return "";
}

export function getSocialOAuthErrorMessage(reason, platform, oauthDetail = "", oauthRedirectUri = "") {
  const normalized = (reason || "").toLowerCase();
  const platformKey = (platform || "").toLowerCase();
  const detail = (oauthDetail || "").trim();
  if (!normalized) return `Failed to connect ${platform}. Please retry.`;
  if (normalized.includes("github_rate_limited") || normalized.includes("rate limit")) {
    return "GitHub API rate limit reached. Try again in a few minutes.";
  }
  if (normalized.includes("invalid_scope")) {
    if (platformKey === "github") {
      return "GitHub rejected one or more requested permissions. Verify your OAuth app callback URL and scopes, then retry.";
    }
    if (platformKey === "linkedin") {
      return "LinkedIn rejected one or more requested permissions. Verify your LinkedIn app products/scopes (for example, Share on LinkedIn) and confirm the redirect URI matches exactly, then retry.";
    }
    if (platformKey === "instagram") {
      return "Instagram rejected one or more requested permissions. Verify Instagram Login products/scopes in your app settings and retry.";
    }
    if (platformKey === "threads") {
      return "Threads rejected the requested scopes. This usually happens when Threads is accidentally routed through Facebook Login or your Threads app is missing approved permissions. Please retry and verify your Threads app settings + redirect URI.";
    }
    return "Meta rejected one or more permissions. Please retry and verify your app is configured for requested scopes.";
  }
  if (normalized.includes("missing_code")) {
    return "Missing authorization code from provider. Please retry the login flow.";
  }
  if (normalized.includes("login_canceled") || normalized.includes("access_denied")) {
    return "Connection was canceled before authorization completed.";
  }
  if (normalized.includes("no_facebook_pages")) {
    return "No Facebook Pages were found for this account. Create or assign a Page before connecting.";
  }
  if (normalized.includes("no_page_found")) {
    return "No Facebook Page could be loaded. Confirm your Meta Login configuration includes page access.";
  }
  if (normalized.includes("no_google_business_accounts") || normalized.includes("no_google_business_locations")) {
    return "No Google Business Profiles found for this account.";
  }
  if (normalized.includes("google_business_api_disabled")) {
    const base =
      "Google Business Profile APIs are not enabled for your Google Cloud project. In Google Cloud Console → APIs & Services → Library, enable “My Business Account Management API” and “My Business Business Information API” (same project as GOOGLE_CLIENT_ID). Add OAuth scope https://www.googleapis.com/auth/business.manage on the consent screen, then reconnect.";
    return detail ? `${base} Google says: ${detail}` : base;
  }
  if (normalized.includes("google_business_quota_exceeded")) {
    const base =
      "Google Business Profile API rate limit reached. Wait 1–2 minutes, avoid clicking Connect repeatedly, then try again. If this keeps happening, request Business Profile API access/quota in Google Cloud Console (APIs & Services → Enabled APIs → My Business Account Management API → Quotas).";
    return detail ? `${base} (${detail})` : base;
  }
  if (normalized.includes("google_business_accounts_failed") || normalized.includes("google_business_locations_failed")) {
    if (detail && /quota exceeded|rate limit/i.test(detail)) {
      return getSocialOAuthErrorMessage("google_business_quota_exceeded", platform, detail);
    }
    const base =
      "Could not load Google Business Profiles. Ensure Business Profile APIs are enabled in Google Cloud Console and try again.";
    return detail ? `${base} (${detail})` : base;
  }
  if (normalized.includes("google_business_scope_missing")) {
    const base = "Google Business permission is required. Reconnect and approve the business.manage scope.";
    return detail ? `${base} (${detail})` : base;
  }
  if (normalized.includes("no_locations_selected")) {
    return "Select at least one business profile.";
  }
  if (normalized.includes("selected_location_not_found")) {
    return "Selected Google Business Profile was not found. Please reload and try again.";
  }
  if (normalized.includes("expired_session")) {
    return "Connection session expired. Please reconnect Google Business Profile.";
  }
  if (normalized.includes("no_instagram_professional_account")) {
    return "No linked Instagram professional account found. Connect your Instagram account to a Facebook Page first.";
  }
  if (normalized.includes("meta_pages_permission_missing")) {
    return "Instagram permissions are missing.";
  }
  if (normalized.includes("instagram_personal_account")) {
    return "This Instagram account is a personal profile. Switch to a Business or Creator account in the Instagram app (Settings → Account type and tools), then connect again.";
  }
  if (normalized.includes("missing_config_id")) {
    return "Meta Login is misconfigured. Add META_CONFIG_ID to the backend environment and retry.";
  }
  if (normalized.includes("invalid_state")) {
    return "OAuth session expired or became invalid. Start the connection again.";
  }
  if (normalized.includes("invalid_client")) {
    if (platformKey === "instagram") {
      return "Instagram OAuth client configuration is invalid. Verify INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, and INSTAGRAM_REDIRECT_URI in your Meta Instagram app (Business login settings).";
    }
    if (platformKey === "github") {
      return "GitHub OAuth client configuration is invalid. Verify GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI.";
    }
    return "OAuth client configuration is invalid. Verify provider credentials and redirect URI.";
  }
  if (
    normalized.includes("google_redirect_uri_mismatch") ||
    normalized.includes("redirect_uri_mismatch")
  ) {
    if (platformKey === "googlebusiness") {
      const uri = pickGoogleRedirectUri(platformKey, oauthRedirectUri, detail);
      if (uri) {
        return (
          `Google OAuth redirect URI mismatch for Business Profile. In Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs, add this exact URL (must match GOOGLE_BUSINESS_REDIRECT_URI in .env): ${uri}`
        );
      }
      return (
        "Google OAuth redirect URI mismatch for Business Profile. Add GOOGLE_BUSINESS_REDIRECT_URI from your .env to Google Cloud Console → Credentials → Authorized redirect URIs (check server startup log: googleOAuth.googleBusinessRedirectUri)."
      );
    }
    if (platformKey === "youtube") {
      const uri = pickGoogleRedirectUri(platformKey, oauthRedirectUri, detail);
      if (uri) {
        return (
          `Google OAuth redirect URI mismatch for YouTube. In Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs, add this exact URL (must match GOOGLE_YOUTUBE_REDIRECT_URI or GOOGLE_REDIRECT_URI in .env): ${uri}`
        );
      }
      return (
        "Google OAuth redirect URI mismatch for YouTube. Add your YouTube callback URL from .env to Google Cloud Console → Credentials → Authorized redirect URIs (check server startup log: googleOAuth.youtubeRedirectUri)."
      );
    }
    return "Google OAuth redirect URI mismatch. Add the exact callback URL from your .env to Google Cloud Console → Credentials → Authorized redirect URIs.";
  }
  if (
    normalized.includes("instagram_redirect_uri_mismatch") ||
    (platformKey === "instagram" &&
      normalized.includes("redirect") &&
      (normalized.includes("invalid") || normalized.includes("mismatch")))
  ) {
    const uri = pickGoogleRedirectUri(platformKey, oauthRedirectUri, oauthDetail);
    if (uri) {
      return (
        `Instagram OAuth redirect URI mismatch. In Meta Developer Console → your Instagram app → Instagram → Business login settings → OAuth redirect URIs, add this exact URL (must match INSTAGRAM_REDIRECT_URI in .env / Render): ${uri}`
      );
    }
    return (
      "Instagram OAuth redirect URI mismatch. Add the exact callback URL from INSTAGRAM_REDIRECT_URI to Meta → Business login settings → OAuth redirect URIs (check for trailing slashes)."
    );
  }
  if (normalized.includes("threads_redirect_uri_mismatch") || normalized.includes("callback_mismatch")) {
    return "Threads redirect URI mismatch. In Meta Developer Console, add the exact callback URL from THREADS_REDIRECT_URI, and use the same URL when connecting (local vs production).";
  }
  if (
    normalized.includes("redirect") &&
    (normalized.includes("white-list") ||
      normalized.includes("whitelist") ||
      normalized.includes("not white") ||
      normalized.includes("1349168") ||
      normalized.includes("oauth settings"))
  ) {
    const uri = detail || "https://engagehub.onrender.com/api/social/threads/callback";
    return `Threads redirect URL is not allowed in your Meta app. In the Threads app (not AntiSocial V2): Use cases → Access the Threads API → Customize → Settings, add this exact Redirect URI: ${uri} — also enable Client OAuth Login and Web OAuth Login under Facebook Login → Settings if that product is on the app.`;
  }
  if (normalized.includes("threads_invalid_client")) {
    return "Threads app credentials are invalid. Use the Threads App ID and Threads App Secret from Meta → App settings → Basic (not the Facebook app ID).";
  }
  if (normalized.includes("threads_invalid_auth_code")) {
    return "Threads authorization expired or was already used. Start Connect again without refreshing the callback page.";
  }
  if (normalized.includes("oauth_code_invalid")) {
    return "Authorization code expired or was already used. Start Connect again and do not refresh the callback page.";
  }
  if (
    normalized.includes("used_authorization_code") ||
    detail.toLowerCase().includes("used_authorization_code")
  ) {
    return "Threads authorization code was already used. Click Connect again (do not refresh or bookmark the callback URL).";
  }
  if (normalized.includes("token_exchange_failed") || normalized.includes("token_exchange_forbidden")) {
    if (platformKey === "threads") {
      return detail
        ? `Threads token exchange failed. Click Connect again without refreshing the callback page. (${detail})`
        : "Threads token exchange failed. Click Connect again without refreshing the callback page.";
    }
    if (platformKey === "googlebusiness" || platformKey === "youtube") {
      const base =
        "Google token exchange failed. Ensure GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET match your OAuth client, redirect URIs in .env match Google Cloud Console exactly, and the same API host handles both connect and callback (local vs Render).";
      return detail ? `${base} Google says: ${detail}` : base;
    }
    if (platformKey === "github") {
      return "Could not complete GitHub authorization. Reconnect your GitHub account.";
    }
    return detail
      ? `Could not complete token exchange with provider. ${detail}`
      : "Could not complete token exchange with provider. Please reconnect.";
  }
  if (normalized.includes("threads_token_exchange_failed") || normalized.includes("token_error")) {
    if (platformKey === "github") {
      return "Could not complete GitHub authorization. Reconnect your GitHub account.";
    }
    if (platformKey === "threads") {
      const base =
        "Could not complete Threads authorization. Confirm your Meta app has a Threads Tester role for your account, redirect URLs match THREADS_REDIRECT_URI, and you are using the Threads app credentials.";
      return detail ? `${base} (${detail})` : base;
    }
    return "Could not complete token exchange with provider. Please reconnect.";
  }
  if (normalized.includes("linkedin_orgs_forbidden")) {
    return "LinkedIn blocked listing company pages (missing product/scopes or app restrictions). Your profile connection may still work; fix LinkedIn app permissions and reconnect.";
  }
  if (normalized.includes("linkedin_orgs_failed")) {
    return "LinkedIn company page lookup failed. Your profile connection may still work; retry or check LinkedIn API status.";
  }
  if (normalized === "instagram_graph_error") {
    const base =
      "Instagram’s API returned an error while finishing login. Confirm the account is a professional or creator profile, that your Meta app has Instagram Login with the right scopes, and try connecting again.";
    return detail ? `${base} (${detail})` : base;
  }
  if (normalized === "threads_app_credentials_invalid") {
    return detail
      ? detail
      : "Threads App ID and App Secret in the server environment are invalid or from a different Meta app. In Meta Developer Console → your app → App settings → Basic, copy Threads App ID and Threads App secret into THREADS_APP_ID and THREADS_APP_SECRET on Render (and .env for local).";
  }
  if (normalized === "threads_graph_error" || normalized === "threads_long_lived_exchange_failed") {
    const base =
      "Threads API returned an error while finishing login. In Meta Developer Console, confirm you use the Threads App ID and Threads App Secret (not the Facebook app ID), add your account as a Threads Tester, and that THREADS_REDIRECT_URI matches the OAuth redirect URL exactly.";
    return detail ? `${base} (${detail})` : base;
  }
  if (normalized === "account_already_linked" || normalized.includes("already linked to another engagehub user")) {
    const label = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "This social account";
    return `${label} is already connected to another EngageHub account. Sign in with that account and disconnect it under Channels, or connect a different account.`;
  }
  if (normalized === "account_already_connected") {
    const label = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "This account";
    return `${label} is already connected here. Choose a different login when authorizing, or disconnect the existing account first.`;
  }
  return reason;
}

export async function getSocialAccounts() {
  try {
    const { data } = await socialClient.get("/api/social/accounts");
    return data.data.accounts || [];
  } catch (error) {
    throw parseApiError(error, "Unable to fetch social accounts.");
  }
}

export async function startSocialConnect(platform, options = {}) {
  try {
    const params = new URLSearchParams();
    const normalized = (platform || "").toLowerCase();
    const isFacebook = normalized === "facebook";
    const isInstagram = normalized === "instagram";
    if (normalized === "threads") {
      params.set("scope_set", "publish");
    }
    if (isFacebook) {
      params.set("platform", normalized);
    }
    if (options.flow) params.set("flow", options.flow);
    const query = params.toString() ? `?${params.toString()}` : "";
    const endpoint = isInstagram
      ? "/api/social/instagram/login"
      : isFacebook
        ? "/api/social/meta/connect"
        : `/api/social/${platform}/connect`;
    const { data } = await socialClient.get(`${endpoint}${query}`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, `Unable to connect ${platform}.`);
  }
}

export async function getFacebookPagesSession(sessionId) {
  try {
    const qs = new URLSearchParams();
    qs.set("session", String(sessionId || "").trim());
    const { data } = await socialClient.get(`/api/social/facebook/pages-session?${qs.toString()}`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to load Facebook Pages.");
  }
}

export async function selectFacebookPage(sessionId, pageIds) {
  try {
    const ids = Array.isArray(pageIds) ? pageIds : [pageIds];
    const { data } = await socialClient.post("/api/social/facebook/select-page", {
      sessionId,
      pageIds: ids.map((id) => String(id || "").trim()).filter(Boolean),
    });
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to finish Facebook connection.");
  }
}

export async function getInstagramAccountsSession(sessionId) {
  try {
    const qs = new URLSearchParams();
    qs.set("session", String(sessionId || "").trim());
    const { data } = await socialClient.get(`/api/social/instagram/accounts-session?${qs.toString()}`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to load Instagram professional accounts.");
  }
}

export async function selectInstagramAccount({ sessionId, instagramAccountId, autoConnectLinkedFacebookPage = false }) {
  try {
    const { data } = await socialClient.post("/api/social/instagram/select-account", {
      sessionId,
      instagramAccountId,
      autoConnectLinkedFacebookPage,
    });
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to finish Instagram connection.");
  }
}

export async function getLinkedInAccountsSession(sessionId) {
  try {
    const qs = new URLSearchParams();
    qs.set("session", String(sessionId || "").trim());
    const { data } = await socialClient.get(`/api/social/linkedin/accounts-session?${qs.toString()}`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to load LinkedIn accounts.");
  }
}

export async function selectLinkedInAccount({ sessionId, accountId, accountType }) {
  try {
    const { data } = await socialClient.post("/api/social/linkedin/select-account", {
      sessionId,
      accountId,
      accountType,
    });
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to finish LinkedIn connection.");
  }
}

export async function getGoogleBusinessLocationsSession(sessionId) {
  try {
    const qs = new URLSearchParams();
    qs.set("session", String(sessionId || "").trim());
    const { data } = await socialClient.get(`/api/social/google-business/locations-session?${qs.toString()}`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to load Google Business Profiles.");
  }
}

export async function selectGoogleBusinessLocations({ sessionId, locationIds }) {
  try {
    const { data } = await socialClient.post("/api/social/google-business/select-locations", {
      sessionId,
      locationIds: Array.isArray(locationIds) ? locationIds : [],
    });
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to finish Google Business connection.");
  }
}

export async function disconnectGoogleBusinessLocation(locationId) {
  try {
    const { data } = await socialClient.post("/api/social/google-business/disconnect-location", { locationId });
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to disconnect Google Business location.");
  }
}

export async function manualConnectSocial(platform) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/manual-connect`);
    return data.data.account;
  } catch (error) {
    throw parseApiError(error, `Unable to manually connect ${platform}.`);
  }
}

export async function disconnectSocial(platform) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/disconnect`);
    return data.data.account;
  } catch (error) {
    throw parseApiError(error, `Unable to disconnect ${platform}.`);
  }
}

export async function disconnectSocialAccount(platform, accountId) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/disconnect-account`, { accountId });
    return data.data;
  } catch (error) {
    throw parseApiError(error, `Unable to disconnect ${platform} account.`);
  }
}

export async function refreshSocial(platform) {
  try {
    const { data } = await socialClient.post(`/api/social/${platform}/refresh`);
    return data.data;
  } catch (error) {
    throw parseApiError(error, `Unable to refresh ${platform}.`);
  }
}

export async function getSocialEnvDebug() {
  try {
    const { data } = await socialClient.get("/api/social/debug/env-check");
    return data.data;
  } catch (error) {
    throw parseApiError(error, "Unable to fetch OAuth environment diagnostics.");
  }
}

/**
 * Uploads image/video to the server and returns a public URL suitable for Instagram publishing.
 */
export async function uploadSocialPublicMediaFile(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await socialClient.post("/api/social/upload/public-media", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data?.url || "";
  } catch (error) {
    throw parseApiError(error, "Unable to upload media.");
  }
}

/** Host a remote image/video on the API server (for LinkedIn and other APIs that need a fetchable file). */
export async function ingestRemoteSocialMediaUrl(remoteUrl) {
  try {
    const { data } = await socialClient.post("/api/social/upload/remote-media", { url: remoteUrl });
    return data.data?.url || "";
  } catch (error) {
    throw parseApiError(error, "Unable to import media from URL.");
  }
}

/**
 * Publishes to the connected Instagram professional account (server uses stored token; never returned here).
 */
export async function publishInstagramPost(body) {
  try {
    const { data } = await socialClient.post("/api/social/instagram/post", body);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish to Instagram.");
  }
}

export async function postToX(content) {
  try {
    const { data } = await socialClient.post("/api/social/x/post", { content });
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish post on X.");
  }
}

export async function uploadSocialPublicMedia(file) {
  try {
    const form = new FormData();
    form.append("file", file);
    const { data } = await socialClient.post("/api/social/upload/public-media", form);
    return data.data?.url || "";
  } catch (error) {
    throw parseApiError(error, "Unable to upload media.");
  }
}

export async function postToThreads(payload) {
  try {
    const { data } = await socialClient.post("/api/social/threads/post", payload);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish post on Threads.");
  }
}

/**
 * @param {{
 *   content: string,
 *   targetType: 'profile' | 'organization',
 *   organizationId: string | null,
 *   mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK',
 *   mediaUrl?: string,
 *   linkUrl?: string,
 * }} payload
 * @param {Blob | File | null | undefined} [mediaFile] Required for IMAGE/VIDEO (field name `media`).
 */
export async function postToLinkedIn(payload, mediaFile) {
  try {
    const isBlob = typeof Blob !== "undefined" && mediaFile instanceof Blob;
    if (isBlob) {
      const fd = new FormData();
      fd.append("targetType", payload.targetType);
      if (payload.organizationId != null && payload.organizationId !== "") {
        fd.append("organizationId", String(payload.organizationId));
      }
      fd.append("mediaType", payload.mediaType);
      fd.append("content", payload.content ?? "");
      fd.append("linkUrl", payload.linkUrl ?? "");
      fd.append("mediaUrl", payload.mediaUrl ?? "");
      const filename =
        typeof File !== "undefined" && mediaFile instanceof File && mediaFile.name ? mediaFile.name : "upload";
      fd.append("media", mediaFile, filename);
      const { data } = await socialClient.post("/api/social/linkedin/post", fd);
      return data;
    }
    const { data } = await socialClient.post("/api/social/linkedin/post", payload);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish post on LinkedIn.");
  }
}

/**
 * @param {{
 *   message: string,
 *   mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK',
 *   mediaUrl?: string,
 *   linkUrl?: string,
 *   entityId?: string,
 *   entityType?: 'page',
 * }} payload
 */
export async function postToFacebook(payload) {
  try {
    const { data } = await socialClient.post("/api/social/facebook/post", payload);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish post on Facebook.");
  }
}

/**
 * Upload a video to the connected YouTube channel (multipart field `video`). Server uses stored Google tokens only.
 * @param {{
 *   channelId?: string,
 *   title: string,
 *   description?: string,
 *   tags?: string,
 *   categoryId?: string,
 *   privacyStatus: 'public' | 'private' | 'unlisted',
 *   madeForKids: boolean,
 *   videoFile: File | Blob,
 * }} payload
 * @param {(evt: { loaded: number, total: number }) => void} [onUploadProgress] Progress for the request body to your API (not YouTube).
 */
export async function postYouTubeVideo(payload, onUploadProgress) {
  try {
    const fd = new FormData();
    if (payload.channelId != null && String(payload.channelId).trim() !== "") {
      fd.append("channelId", String(payload.channelId).trim());
    }
    fd.append("title", payload.title ?? "");
    fd.append("description", payload.description ?? "");
    fd.append("tags", payload.tags ?? "");
    fd.append("categoryId", String(payload.categoryId ?? "22"));
    fd.append("privacyStatus", payload.privacyStatus);
    fd.append("madeForKids", payload.madeForKids ? "true" : "false");
    const file = payload.videoFile;
    const filename =
      typeof File !== "undefined" && file instanceof File && file.name ? file.name : "video";
    fd.append("video", file, filename);
    const { data } = await socialClient.post("/api/social/youtube/post", fd, {
      timeout: 0,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: onUploadProgress
        ? (pe) => {
            const total = Number(pe.total) || 0;
            const loaded = Number(pe.loaded) || 0;
            if (total > 0) onUploadProgress({ loaded, total });
          }
        : undefined,
    });
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to upload video to YouTube.");
  }
}

/**
 * @param {{ chatId: string, chatTitle: string, chatType: 'channel'|'group'|'supergroup' }[]} targets
 */
export async function putTelegramTargets(targets) {
  try {
    const { data } = await socialClient.put("/api/social/telegram/targets", { targets });
    return data.data?.account;
  } catch (error) {
    throw parseApiError(error, "Unable to save Telegram targets.");
  }
}

/**
 * @param {{
 *   chatId: string,
 *   message: string,
 *   mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK',
 *   mediaUrl?: string,
 *   linkUrl?: string,
 *   buttonText?: string,
 *   buttonUrl?: string,
 * }} payload
 */
export async function postToTelegram(payload) {
  try {
    const { data } = await socialClient.post("/api/social/telegram/post", payload);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish to Telegram.");
  }
}

/**
 * @param {{ guildId: string, channelId: string, connectionType: string, guildName?: string, channelName?: string, webhookUrl?: string }[]} targets
 */
export async function putDiscordTargets(targets) {
  try {
    const { data } = await socialClient.put("/api/social/discord/targets", { targets });
    return data.data?.account;
  } catch (error) {
    throw parseApiError(error, "Unable to save Discord targets.");
  }
}

/**
 * @param {{
 *   guildId: string,
 *   channelId: string,
 *   message: string,
 *   mediaType: 'TEXT' | 'IMAGE' | 'EMBED' | 'LINK',
 *   mediaUrl?: string,
 *   linkUrl?: string,
 *   embedTitle?: string,
 *   embedDescription?: string,
 *   embedUrl?: string,
 * }} payload
 */
export async function postToDiscord(payload) {
  try {
    const { data } = await socialClient.post("/api/social/discord/post", payload);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish to Discord.");
  }
}

/**
 * @param {{
 *   locationId: string,
 *   accountId: string,
 *   postType: 'STANDARD' | 'EVENT' | 'OFFER',
 *   summary: string,
 *   mediaUrl?: string,
 *   ctaType?: string,
 *   ctaUrl?: string,
 *   eventTitle?: string,
 *   offerTitle?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   couponCode?: string,
 *   redeemUrl?: string,
 *   termsConditions?: string,
 * }} payload
 */
export async function postToGoogleBusiness(payload) {
  try {
    const { data } = await socialClient.post("/api/social/google-business/post", payload);
    return data;
  } catch (error) {
    throw parseApiError(error, "Unable to publish post on Google Business Profile.");
  }
}

/**
 * @param {{
 *   platform: string,
 *   targetId?: string,
 *   mediaType?: string,
 *   search?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   page?: number,
 *   limit?: number,
 * }} params
 */
export async function getPostHistory(params = {}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.platform) searchParams.set("platform", params.platform);
    if (params.targetId) searchParams.set("targetId", params.targetId);
    if (params.mediaType) searchParams.set("mediaType", params.mediaType);
    if (params.search) searchParams.set("search", params.search);
    if (params.startDate) searchParams.set("startDate", params.startDate);
    if (params.endDate) searchParams.set("endDate", params.endDate);
    searchParams.set("page", String(params.page ?? 1));
    searchParams.set("limit", String(params.limit ?? 10));
    const qs = searchParams.toString();
    const { data } = await socialClient.get(`/api/social/history?${qs}`);
    return {
      records: Array.isArray(data.data) ? data.data : [],
      pagination: data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
  } catch (error) {
    throw parseApiError(error, "Unable to load post history.");
  }
}
