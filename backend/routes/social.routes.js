import { Router } from "express";
import {
  connectInstagramPlatform,
  connectMetaUpgradePlatform,
  connectMetaPlatform,
  connectSocialPlatform,
  createFacebookPost,
  createDiscordPost,
  createGoogleBusinessPost,
  disconnectGoogleBusinessLocationAccount,
  createLinkedInPost,
  createTelegramPost,
  createYouTubePost,
  createXPost,
  facebookPagesSession,
  debugSocialEnvCheck,
  disconnectSocialPlatform,
  disconnectSocialAccountEntity,
  instagramAccountsSession,
  instagramOauthCallback,
  listSocialAccounts,
  listSocialPostHistory,
  manualConnectSocialPlatform,
  metaOauthCallback,
  oauthCallback,
  selectFacebookPage,
  googleBusinessOauthCallback,
  linkedinAccountsSession,
  selectLinkedInAccount,
  postToInstagram,
  googleBusinessLocationsSession,
  refreshSocialPlatform,
  selectInstagramAccount,
  selectGoogleBusinessLocations,
  socialPlatformStatus,
  updateDiscordTargets,
  updateTelegramTargets,
} from "../controllers/social.controller.js";
import {
  connectThreads,
  createThreadsPost,
  disconnectThreads,
  threadsOauthCallback,
} from "../controllers/threads.controller.js";
import {
  connectGithub,
  createGithubActivityCard,
  disconnectGithub,
  getGithubActivity,
  getGithubAnalytics,
  getGithubAutomationCatalog,
  githubOauthCallback,
  listGithubRepos,
  previewGithubAutomation,
  syncGithub,
} from "../controllers/github.controller.js";
import {
  handleLinkedInPostUpload,
  handleSocialPublicUpload,
  handleYouTubeVideoUpload,
  ingestRemoteSocialMedia,
  uploadPublicSocialMedia,
} from "../controllers/upload.controller.js";

export function createSocialRoutes(requireAuth) {
  const router = Router();

  router.get("/debug/env-check", requireAuth, debugSocialEnvCheck);
  router.post("/linkedin/post", requireAuth, handleLinkedInPostUpload, createLinkedInPost);
  router.post("/youtube/post", requireAuth, handleYouTubeVideoUpload, createYouTubePost);
  router.post("/google-business/post", requireAuth, createGoogleBusinessPost);
  router.get("/google-business/locations-session", requireAuth, googleBusinessLocationsSession);
  router.post("/google-business/select-locations", requireAuth, selectGoogleBusinessLocations);
  router.post("/google-business/disconnect-location", requireAuth, disconnectGoogleBusinessLocationAccount);
  router.get("/google-business/callback", googleBusinessOauthCallback);
  // Legacy camelCase path — keep in sync with GOOGLE_BUSINESS_REDIRECT_URI if used in Google Cloud Console
  router.get("/googleBusiness/callback", googleBusinessOauthCallback);
  router.post("/facebook/post", requireAuth, createFacebookPost);
  router.get("/facebook/pages-session", requireAuth, facebookPagesSession);
  router.post("/facebook/select-page", requireAuth, selectFacebookPage);
  router.get("/instagram/accounts-session", requireAuth, instagramAccountsSession);
  router.post("/instagram/select-account", requireAuth, selectInstagramAccount);
  router.get("/linkedin/accounts-session", requireAuth, linkedinAccountsSession);
  router.post("/linkedin/select-account", requireAuth, selectLinkedInAccount);
  router.post("/x/post", requireAuth, createXPost);
  router.get("/accounts", requireAuth, listSocialAccounts);
  router.get("/history", requireAuth, listSocialPostHistory);
  router.get("/threads/connect", requireAuth, connectThreads);
  router.get("/threads/callback", threadsOauthCallback);
  router.post("/threads/disconnect", requireAuth, disconnectThreads);
  router.post("/threads/post", requireAuth, createThreadsPost);
  router.get("/github/connect", requireAuth, connectGithub);
  router.get("/github/callback", githubOauthCallback);
  router.post("/github/disconnect", requireAuth, disconnectGithub);
  router.get("/github/repos", requireAuth, listGithubRepos);
  router.get("/github/analytics", requireAuth, getGithubAnalytics);
  router.get("/github/activity", requireAuth, getGithubActivity);
  router.post("/github/sync", requireAuth, syncGithub);
  router.post("/github/activity-cards", requireAuth, createGithubActivityCard);
  router.get("/github/automation", requireAuth, getGithubAutomationCatalog);
  router.post("/github/automation/preview", requireAuth, previewGithubAutomation);
  router.post("/upload/public-media", requireAuth, handleSocialPublicUpload, uploadPublicSocialMedia);
  router.post("/upload/remote-media", requireAuth, ingestRemoteSocialMedia);
  router.get("/meta/connect", requireAuth, connectMetaPlatform);
  router.get("/meta/upgrade/connect", requireAuth, connectMetaUpgradePlatform);
  router.get("/meta/callback", metaOauthCallback);
  router.get("/instagram/login", requireAuth, connectInstagramPlatform);
  router.get("/instagram/callback", instagramOauthCallback);
  router.post("/instagram/post", requireAuth, postToInstagram);
  router.put("/telegram/targets", requireAuth, updateTelegramTargets);
  router.post("/telegram/post", requireAuth, createTelegramPost);
  router.put("/discord/targets", requireAuth, updateDiscordTargets);
  router.post("/discord/post", requireAuth, createDiscordPost);
  router.get("/:platform/connect", requireAuth, connectSocialPlatform);
  router.post("/:platform/manual-connect", requireAuth, manualConnectSocialPlatform);
  router.get("/:platform/callback", oauthCallback);
  router.post("/:platform/disconnect-account", requireAuth, disconnectSocialAccountEntity);
  router.post("/:platform/disconnect", requireAuth, disconnectSocialPlatform);
  router.post("/:platform/refresh", requireAuth, refreshSocialPlatform);
  router.get("/:platform/status", requireAuth, socialPlatformStatus);

  return router;
}
