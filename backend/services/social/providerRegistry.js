import facebookService from "./facebook.service.js";
import instagramService from "./instagram.service.js";
import linkedinService from "./linkedin.service.js";
import threadsService from "./threads.service.js";
import twitterService from "./twitter.service.js";
import redditService from "./reddit.service.js";
import pinterestService from "./pinterest.service.js";
import telegramService from "./telegram.service.js";
import discordService from "./discord.service.js";
import googleBusinessService from "./googleBusiness.service.js";
import youtubeService from "./youtube.service.js";
import githubService from "./github.service.js";

export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "threads",
  "linkedin",
  "youtube",
  "x",
  "reddit",
  "pinterest",
  "telegram",
  "discord",
  "googleBusiness",
  "github",
];

const providerRegistry = {
  instagram: instagramService,
  facebook: facebookService,
  threads: threadsService,
  x: twitterService,
  reddit: redditService,
  pinterest: pinterestService,
  telegram: telegramService,
  discord: discordService,
  googleBusiness: googleBusinessService,
  google: youtubeService,
  linkedin: linkedinService,
  youtube: youtubeService,
  github: githubService,
};

export function getProvider(platform) {
  return providerRegistry[platform];
}
