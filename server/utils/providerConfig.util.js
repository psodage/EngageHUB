import { getProviderRequiredEnvKeys } from "../config/social.config.js";
import { resolveProviderRedirectUri } from "./redirectUri.util.js";

function maskIdentifier(value) {
  if (!value) return "missing";
  if (value.length <= 8) return "***";
  return `***${value.slice(-8)}`;
}

export function validateProviderConfig(platform) {
  if (platform === "youtube") {
    const missing = [];
    if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!resolveProviderRedirectUri("youtube")) {
      missing.push("GOOGLE_YOUTUBE_REDIRECT_URI or GOOGLE_REDIRECT_URI or APP_BASE_URL");
    }
    return { valid: missing.length === 0, missing };
  }
  if (platform === "googleBusiness") {
    const missing = [];
    if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!resolveProviderRedirectUri("googleBusiness")) {
      missing.push("GOOGLE_BUSINESS_REDIRECT_URI or APP_BASE_URL");
    }
    return { valid: missing.length === 0, missing };
  }
  if (platform === "instagram") {
    const missing = [];
    if (!process.env.INSTAGRAM_CLIENT_ID) missing.push("INSTAGRAM_CLIENT_ID");
    if (!process.env.INSTAGRAM_CLIENT_SECRET) missing.push("INSTAGRAM_CLIENT_SECRET");
    if (!resolveProviderRedirectUri("instagram")) {
      missing.push("INSTAGRAM_REDIRECT_URI or APP_BASE_URL");
    }
    return { valid: missing.length === 0, missing };
  }
  const requiredKeys = getProviderRequiredEnvKeys(platform);
  const missing = requiredKeys.filter((key) => !process.env[key]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getSafeProviderDebugInfo(platform) {
  if (platform === "youtube") {
    return {
      platform,
      clientId: maskIdentifier(process.env.GOOGLE_CLIENT_ID),
      redirectUri: resolveProviderRedirectUri("youtube") || "missing",
    };
  }
  if (platform === "googleBusiness") {
    return {
      platform,
      clientId: maskIdentifier(process.env.GOOGLE_CLIENT_ID),
      redirectUri: resolveProviderRedirectUri("googleBusiness") || "missing",
    };
  }
  if (platform === "linkedin") {
    return {
      platform,
      clientId: maskIdentifier(process.env.LINKEDIN_CLIENT_ID),
      redirectUri: process.env.LINKEDIN_REDIRECT_URI || "missing",
    };
  }
  if (platform === "x") {
    return {
      platform,
      clientId: maskIdentifier(process.env.TWITTER_CLIENT_ID),
      redirectUri: process.env.TWITTER_REDIRECT_URI || "missing",
    };
  }
  if (platform === "reddit") {
    return {
      platform,
      clientId: maskIdentifier(process.env.REDDIT_CLIENT_ID),
      redirectUri: process.env.REDDIT_REDIRECT_URI || "missing",
    };
  }
  if (platform === "pinterest") {
    return {
      platform,
      clientId: maskIdentifier(process.env.PINTEREST_APP_ID),
      redirectUri: process.env.PINTEREST_REDIRECT_URI || "missing",
    };
  }
  if (platform === "discord") {
    return {
      platform,
      clientId: maskIdentifier(process.env.DISCORD_CLIENT_ID),
      redirectUri: process.env.DISCORD_REDIRECT_URI || "missing",
    };
  }
  if (platform === "threads") {
    return {
      platform,
      clientId: maskIdentifier(process.env.THREADS_APP_ID),
      redirectUri: process.env.THREADS_REDIRECT_URI || "missing",
    };
  }
  if (platform === "instagram") {
    return {
      platform,
      clientId: maskIdentifier(process.env.INSTAGRAM_CLIENT_ID),
      redirectUri: resolveProviderRedirectUri("instagram") || "missing",
    };
  }
  if (platform === "github") {
    return {
      platform,
      clientId: maskIdentifier(process.env.GITHUB_CLIENT_ID),
      redirectUri: process.env.GITHUB_REDIRECT_URI || "missing",
    };
  }
  return {
    platform,
    clientId: maskIdentifier(process.env.META_APP_ID),
    redirectUri: process.env.META_REDIRECT_URI || "missing",
  };
}
