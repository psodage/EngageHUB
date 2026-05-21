import SocialAccount from "../../models/SocialAccount.js";
import { SOCIAL_PLATFORMS } from "./providerRegistry.js";
import { getPlatformCapabilities } from "../../config/platformCapabilities.js";
import { encryptToken } from "../../utils/crypto.js";
import { parseDiscordWebhookUrl } from "./discordPublish.service.js";

function normalizePlatform(platform) {
  if (platform === "google") return "youtube";
  return platform;
}

/** Entity types that represent a distinct OAuth login (not pages/orgs/locations on the same login). */
const OAUTH_ROOT_ENTITY_TYPES = new Set(["profile", "bot", "business", "professional"]);

function isOAuthRootEntityType(entityType) {
  return OAUTH_ROOT_ENTITY_TYPES.has(entityType || "profile");
}

/**
 * Strip webhook secrets before returning Discord metadata to the client.
 * @param {Record<string, unknown>} metadata
 */
function sanitizeDiscordClientMetadata(metadata) {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};
  if (Array.isArray(m.discordTargets)) {
    m.discordTargets = m.discordTargets.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      const { webhookUrlEnc: _w, ...pub } = row;
      return pub;
    });
  }
  return m;
}

function mapAccount(account) {
  const plain = account?.toObject?.({ depopulate: true }) || account;
  const expiresAt = plain.expiresAt ? new Date(plain.expiresAt) : null;
  const isExpired = !!expiresAt && expiresAt.getTime() <= Date.now();
  const rawMeta = plain.metadata || {};
  const metadata = plain.platform === "discord" ? sanitizeDiscordClientMetadata(rawMeta) : rawMeta;
  return {
    id: plain._id,
    platform: plain.platform,
    platformUserId: plain.platformUserId,
    entityType: plain.entityType || "profile",
    entityId: plain.entityId || "",
    accountName: plain.accountName,
    username: plain.username,
    email: plain.email,
    profileImage: plain.profileImage,
    tokenType: plain.tokenType,
    expiresAt,
    isTokenExpired: isExpired,
    scopes: plain.scopes || [],
    capabilities: plain.capabilities || [],
    isConnected: plain.isConnected,
    isPrimary: Boolean(plain.isPrimary),
    parentAccountId: plain.parentAccountId || null,
    connectedByUserId: plain.connectedByUserId || plain.userId,
    metadata,
    lastSyncedAt: plain.lastSyncedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

export async function getAccountsForUser(userId) {
  const docs = await SocialAccount.find({ userId }).sort({ createdAt: -1 });
  const grouped = docs.reduce((acc, item) => {
    const key = item.platform;
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapAccount(item));
    return acc;
  }, {});

  const rows = SOCIAL_PLATFORMS.map((platform) => {
    const entities = grouped[platform] || [];
    const primary = entities.find((entity) => entity.isPrimary) || entities[0] || null;
    const visibleEntities =
      platform === "facebook"
        ? entities.filter((entity) => entity.entityType === "page")
        : entities;
    const visiblePrimary =
      visibleEntities.find((entity) => entity.isPrimary) || visibleEntities[0] || primary;

    return {
      platform,
      isConnected: entities.some((entity) => entity.isConnected),
      capabilities: getPlatformCapabilities(platform)?.badges || [],
      supportLevel: getPlatformCapabilities(platform)?.supportLevel || "limited",
      accountName: visiblePrimary?.accountName || primary?.accountName || "",
      username: visiblePrimary?.username || primary?.username || "",
      profileImage: visiblePrimary?.profileImage || primary?.profileImage || "",
      entityType: visiblePrimary?.entityType || primary?.entityType || "profile",
      platformUserId: visiblePrimary?.platformUserId || primary?.platformUserId || "",
      metadata: visiblePrimary?.metadata || primary?.metadata || {},
      lastSyncedAt: visiblePrimary?.lastSyncedAt || primary?.lastSyncedAt || null,
      entities: visibleEntities,
    };
  });

  const dryRun = String(process.env.GOOGLE_BUSINESS_DRY_RUN || "").trim().toLowerCase() === "true";
  if (dryRun) {
    const gb = rows.find((row) => row.platform === "googleBusiness");
    const hasLocation = gb?.entities?.some((entity) => entity.entityType === "location");
    if (gb?.isConnected && !hasLocation) {
      const accountId = String(process.env.GOOGLE_BUSINESS_DEBUG_ACCOUNT_ID || "dry-run-account").trim();
      const locationId = String(process.env.GOOGLE_BUSINESS_DEBUG_LOCATION_ID || "dry-run-location").trim();
      gb.entities.push({
        id: "dry-run-google-business-location",
        platform: "googleBusiness",
        platformUserId: gb.platformUserId || "",
        entityType: "location",
        entityId: locationId,
        accountName: "Dry-run test location (no real GBP)",
        username: gb.username || "",
        email: gb.email || "",
        profileImage: "",
        tokenType: gb.entities.find((e) => e.entityType === "profile")?.tokenType || "Bearer",
        expiresAt: gb.entities.find((e) => e.entityType === "profile")?.expiresAt || null,
        isTokenExpired: false,
        scopes: [],
        capabilities: ["posting"],
        isConnected: true,
        isPrimary: false,
        parentAccountId: null,
        connectedByUserId: userId,
        metadata: {
          googleBusinessAccountId: accountId,
          dryRunPlaceholder: true,
          managedEntity: { googleBusinessAccountId: accountId, title: "Dry-run test location" },
        },
        lastSyncedAt: null,
        createdAt: null,
        updatedAt: null,
      });
    }
  }

  return rows;
}

export async function getAccountStatus(userId, platform) {
  const normalizedPlatform = normalizePlatform(platform);
  const account = await SocialAccount.findOne({ userId, platform: normalizedPlatform });
  if (!account) return { platform: normalizedPlatform, isConnected: false };
  return mapAccount(account);
}

export async function upsertConnectedAccount({ userId, platform, profile, tokenData }) {
  const normalizedPlatform = normalizePlatform(platform);
  const entityType = profile.entityType || "profile";
  const entityId = profile.entityId || profile.platformUserId;
  const platformUserId = String(profile.platformUserId || "").trim();
  if (!platformUserId) {
    throw new Error("Unable to identify social account from provider profile.");
  }

  const ownerId = userId?.toString?.() || String(userId);
  const existingOwner = await SocialAccount.findOne({
    platform: normalizedPlatform,
    platformUserId,
  });
  if (existingOwner) {
    const existingOwnerId = existingOwner.userId?.toString?.() || String(existingOwner.userId);
    if (existingOwnerId !== ownerId) {
      throw new Error("This social account is already linked to another EngageHub user.");
    }
  }

  if (isOAuthRootEntityType(entityType)) {
    const existingForUser = await SocialAccount.findOne({
      userId,
      platform: normalizedPlatform,
      platformUserId,
      entityType,
    });
    const updatingSame =
      existingForUser &&
      String(existingForUser.entityId || "").trim() === String(entityId || "").trim() &&
      String(existingForUser.platformUserId || "").trim() === platformUserId;
    if (existingForUser && !updatingSame) {
      const err = new Error("This account is already connected to your EngageHub profile.");
      err.code = "account_already_connected";
      throw err;
    }
  }

  const hasPrimary = await SocialAccount.exists({
    userId,
    platform: normalizedPlatform,
    isPrimary: true,
    isConnected: true,
  });
  const shouldBePrimary =
    profile.isPrimary === true || (profile.isPrimary !== false && !hasPrimary);

  const now = new Date();
  const setDoc = {
    platformUserId,
    entityType,
    entityId,
    accountName: profile.accountName || "",
    username: profile.username || "",
    email: profile.email || "",
    profileImage: profile.profileImage || "",
    tokenType: tokenData.tokenType || "Bearer",
    expiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
    scopes: tokenData.scopes || [],
    isConnected: true,
    isPrimary: shouldBePrimary,
    capabilities: Array.isArray(profile.capabilities) ? profile.capabilities : profile?.metadata?.capabilities || [],
    metadata: profile.metadata || {},
    lastSyncedAt: now,
    accessToken: encryptToken(tokenData.accessToken || ""),
    refreshToken: encryptToken(tokenData.refreshToken || ""),
    connectedByUserId: userId,
  };
  if (profile.pagePublishingTokens && typeof profile.pagePublishingTokens === "object") {
    setDoc.pagePublishingTokens = profile.pagePublishingTokens;
  }

  const account = await SocialAccount.findOneAndUpdate(
    { userId, platform: normalizedPlatform, entityType, entityId },
    {
      $set: setDoc,
      $setOnInsert: {
        userId,
        platform: normalizedPlatform,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return mapAccount(account);
}

export async function disconnectAccount(userId, platform) {
  const normalizedPlatform = normalizePlatform(platform);
  await SocialAccount.deleteMany({ userId, platform: normalizedPlatform });
  return { platform: normalizedPlatform, isConnected: false };
}

/**
 * Disconnect a single OAuth root account (or one non-root entity). Root disconnect removes all
 * rows sharing the same platformUserId (e.g. LinkedIn orgs, Facebook pages for that Meta user).
 */
export async function disconnectAccountById(userId, accountId) {
  const account = await SocialAccount.findOne({ _id: accountId, userId });
  if (!account) {
    const err = new Error("Connected account not found.");
    err.status = 404;
    err.code = "account_not_found";
    throw err;
  }

  const normalizedPlatform = account.platform;
  const platformUserId = String(account.platformUserId || "").trim();

  // Facebook profile + pages are separate rows (different entityIds); never cascade-delete by platformUserId.
  if (
    normalizedPlatform !== "facebook" &&
    isOAuthRootEntityType(account.entityType) &&
    platformUserId
  ) {
    await SocialAccount.deleteMany({ userId, platform: normalizedPlatform, platformUserId });
  } else {
    await SocialAccount.deleteOne({ _id: accountId, userId });
  }

  const remaining = await SocialAccount.find({
    userId,
    platform: normalizedPlatform,
    isConnected: true,
  }).sort({ createdAt: -1 });
  if (remaining.length && !remaining.some((row) => row.isPrimary)) {
    const nextPrimary = remaining.find((row) => isOAuthRootEntityType(row.entityType)) || remaining[0];
    if (nextPrimary) {
      nextPrimary.isPrimary = true;
      await nextPrimary.save();
    }
  }

  return {
    platform: normalizedPlatform,
    isConnected: remaining.length > 0,
    removedAccountId: accountId,
    remainingCount: remaining.length,
  };
}

export async function disconnectGoogleBusinessLocation(userId, locationIdRaw) {
  const locationId = locationIdRaw != null ? String(locationIdRaw).trim() : "";
  if (!locationId) {
    const err = new Error("locationId is required.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  const deleted = await SocialAccount.findOneAndDelete({
    userId,
    platform: "googleBusiness",
    entityType: "location",
    entityId: locationId,
  });
  if (!deleted) {
    const err = new Error("Selected Google Business location not found.");
    err.status = 404;
    err.code = "selected_location_not_found";
    throw err;
  }
  const remaining = await SocialAccount.countDocuments({
    userId,
    platform: "googleBusiness",
    entityType: "location",
  });
  return {
    locationId,
    removed: true,
    remainingLocations: remaining,
  };
}

export async function refreshAccountToken(userId, platform, refreshed) {
  const normalizedPlatform = normalizePlatform(platform);

  if (normalizedPlatform === "googleBusiness") {
    const docs = await SocialAccount.find({ userId, platform: "googleBusiness" });
    if (!docs.length) {
      throw new Error("No account connected for this platform.");
    }
    for (const acc of docs) {
      acc.setEncryptedAccessToken(refreshed.accessToken);
      if (refreshed.refreshToken) acc.setEncryptedRefreshToken(refreshed.refreshToken);
      acc.tokenType = refreshed.tokenType || acc.tokenType;
      acc.expiresAt = refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : acc.expiresAt;
      acc.lastSyncedAt = new Date();
      acc.isConnected = true;
      await acc.save();
    }
    const primary =
      docs.find((d) => d.entityType === "profile") || docs.find((d) => d.isPrimary) || docs[0];
    return mapAccount(primary);
  }

  const account = await SocialAccount.findOne({ userId, platform: normalizedPlatform });
  if (!account) {
    throw new Error("No account connected for this platform.");
  }

  account.setEncryptedAccessToken(refreshed.accessToken);
  if (refreshed.refreshToken) account.setEncryptedRefreshToken(refreshed.refreshToken);
  account.tokenType = refreshed.tokenType || account.tokenType;
  account.expiresAt = refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : account.expiresAt;
  account.lastSyncedAt = new Date();
  account.isConnected = true;
  await account.save();

  return mapAccount(account);
}

export async function getStoredAccountForProvider(userId, platform) {
  return SocialAccount.findOne({ userId, platform: normalizePlatform(platform) });
}

/**
 * Resolve the Facebook Page SocialAccount row for publishing.
 * @param {import("mongodb").ObjectId} userId
 * @param {string | null | undefined} entityId Facebook Page id from the client
 * @param {"page" | ""} [entityTypeHint] From create-post channel key (`facebook:page:…`)
 */
export async function getFacebookAccountForPublish(userId, entityId, entityTypeHint = "") {
  const normalized = entityId != null && String(entityId).trim() ? String(entityId).trim() : "";
  const typeHint = String(entityTypeHint || "").trim().toLowerCase();

  if (typeHint === "profile") {
    return null;
  }

  if (normalized) {
    const page = await SocialAccount.findOne({
      userId,
      platform: "facebook",
      entityType: "page",
      entityId: normalized,
      isConnected: true,
    });
    if (page) return page;
    const byPlatformUserId = await SocialAccount.findOne({
      userId,
      platform: "facebook",
      entityType: "page",
      platformUserId: normalized,
      isConnected: true,
    });
    if (byPlatformUserId) return byPlatformUserId;
  }

  return (
    (await SocialAccount.findOne({ userId, platform: "facebook", entityType: "page", isConnected: true })) ||
    (await SocialAccount.findOne({ userId, platform: "facebook", isPrimary: true, isConnected: true, entityType: "page" }))
  );
}

/** LinkedIn stores one row per profile plus optional organization rows; tokens are duplicated. Prefer the profile row for publishing. */
export async function getLinkedInAccountForToken(userId) {
  const platform = "linkedin";
  let doc =
    (await SocialAccount.findOne({ userId, platform, entityType: "profile" })) ||
    (await SocialAccount.findOne({ userId, platform, isPrimary: true })) ||
    (await SocialAccount.findOne({ userId, platform }));
  return doc;
}

export async function getLinkedInOrganizationAccount(userId, organizationId) {
  if (!organizationId) return null;
  return SocialAccount.findOne({
    userId,
    platform: "linkedin",
    entityType: "organization",
    entityId: String(organizationId),
  });
}

/**
 * @param {import("mongodb").ObjectId} userId
 * @returns {Promise<import("mongoose").HydratedDocument<unknown>[]>}
 */
export async function listYouTubeAccountsForUser(userId) {
  return SocialAccount.find({ userId, platform: "youtube", isConnected: true }).sort({ createdAt: -1 });
}

/**
 * Resolve which stored YouTube row to use for upload. Multiple connections require an explicit channel id.
 * @param {import("mongodb").ObjectId} userId
 * @param {string | undefined | null} channelIdRaw
 * @returns {Promise<{ error: string | null, account: import("mongoose").HydratedDocument<unknown> | null, resolvedChannelId: string }>}
 */
export async function resolveYouTubeAccountForUpload(userId, channelIdRaw) {
  const docs = await listYouTubeAccountsForUser(userId);
  if (!docs.length) {
    return { error: "not_connected", account: null, resolvedChannelId: "" };
  }

  const requested = channelIdRaw != null && String(channelIdRaw).trim() ? String(channelIdRaw).trim() : "";

  if (docs.length === 1) {
    const only = docs[0];
    const cid = String(only.platformUserId || "").trim();
    if (!cid) {
      return { error: "channel_incomplete", account: null, resolvedChannelId: "" };
    }
    if (requested && requested !== cid) {
      return { error: "channel_not_allowed", account: null, resolvedChannelId: "" };
    }
    return { error: null, account: only, resolvedChannelId: cid };
  }

  if (!requested) {
    return { error: "channel_required", account: null, resolvedChannelId: "" };
  }

  const match = docs.find((d) => String(d.platformUserId || "").trim() === requested);
  if (!match) {
    return { error: "channel_not_allowed", account: null, resolvedChannelId: "" };
  }

  return { error: null, account: match, resolvedChannelId: requested };
}

/**
 * Persist refreshed tokens on a specific social account document (needed when multiple YouTube rows exist).
 * @param {import("mongoose").Types.ObjectId} accountId
 * @param {{ accessToken: string, refreshToken?: string, tokenType?: string, expiresIn?: number | null }} refreshed
 */
export async function refreshAccountTokenById(accountId, refreshed) {
  const account = await SocialAccount.findById(accountId);
  if (!account) {
    throw new Error("No account connected for this platform.");
  }
  account.setEncryptedAccessToken(refreshed.accessToken);
  if (refreshed.refreshToken) account.setEncryptedRefreshToken(refreshed.refreshToken);
  account.tokenType = refreshed.tokenType || account.tokenType;
  account.expiresAt = refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : account.expiresAt;
  account.lastSyncedAt = new Date();
  account.isConnected = true;
  await account.save();
  return mapAccount(account);
}

/** Prefer profile row; tokens are synced across all googleBusiness entity rows after refresh. */
export async function getGoogleBusinessAccountForToken(userId) {
  const platform = "googleBusiness";
  return (
    (await SocialAccount.findOne({ userId, platform, entityType: "profile" })) ||
    (await SocialAccount.findOne({ userId, platform, isPrimary: true })) ||
    (await SocialAccount.findOne({ userId, platform }))
  );
}

export async function getGoogleBusinessLocationAccount(userId, locationId) {
  if (locationId === undefined || locationId === null || String(locationId).trim() === "") return null;
  return SocialAccount.findOne({
    userId,
    platform: "googleBusiness",
    entityType: "location",
    entityId: String(locationId).trim(),
  });
}

const TELEGRAM_TARGET_TYPES = new Set(["channel", "group", "supergroup"]);
const TELEGRAM_MAX_TARGETS = 40;
const TELEGRAM_CHAT_ID_MAX = 128;

function normalizeTelegramChatId(raw) {
  const s = raw != null ? String(raw).trim() : "";
  return s;
}

/**
 * @param {string} chatId
 */
function isAllowedTelegramChatId(chatId) {
  if (!chatId || chatId.length > TELEGRAM_CHAT_ID_MAX) return false;
  if (chatId.includes("<") || chatId.includes(">") || chatId.includes("\n") || chatId.includes("\0")) return false;
  if (chatId.startsWith("@")) {
    const u = chatId.slice(1);
    return /^[a-zA-Z0-9_]{5,32}$/.test(u);
  }
  return /^-?\d+$/.test(chatId);
}

/**
 * @param {import("mongodb").ObjectId} userId
 * @param {unknown} bodyTargets
 */
export async function replaceTelegramPostingTargets(userId, bodyTargets) {
  if (!Array.isArray(bodyTargets)) {
    const err = new Error("targets must be an array.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (bodyTargets.length > TELEGRAM_MAX_TARGETS) {
    const err = new Error(`You can save at most ${TELEGRAM_MAX_TARGETS} Telegram targets.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  /** @type {{ chatId: string, chatTitle: string, chatType: string }[]} */
  const cleaned = [];
  const seen = new Set();

  for (const row of bodyTargets) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    if ("__proto__" in row || "constructor" in row) {
      const err = new Error("Invalid target entry.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    const chatId = normalizeTelegramChatId(row.chatId);
    const chatTitle =
      row.chatTitle != null ? String(row.chatTitle).trim().slice(0, 256) : "";
    const chatTypeRaw =
      row.chatType != null ? String(row.chatType).trim().toLowerCase() : "";
    if (!chatId || !isAllowedTelegramChatId(chatId)) {
      const err = new Error("Each target needs a valid chatId (numeric id, -100… id, or @public_username).");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!chatTitle) {
      const err = new Error("Each target needs a chatTitle.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!TELEGRAM_TARGET_TYPES.has(chatTypeRaw)) {
      const err = new Error("chatType must be channel, group, or supergroup.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    const key = chatId;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ chatId, chatTitle, chatType: chatTypeRaw });
  }

  const account =
    (await SocialAccount.findOne({ userId, platform: "telegram", entityType: "bot" })) ||
    (await SocialAccount.findOne({ userId, platform: "telegram", isPrimary: true })) ||
    (await SocialAccount.findOne({ userId, platform: "telegram" }));

  if (!account || !account.isConnected) {
    const err = new Error("Telegram is not connected.");
    err.status = 400;
    err.code = "not_connected";
    throw err;
  }

  account.metadata = { ...(account.metadata || {}), telegramTargets: cleaned };
  account.lastSyncedAt = new Date();
  await account.save();
  return mapAccount(account);
}

/**
 * @param {import("mongodb").ObjectId} userId
 * @param {string} chatIdRaw
 */
export async function resolveTelegramPostingTargetForUser(userId, chatIdRaw) {
  const chatId = normalizeTelegramChatId(chatIdRaw);
  if (!chatId || !isAllowedTelegramChatId(chatId)) {
    return null;
  }
  const account =
    (await SocialAccount.findOne({ userId, platform: "telegram", entityType: "bot" })) ||
    (await SocialAccount.findOne({ userId, platform: "telegram", isPrimary: true })) ||
    (await SocialAccount.findOne({ userId, platform: "telegram" }));
  if (!account?.metadata || !Array.isArray(account.metadata.telegramTargets)) {
    return null;
  }
  const hit = account.metadata.telegramTargets.find((t) => t && String(t.chatId).trim() === chatId);
  if (!hit) return null;
  return {
    chatId: String(hit.chatId).trim(),
    chatTitle: String(hit.chatTitle || "").trim(),
    chatType: String(hit.chatType || "").trim().toLowerCase(),
  };
}

const DISCORD_MAX_TARGETS = 40;
const DISCORD_LABEL_MAX = 128;

function isDiscordSnowflake(raw) {
  const s = raw != null ? String(raw).trim() : "";
  return /^\d{17,24}$/.test(s);
}

function normalizeDiscordLabel(raw) {
  const s = raw != null ? String(raw).trim().slice(0, DISCORD_LABEL_MAX) : "";
  if (/[\u0000-\u001f<>]/.test(s)) return "";
  return s;
}

/**
 * @param {import("mongoose").HydratedDocument<unknown> | null | undefined} accountDoc
 * @param {string} channelIdRaw
 * @param {string} guildIdRaw
 * @returns {object | null}
 */
export function findDiscordTargetFromAccount(accountDoc, channelIdRaw, guildIdRaw) {
  const targets = accountDoc?.metadata?.discordTargets;
  if (!Array.isArray(targets)) return null;
  const cid = String(channelIdRaw || "").trim();
  if (!cid) return null;
  const hit = targets.find((t) => t && String(t.channelId || "").trim() === cid);
  if (!hit) return null;
  const mode = String(hit.connectionType || "bot").toLowerCase();
  if (mode === "bot") {
    const gidReq = String(guildIdRaw || "").trim();
    const gidStored = String(hit.guildId || "").trim();
    if (!isDiscordSnowflake(gidReq) || gidReq !== gidStored) return null;
  }
  return hit;
}

/**
 * @param {import("mongodb").ObjectId} userId
 * @param {unknown} bodyTargets
 */
export async function replaceDiscordPostingTargets(userId, bodyTargets) {
  if (!Array.isArray(bodyTargets)) {
    const err = new Error("targets must be an array.");
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }
  if (bodyTargets.length > DISCORD_MAX_TARGETS) {
    const err = new Error(`You can save at most ${DISCORD_MAX_TARGETS} Discord targets.`);
    err.status = 400;
    err.code = "validation_error";
    throw err;
  }

  /** @type {object[]} */
  const cleaned = [];
  const seen = new Set();

  for (const row of bodyTargets) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    if ("__proto__" in row || "constructor" in row) {
      const err = new Error("Invalid target entry.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }

    const channelId = String(row.channelId || "").trim();
    const guildId = String(row.guildId || "").trim();
    const guildName = normalizeDiscordLabel(row.guildName);
    const channelName = normalizeDiscordLabel(row.channelName);
    const connectionType = String(row.connectionType || "bot").trim().toLowerCase();

    if (!isDiscordSnowflake(channelId)) {
      const err = new Error("Each target needs a valid Discord channel id (numeric snowflake).");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!channelName) {
      const err = new Error("Each target needs a channel name.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }
    if (!["bot", "webhook"].includes(connectionType)) {
      const err = new Error("connectionType must be bot or webhook.");
      err.status = 400;
      err.code = "validation_error";
      throw err;
    }

    let webhookUrlEnc = null;
    if (connectionType === "bot") {
      if (!isDiscordSnowflake(guildId)) {
        const err = new Error("Bot targets require a valid server (guild) id.");
        err.status = 400;
        err.code = "validation_error";
        throw err;
      }
      if (!guildName) {
        const err = new Error("Bot targets require a server name.");
        err.status = 400;
        err.code = "validation_error";
        throw err;
      }
    } else {
      const wh = row.webhookUrl != null ? String(row.webhookUrl).trim() : "";
      const parsed = parseDiscordWebhookUrl(wh);
      if (!parsed) {
        const err = new Error("Webhook targets require a valid https Discord webhook URL.");
        err.status = 400;
        err.code = "validation_error";
        throw err;
      }
      webhookUrlEnc = encryptToken(parsed.executeUrl);
    }

    const key = `${connectionType}:${guildId || "_"}:${channelId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    /** @type {Record<string, unknown>} */
    const entry = {
      guildId: connectionType === "bot" ? guildId : guildId && isDiscordSnowflake(guildId) ? guildId : "",
      guildName: guildName || (connectionType === "webhook" ? "Discord server" : guildName),
      channelId,
      channelName,
      connectionType,
    };
    if (webhookUrlEnc) entry.webhookUrlEnc = webhookUrlEnc;
    cleaned.push(entry);
  }

  const account = await SocialAccount.findOne({ userId, platform: "discord" });
  if (!account || !account.isConnected) {
    const err = new Error("Discord is not connected.");
    err.status = 400;
    err.code = "not_connected";
    throw err;
  }

  account.metadata = { ...(account.metadata || {}), discordTargets: cleaned };
  account.lastSyncedAt = new Date();
  await account.save();
  return mapAccount(account);
}
