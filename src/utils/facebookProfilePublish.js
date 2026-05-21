import {
  buildFacebookCreatePostChannelKey,
  getPlatformKeyFromCreatePostChannelKey,
  parseCreatePostChannelKey,
} from "./createPostChannels";
import { getFacebookConnectionEntities } from "./socialAccountEntities";

/** Meta removed personal timeline posting from the Graph API (v2.4+). Pages still work. */
export const FACEBOOK_PROFILE_API_PUBLISH_MESSAGE =
  "Facebook no longer allows third-party apps to publish to personal profiles via API. " +
  "Post from a connected Facebook Page (e.g. Personal Blog or NextGen Computer), or use Share to profile below.";

export function isFacebookProfileChannelKey(channelKey) {
  const { platformKey, entityType } = parseCreatePostChannelKey(channelKey);
  return platformKey === "facebook" && entityType === "profile";
}

export function isFacebookProfileApiPublishSupported() {
  return false;
}

export function isFacebookProfileChannelPublishable(channelKey) {
  if (!isFacebookProfileChannelKey(channelKey)) return true;
  return isFacebookProfileApiPublishSupported();
}

/** First connected Facebook Page entity id for create-post deep links. */
export function getFirstFacebookPageEntityId(account) {
  const pages = getFacebookConnectionEntities(account).filter((e) => e.entityType === "page");
  const page = pages[0];
  return page ? String(page.entityId || page.platformUserId || "").trim() : "";
}

/**
 * Create-post URL for a Facebook destination. Profile ids resolve to the first Page.
 * @param {{ platformKey: string, entityId?: string, entityType?: string }} channel
 */
export function buildFacebookCreatePostPath(channel) {
  const entityId = String(channel.entityId || "").trim();
  const entityType = String(channel.entityType || "").trim().toLowerCase();

  if (entityType === "profile") {
    return null;
  }

  const params = new URLSearchParams({ platform: "facebook" });
  if (entityId) params.set("entity", entityId);
  return `/create-post?${params.toString()}`;
}

/**
 * @param {Record<string, unknown> | null | undefined} groupedFacebookAccount
 * @param {string} [preferredPageEntityId]
 */
export function resolveFacebookPageCreatePostPath(groupedFacebookAccount, preferredPageEntityId = "") {
  const preferred = String(preferredPageEntityId || "").trim();
  const pages = getFacebookConnectionEntities(groupedFacebookAccount).filter((e) => e.entityType === "page");
  const match =
    (preferred && pages.find((p) => String(p.entityId || p.platformUserId || "").trim() === preferred)) ||
    pages[0];
  if (!match) return "/create-post?platform=facebook";
  const pageId = String(match.entityId || match.platformUserId || "").trim();
  return buildFacebookCreatePostChannelKey(match).includes(":")
    ? `/create-post?platform=facebook&entity=${encodeURIComponent(pageId)}`
    : "/create-post?platform=facebook";
}

/**
 * Opens Facebook's share UI so the user can post to their timeline manually (Meta-approved path).
 * @param {{ caption?: string, linkUrl?: string, mediaUrl?: string }} content
 */
export function openFacebookProfileShareDialog(content = {}) {
  const caption = String(content.caption || "").trim();
  const linkUrl = String(content.linkUrl || "").trim();
  const mediaUrl = String(content.mediaUrl || "").trim();
  const shareTarget = linkUrl || mediaUrl;

  if (!shareTarget && !caption) {
    throw new Error("Add a caption, link, or image URL before sharing to your Facebook profile.");
  }

  const params = new URLSearchParams();
  if (shareTarget) params.set("u", shareTarget);
  if (caption) params.set("quote", caption);

  const url = `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
  const popup = window.open(url, "facebook-profile-share", "width=600,height=520,noopener,noreferrer");
  if (!popup) {
    throw new Error("Allow pop-ups for this site to open the Facebook share window.");
  }
  return url;
}
