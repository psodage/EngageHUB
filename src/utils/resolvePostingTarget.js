/** Default posting target ids from a connected account (first saved target). */

export function resolveTelegramChatId(account, draft) {
  const fromDraft = String(draft?.entityId || "").trim();
  if (fromDraft) return fromDraft;
  const targets = Array.isArray(account?.metadata?.telegramTargets) ? account.metadata.telegramTargets : [];
  return targets[0]?.chatId ? String(targets[0].chatId).trim() : "";
}

export function resolveDiscordTarget(account, draft) {
  const raw = String(draft?.entityId || "").trim();
  if (raw.includes(":")) {
    const [guildId, channelId] = raw.split(":");
    if (channelId?.trim()) return { guildId: guildId.trim(), channelId: channelId.trim() };
  }

  const targets = Array.isArray(account?.metadata?.discordTargets) ? account.metadata.discordTargets : [];
  const row = targets[0];
  if (!row?.channelId) return null;
  return { guildId: String(row.guildId || "").trim(), channelId: String(row.channelId).trim() };
}

export function resolveGoogleBusinessLocation(account, draft) {
  const entityId = String(draft?.entityId || "").trim();
  if (entityId && entityId.includes(":")) {
    const [accountId, locationId] = entityId.split(":");
    if (accountId && locationId) return { accountId: accountId.trim(), locationId: locationId.trim() };
  }

  const entities = Array.isArray(account?.entities) ? account.entities : [];
  const loc = entities.find((e) => e.entityType === "location" && e.entityId);
  if (!loc) return null;
  const managed = loc.metadata?.managedEntity || {};
  const accountId = String(managed.googleBusinessAccountId || loc.metadata?.googleBusinessAccountId || "").trim();
  const locationId = String(loc.entityId || "").trim();
  if (!accountId || !locationId) return null;
  return { accountId, locationId };
}

export function resolveYouTubeChannelId(account, draft) {
  const fromDraft = String(draft?.entityId || "").trim();
  if (fromDraft) return fromDraft;
  const entities = Array.isArray(account?.entities) ? account.entities : [];
  const row = entities.find((e) => e?.platformUserId) || entities[0];
  return row?.platformUserId ? String(row.platformUserId) : account?.platformUserId ? String(account.platformUserId) : "";
}
