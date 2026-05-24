import { SOCIAL_PLATFORM_CONFIGS, isHiddenConnectPlatform } from "../data/socialPlatforms";
import { resolveFacebookPageCreatePostPath } from "./createPostChannels";
import { getFacebookConnectionEntities, getLinkedInConnectionEntities } from "./socialAccountEntities";

/**
 * @param {Array<Record<string, unknown>>} entities
 * @param {string} [entityId]
 */
export function findFacebookEntityById(entities, entityId) {
  return findConnectionEntityById(entities, entityId);
}

/** @param {Array<Record<string, unknown>>} entities @param {string} [entityId] */
export function findLinkedInEntityById(entities, entityId) {
  return findConnectionEntityById(entities, entityId);
}

/** @param {Array<Record<string, unknown>>} entities @param {string} [entityId] */
function findConnectionEntityById(entities, entityId) {
  const id = String(entityId || "").trim();
  if (!id) return null;
  return (
    entities.find((e) => String(e.entityId || e.platformUserId || "").trim() === id) || null
  );
}

/**
 * Shape a grouped Facebook account for a single Page destination.
 * @param {Record<string, unknown>} groupedAccount
 * @param {string} [entityId]
 */
export function resolveFacebookDisplayAccount(groupedAccount, entityId) {
  if (!groupedAccount?.isConnected || groupedAccount.platform !== "facebook") {
    return groupedAccount;
  }

  const entities = getFacebookConnectionEntities(groupedAccount);
  if (!entities.length) return groupedAccount;

  const entity = findFacebookEntityById(entities, entityId) || entities[0];

  const entityType = "page";
  const resolvedEntityId = String(entity.entityId || entity.platformUserId || "").trim();
  const entityMeta =
    entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
      ? entity.metadata
      : {};

  return {
    ...groupedAccount,
    accountName: entity.accountName?.trim() || entity.name?.trim() || "Facebook Page",
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

/**
 * Shape a grouped LinkedIn account for a single profile or company page destination.
 * @param {Record<string, unknown>} groupedAccount
 * @param {string} [entityId]
 */
export function resolveLinkedInDisplayAccount(groupedAccount, entityId) {
  if (!groupedAccount?.isConnected || groupedAccount.platform !== "linkedin") {
    return groupedAccount;
  }

  const entities = getLinkedInConnectionEntities(groupedAccount);
  if (!entities.length) return groupedAccount;

  const entity = findLinkedInEntityById(entities, entityId) || entities[0];
  const entityType = entity.entityType === "organization" ? "organization" : "profile";
  const resolvedEntityId = String(entity.entityId || entity.platformUserId || "").trim();
  const entityMeta =
    entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
      ? entity.metadata
      : {};

  return {
    ...groupedAccount,
    accountName:
      entity.accountName?.trim() ||
      entity.username?.trim()?.replace(/^@/, "") ||
      (entityType === "organization" ? "LinkedIn Page" : "LinkedIn Profile"),
    username: entity.username || groupedAccount.username || "",
    profileImage: entity.profileImage || entityMeta.pictureUrl || "",
    entityType,
    entityId: resolvedEntityId,
    metadata: { ...(groupedAccount.metadata || {}), ...entityMeta },
    _scopedLinkedInEntity: entity,
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
    handle = entityId ? `Page · ${entityId}` : "Page";
  }
  if (platformKey === "linkedin" && account?.entityType) {
    const entityId = String(account.entityId || "").trim();
    if (account.entityType === "organization") {
      handle = entityId ? `Company page · ${entityId}` : "Company page";
    } else {
      handle = "Profile";
    }
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
  const entityId = String(entity.entityId || entity.platformUserId || "").trim();
  const displayName =
    entity.accountName?.trim() ||
    entity.username?.trim()?.replace(/^@/, "") ||
    "Facebook Page";
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
    sidebarKey: entityId ? `facebook:page:${entityId}` : "facebook:page",
    platformKey: "facebook",
    entityId,
    entityType: "page",
    platformLabel: "Facebook",
    displayName,
    handle: "Page",
    profileImage,
    path: `/channels/facebook${search}`,
    sortKey: displayName.toLowerCase(),
  };
}

/**
 * @param {Record<string, unknown>} account
 * @param {Record<string, unknown>} entity
 */
function buildLinkedInSidebarChannel(account, entity) {
  const entityType = entity.entityType === "organization" ? "organization" : "profile";
  const entityId = String(entity.entityId || entity.platformUserId || "").trim();
  const displayName =
    entity.accountName?.trim() ||
    entity.username?.trim()?.replace(/^@/, "") ||
    (entityType === "organization" ? "LinkedIn Page" : "LinkedIn Profile");
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
    sidebarKey: entityId ? `linkedin:${entityType}:${entityId}` : `linkedin:${entityType}`,
    platformKey: "linkedin",
    entityId,
    entityType,
    platformLabel: "LinkedIn",
    displayName,
    handle: entityType === "organization" ? "Company page" : "Profile",
    profileImage,
    path: `/channels/linkedin${search}`,
    sortKey: displayName.toLowerCase(),
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

    if (account.platform === "linkedin") {
      const entities = getLinkedInConnectionEntities(account);
      if (entities.length) {
        entities.forEach((entity, index) => {
          channels.push({
            ...buildLinkedInSidebarChannel(account, entity),
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
/**
 * @param {{ platformKey: string, entityId?: string, entityType?: string }} channel
 * @param {Record<string, unknown> | null | undefined} [groupedAccount] Used for Facebook Page fallback when no entity is scoped
 */
export function buildScopedCreatePostPath(channel, groupedAccount = null) {
  if (channel.platformKey === "facebook") {
    if (channel.entityType === "page" && channel.entityId) {
      const params = new URLSearchParams({ platform: "facebook", entity: channel.entityId });
      return `/create-post?${params.toString()}`;
    }
    if (groupedAccount) return resolveFacebookPageCreatePostPath(groupedAccount);
    return "/create-post?platform=facebook";
  }
  if (channel.platformKey === "linkedin" && channel.entityId) {
    const params = new URLSearchParams({ platform: "linkedin", entity: channel.entityId });
    return `/create-post?${params.toString()}`;
  }
  const params = new URLSearchParams({ platform: channel.platformKey });
  if (channel.entityId) params.set("entity", channel.entityId);
  return `/create-post?${params.toString()}`;
}
