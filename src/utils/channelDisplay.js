import { SOCIAL_PLATFORM_CONFIGS, isHiddenConnectPlatform } from "../data/socialPlatforms";
import { getFacebookConnectionEntities } from "./socialAccountEntities";

/**
 * @param {Array<Record<string, unknown>>} entities
 * @param {string} [entityId]
 */
export function findFacebookEntityById(entities, entityId) {
  const id = String(entityId || "").trim();
  if (!id) return null;
  return (
    entities.find((e) => String(e.entityId || e.platformUserId || "").trim() === id) || null
  );
}

/**
 * Shape a grouped Facebook account for a single profile or Page destination.
 * @param {Record<string, unknown>} groupedAccount
 * @param {string} [entityId]
 */
export function resolveFacebookDisplayAccount(groupedAccount, entityId) {
  if (!groupedAccount?.isConnected || groupedAccount.platform !== "facebook") {
    return groupedAccount;
  }

  const entities = getFacebookConnectionEntities(groupedAccount);
  if (!entities.length) return groupedAccount;

  const entity =
    findFacebookEntityById(entities, entityId) ||
    entities.find((e) => e.entityType === "profile") ||
    entities[0];

  const entityType = entity.entityType || "profile";
  const resolvedEntityId = String(entity.entityId || entity.platformUserId || "").trim();
  const isProfile = entityType === "profile";
  const entityMeta =
    entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
      ? entity.metadata
      : {};

  return {
    ...groupedAccount,
    accountName:
      entity.accountName?.trim() ||
      entity.name?.trim() ||
      (isProfile ? "Facebook Profile" : "Facebook Page"),
    username: entity.username || groupedAccount.username || "",
    profileImage:
      entity.profileImage ||
      entityMeta.pictureUrl ||
      "",
    entityType,
    entityId: resolvedEntityId,
    metadata: { ...(groupedAccount.metadata || {}), ...entityMeta },
    _scopedFacebookEntity: entity,
  };
}

/** @param {import("../data/socialPlatforms").SocialAccount | Record<string, unknown>} account */
export function getChannelDisplayInfo(account) {
  const platformKey = account?.platform;
  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((p) => p.key === platformKey);
  const platformLabel = platformConfig?.label || platformKey || "Channel";
  const displayName =
    account?.accountName?.trim() ||
    account?.username?.trim()?.replace(/^@/, "") ||
    platformLabel;
  const rawUsername = account?.username?.trim();
  let handle = rawUsername ? `@${rawUsername.replace(/^@/, "")}` : null;
  if (platformKey === "facebook" && account?.entityType) {
    const entityId = String(account.entityId || "").trim();
    handle =
      account.entityType === "profile"
        ? entityId
          ? `Profile · ${entityId}`
          : "Profile"
        : entityId
          ? `Page · ${entityId}`
          : "Page";
  }
  const profileImage =
    account?.profileImage ||
    `https://placehold.co/80x80/e2e8f0/64748b?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;

  return {
    platformKey,
    platformLabel,
    platformConfig,
    displayName,
    handle,
    profileImage,
    sortKey: displayName.toLowerCase(),
  };
}

/**
 * @param {Record<string, unknown>} account
 * @param {Record<string, unknown>} entity
 */
function buildFacebookSidebarChannel(account, entity) {
  const entityType = entity.entityType || "profile";
  const entityId = String(entity.entityId || entity.platformUserId || "").trim();
  const isProfile = entityType === "profile";
  const displayName =
    entity.accountName?.trim() ||
    entity.username?.trim()?.replace(/^@/, "") ||
    (isProfile ? "Facebook Profile" : "Facebook Page");
  const entityMeta =
    entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
      ? entity.metadata
      : {};
  const profileImage =
    entity.profileImage ||
    entityMeta.pictureUrl ||
    `https://placehold.co/80x80/e2e8f0/64748b?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;
  const search = entityId ? `?entity=${encodeURIComponent(entityId)}` : "";

  return {
    account,
    entity,
    sidebarKey: entityId ? `facebook:${entityType}:${entityId}` : `facebook:${entityType}`,
    platformKey: "facebook",
    entityId,
    entityType,
    platformLabel: "Facebook",
    displayName,
    handle: isProfile ? "Profile" : "Page",
    profileImage,
    path: `/channels/facebook${search}`,
    sortKey: `${isProfile ? "0" : "1"}:${displayName.toLowerCase()}`,
  };
}

/** @param {Array<Record<string, unknown>>} accounts */
export function mapConnectedChannelsForSidebar(accounts) {
  /** @type {Array<Record<string, unknown>>} */
  const channels = [];

  for (const account of accounts) {
    if (!account.isConnected || isHiddenConnectPlatform(account.platform)) continue;

    if (account.platform === "facebook") {
      const entities = getFacebookConnectionEntities(account);
      if (entities.length) {
        entities.forEach((entity, index) => {
          channels.push({
            ...buildFacebookSidebarChannel(account, entity),
            isDefaultEntity: index === 0,
          });
        });
        continue;
      }
    }

    const info = getChannelDisplayInfo(account);
    channels.push({
      account,
      entity: null,
      sidebarKey: info.platformKey,
      platformKey: info.platformKey,
      entityId: "",
      entityType: "",
      path: `/channels/${info.platformKey}`,
      ...info,
    });
  }

  return channels.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}

/** @param {{ platformKey: string, entityId?: string, entityType?: string }} channel @param {string} tabId */
export function buildChannelTabPath(channel, tabId) {
  const params = new URLSearchParams();
  if (channel.entityId) params.set("entity", channel.entityId);
  if (tabId && tabId !== "profile") params.set("tab", tabId);
  const qs = params.toString();
  return `/channels/${channel.platformKey}${qs ? `?${qs}` : ""}`;
}

/** @param {{ platformKey: string, entityId?: string }} channel */
export function buildScopedCreatePostPath(channel) {
  const params = new URLSearchParams({ platform: channel.platformKey });
  if (channel.entityId) params.set("entity", channel.entityId);
  return `/create-post?${params.toString()}`;
}
