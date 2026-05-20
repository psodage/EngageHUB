import { getAppConfig } from "../config/social.config.js";

function tryParseHost(url) {
  if (!url || typeof url !== "string") return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Trim and canonicalize OAuth redirect URIs (must match Meta/Google console exactly). */
export function normalizeOAuthRedirectUri(uri) {
  const trimmed = (uri || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
      url.protocol = "https:";
    }
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

/** Base URL for OAuth callbacks from the incoming API request (Render/Vite proxy/ngrok). */
export function getRequestOAuthBaseUrl(req) {
  if (!req || typeof req.get !== "function") return "";
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  if (!host) return "";
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return normalizeOAuthRedirectUri(`${proto}://${host}`);
}

const CALLBACK_PATHS = {
  instagram: "/api/social/instagram/callback",
  googleBusiness: "/api/social/google-business/callback",
  youtube: "/api/social/youtube/callback",
  threads: "/api/social/threads/callback",
  linkedin: "/api/social/linkedin/callback",
  x: "/api/social/x/callback",
  reddit: "/api/social/reddit/callback",
  pinterest: "/api/social/pinterest/callback",
  discord: "/api/social/discord/callback",
  github: "/api/social/github/callback",
  facebook: "/api/social/meta/callback",
  meta: "/api/social/meta/callback",
};

export function resolveProviderRedirectUri(platform, options = {}) {
  const config = getAppConfig();
  const { req, explicitRedirectUri } = options;

  const envMap = {
    instagram: process.env.INSTAGRAM_REDIRECT_URI,
    googleBusiness: process.env.GOOGLE_BUSINESS_REDIRECT_URI,
    youtube: process.env.GOOGLE_YOUTUBE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
    threads: process.env.THREADS_REDIRECT_URI,
    linkedin: process.env.LINKEDIN_REDIRECT_URI,
    x: process.env.TWITTER_REDIRECT_URI,
    reddit: process.env.REDDIT_REDIRECT_URI,
    pinterest: process.env.PINTEREST_REDIRECT_URI,
    discord: process.env.DISCORD_REDIRECT_URI,
    github: process.env.GITHUB_REDIRECT_URI,
    facebook: process.env.META_REDIRECT_URI,
    meta: process.env.META_REDIRECT_URI,
  };

  const fromExplicit = normalizeOAuthRedirectUri(explicitRedirectUri || "");
  if (fromExplicit) return fromExplicit;

  const fromEnv = normalizeOAuthRedirectUri(envMap[platform] || "");
  if (fromEnv) return fromEnv;

  const requestBase = getRequestOAuthBaseUrl(req);
  const callbackPath = CALLBACK_PATHS[platform];
  if (requestBase && callbackPath) {
    return normalizeOAuthRedirectUri(`${requestBase}${callbackPath}`);
  }

  const fallbackPath = callbackPath || CALLBACK_PATHS.meta;
  return normalizeOAuthRedirectUri(`${config.appBaseUrl}${fallbackPath}`);
}

/** Instagram redirect URI used when starting OAuth (prefers env, else live request host). */
export function resolveInstagramRedirectUri(req) {
  return resolveProviderRedirectUri("instagram", { req });
}

/** Warn when APP_BASE_URL and OAuth redirect URIs use different hosts (common redirect_uri_mismatch cause). */
export function getGoogleOAuthRedirectWarnings() {
  const config = getAppConfig();
  const appHost = tryParseHost(config.appBaseUrl);
  const warnings = [];
  for (const platform of ["youtube", "googleBusiness"]) {
    const redirectUri = resolveProviderRedirectUri(platform);
    const redirectHost = tryParseHost(redirectUri);
    if (!redirectUri) continue;
    if (appHost && redirectHost && appHost !== redirectHost) {
      warnings.push({
        platform,
        redirectUri,
        appBaseUrl: config.appBaseUrl,
        message:
          `${platform}: APP_BASE_URL host (${appHost}) differs from OAuth redirect host (${redirectHost}). ` +
          `Register this exact redirect URI in Google Cloud Console: ${redirectUri}`,
      });
    }
  }
  return warnings;
}

export function getInstagramOAuthRedirectWarnings() {
  const config = getAppConfig();
  const appHost = tryParseHost(config.appBaseUrl);
  const redirectUri = resolveProviderRedirectUri("instagram");
  const redirectHost = tryParseHost(redirectUri);
  const warnings = [];
  if (!redirectUri) {
    warnings.push({
      platform: "instagram",
      redirectUri: "",
      message:
        "instagram: No redirect URI configured. Set INSTAGRAM_REDIRECT_URI or APP_BASE_URL, then add the callback URL in Meta → Instagram → Business login settings → OAuth redirect URIs.",
    });
    return warnings;
  }
  if (appHost && redirectHost && appHost !== redirectHost) {
    warnings.push({
      platform: "instagram",
      redirectUri,
      appBaseUrl: config.appBaseUrl,
      message:
        `instagram: APP_BASE_URL host (${appHost}) differs from OAuth redirect host (${redirectHost}). ` +
        `Register this exact redirect URI in Meta Business login settings: ${redirectUri}`,
    });
  }
  if (!process.env.INSTAGRAM_REDIRECT_URI?.trim()) {
    warnings.push({
      platform: "instagram",
      redirectUri,
      message:
        `instagram: INSTAGRAM_REDIRECT_URI is unset; using ${redirectUri}. ` +
        "Set INSTAGRAM_REDIRECT_URI on production to this exact value and register it in Meta → Instagram → Business login settings → OAuth redirect URIs.",
    });
  }
  return warnings;
}
