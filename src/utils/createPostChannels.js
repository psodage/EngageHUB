import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { getFacebookConnectionEntities } from "./socialAccountEntities";

/**
 * @param {string} channelKey
 * @returns {{ platformKey: string, entityType: string, entityId: string }}
 */
export function parseCreatePostChannelKey(channelKey) {
  const raw = String(channelKey || "").trim();
  if (!raw.startsWith("facebook:")) {
    return { platformKey: raw, entityType: "", entityId: "" };
  }
  const parts = raw.split(":");
  if (parts.length >= 3) {
    return {
      platformKey: "facebook",
      entityType: parts[1] || "profile",
      entityId: parts.slice(2).join(":"),
    };
  }
  return { platformKey: "facebook", entityType: "", entityId: "" };
}

/** @param {string} channelKey */
export function getPlatformKeyFromCreatePostChannelKey(channelKey) {
  return parseCreatePostChannelKey(channelKey).platformKey;
}

/** @param {Record<string, unknown>} entity */
export function buildFacebookCreatePostChannelKey(entity) {
  const entityType = entity.entityType || "profile";
  const entityId = String(entity.entityId || entity.platformUserId || "").trim();
  return entityId ? `facebook:${entityType}:${entityId}` : `facebook:${entityType}`;
}

/**
 * @param {string} channelKey
 * @param {Array<Record<string, unknown>>} [channelOptions]
 */
export function getCreatePostChannelLabel(channelKey, channelOptions = []) {
  const match = channelOptions.find((o) => o.key === channelKey);
  if (match?.label) return match.label;
  const platformKey = getPlatformKeyFromCreatePostChannelKey(channelKey);
  return SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey)?.label || channelKey;
}

/** @param {Record<string, unknown> | null | undefined} account */
/** @param {Record<string, unknown> | null | undefined} [entity] */
function resolveChannelUsername(account, entity = null) {
  const handle = String(entity?.username || account?.username || "").trim().replace(/^@/, "");
  if (handle) return `@${handle}`;
  const name = String(entity?.accountName || account?.accountName || "").trim();
  return name;
}

/** @param {Record<string, unknown> | null | undefined} account */
/** @param {Record<string, unknown> | null | undefined} [entity] */
function resolveAccountProfileImage(account, entity = null) {
  if (entity?.profileImage) return String(entity.profileImage);
  if (account?.profileImage) return String(account.profileImage);
  const entities = Array.isArray(account?.entities) ? account.entities : [];
  const profileEntity = entities.find((e) => e?.entityType === "profile");
  if (profileEntity?.profileImage) return String(profileEntity.profileImage);
  const firstWithImage = entities.find((e) => e?.profileImage);
  return firstWithImage?.profileImage ? String(firstWithImage.profileImage) : "";
}

/** @param {string} channelKey */
export function isMultiChannelPublishable(channelKey) {
  const { platformKey } = parseCreatePostChannelKey(channelKey);
  return ["instagram", "facebook", "threads", "x", "linkedin", "googleBusiness", "youtube"].includes(
    platformKey
  );
}

/**
 * @param {Array<Record<string, unknown>>} connectedAccounts
 * @returns {Array<Record<string, unknown>>}
 */
export function mapAccountsToCreatePostChannelOptions(connectedAccounts) {
  /** @type {Array<Record<string, unknown>>} */
  const options = [];

  for (const config of SOCIAL_PLATFORM_CONFIGS) {
    const account = connectedAccounts.find((a) => a.platform === config.key);
    if (!account?.isConnected) continue;

    if (config.key === "facebook") {
      const entities = getFacebookConnectionEntities(account);
      for (const entity of entities) {
        const entityType = entity.entityType || "profile";
        const isProfile = entityType === "profile";
        const displayName =
          entity.accountName?.trim() ||
          entity.username?.trim()?.replace(/^@/, "") ||
          (isProfile ? "Facebook Profile" : "Facebook Page");
        options.push({
          ...config,
          key: buildFacebookCreatePostChannelKey(entity),
          platformKey: "facebook",
          platformName: config.label,
          username: resolveChannelUsername(account, entity) || displayName,
          accountTypeLabel: isProfile ? "Facebook profile" : "Facebook page",
          label: displayName,
          profileImage: resolveAccountProfileImage(account, entity),
          accountDisplayName: displayName,
          entityId: String(entity.entityId || entity.platformUserId || "").trim(),
          entityType,
        });
      }
      continue;
    }

    const displayName =
      account.accountName?.trim() ||
      account.username?.trim()?.replace(/^@/, "") ||
      config.label;

    options.push({
      ...config,
      platformKey: config.key,
      platformName: config.label,
      username: resolveChannelUsername(account) || displayName,
      accountTypeLabel: "",
      label: displayName,
      profileImage: resolveAccountProfileImage(account),
      accountDisplayName: displayName,
      entityId: "",
      entityType: "",
    });
  }

  return options;
}

/**
 * Lookup map for compose/publish: channel key → account row shaped for that destination.
 * @param {Array<Record<string, unknown>>} connectedAccounts
 */
export function buildConnectedByChannelKey(connectedAccounts) {
  const byPlatform = connectedAccounts.reduce((acc, item) => {
    acc[item.platform] = item;
    return acc;
  }, {});

  /** @type {Record<string, Record<string, unknown>>} */
  const byChannel = {};

  for (const option of mapAccountsToCreatePostChannelOptions(connectedAccounts)) {
    const grouped = byPlatform[option.platformKey];
    if (!grouped) continue;
    byChannel[option.key] = {
      ...grouped,
      accountName: option.accountDisplayName || option.label,
      username: grouped.username,
      profileImage: option.profileImage || grouped.profileImage,
      entityId: option.entityId,
      entityType: option.entityType,
    };
  }

  return byChannel;
}

/** @param {{ platformKey: string, entityId?: string }} channel */
export function buildCreatePostUrl(channel) {
  const params = new URLSearchParams({ platform: channel.platformKey });
  if (channel.entityId) params.set("entity", channel.entityId);
  return `/create-post?${params.toString()}`;
}
