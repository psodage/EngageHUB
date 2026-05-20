import { getAppConfig } from "../config/social.config.js";

export function resolveProviderRedirectUri(platform) {
  const config = getAppConfig();

  const map = {
    instagram: process.env.INSTAGRAM_REDIRECT_URI || `${config.appBaseUrl}/api/social/instagram/callback`,
    googleBusiness: process.env.GOOGLE_BUSINESS_REDIRECT_URI || `${config.appBaseUrl}/api/social/google-business/callback`,
    youtube:
      process.env.GOOGLE_YOUTUBE_REDIRECT_URI ||
      process.env.GOOGLE_REDIRECT_URI ||
      `${config.appBaseUrl}/api/social/youtube/callback`,
    threads: process.env.THREADS_REDIRECT_URI || `${config.appBaseUrl}/api/social/threads/callback`,
    linkedin: process.env.LINKEDIN_REDIRECT_URI || `${config.appBaseUrl}/api/social/linkedin/callback`,
    x: process.env.TWITTER_REDIRECT_URI || `${config.appBaseUrl}/api/social/x/callback`,
    reddit: process.env.REDDIT_REDIRECT_URI || `${config.appBaseUrl}/api/social/reddit/callback`,
    pinterest: process.env.PINTEREST_REDIRECT_URI || `${config.appBaseUrl}/api/social/pinterest/callback`,
    discord: process.env.DISCORD_REDIRECT_URI || `${config.appBaseUrl}/api/social/discord/callback`,
    github: process.env.GITHUB_REDIRECT_URI || `${config.appBaseUrl}/api/social/github/callback`,
  };

  return map[platform] || process.env.META_REDIRECT_URI || `${config.appBaseUrl}/api/social/meta/callback`;
}
