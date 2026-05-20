const requiredEnvKeys = [
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "JWT_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "PORT",
  "APP_BASE_URL",
  "CLIENT_BASE_URL",
];

const providerEnvMap = {
  youtube: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  googleBusiness: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  facebook: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],
  instagram: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
  threads: ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_REDIRECT_URI"],
  x: ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET", "TWITTER_REDIRECT_URI"],
  reddit: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_REDIRECT_URI"],
  pinterest: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET", "PINTEREST_REDIRECT_URI"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME"],
  discord: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI"],
  github: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_REDIRECT_URI"],
};

function ensureNoTrailingSlash(value) {
  return typeof value === "string" ? value.replace(/\/+$/, "") : value;
}

export function getAppConfig() {
  return {
    appBaseUrl: ensureNoTrailingSlash(process.env.APP_BASE_URL || "http://localhost:4000"),
    clientBaseUrl: ensureNoTrailingSlash(process.env.CLIENT_BASE_URL || "http://localhost:5173"),
    googleRedirectUri: process.env.GOOGLE_YOUTUBE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
    googleBusinessRedirectUri: process.env.GOOGLE_BUSINESS_REDIRECT_URI,
    twitterRedirectUri: process.env.TWITTER_REDIRECT_URI,
    redditRedirectUri: process.env.REDDIT_REDIRECT_URI,
    pinterestRedirectUri: process.env.PINTEREST_REDIRECT_URI,
    discordRedirectUri: process.env.DISCORD_REDIRECT_URI,
    linkedinRedirectUri: process.env.LINKEDIN_REDIRECT_URI,
    metaRedirectUri: process.env.META_REDIRECT_URI,
    instagramRedirectUri:
      process.env.INSTAGRAM_REDIRECT_URI || `${ensureNoTrailingSlash(process.env.APP_BASE_URL || "http://localhost:4000")}/api/social/instagram/callback`,
    threadsRedirectUri: process.env.THREADS_REDIRECT_URI,
    githubRedirectUri: process.env.GITHUB_REDIRECT_URI,
  };
}

export function getRequiredEnvStatus() {
  return requiredEnvKeys.reduce((acc, key) => {
    acc[key] = Boolean(process.env[key]);
    return acc;
  }, {});
}

export function getProviderEnvStatus() {
  return Object.entries(providerEnvMap).reduce((acc, [platform, keys]) => {
    acc[platform] = keys.reduce((keyAcc, key) => {
      keyAcc[key] = Boolean(process.env[key]);
      return keyAcc;
    }, {});
    if (platform === "youtube") {
      acc[platform].GOOGLE_YOUTUBE_REDIRECT_URI = Boolean(
        process.env.GOOGLE_YOUTUBE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI
      );
    }
    if (platform === "googleBusiness") {
      acc[platform].GOOGLE_BUSINESS_REDIRECT_URI = Boolean(process.env.GOOGLE_BUSINESS_REDIRECT_URI);
    }
    return acc;
  }, {});
}

export function getProviderRequiredEnvKeys(platform) {
  return providerEnvMap[platform] || [];
}
