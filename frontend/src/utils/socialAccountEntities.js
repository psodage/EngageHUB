/** Entity types that represent a distinct OAuth login for the same platform. */
const OAUTH_ROOT_ENTITY_TYPES = new Set(["profile", "bot", "business", "professional"]);

/**
 * Facebook Pages available for posting and channel UI (personal profile is not supported).
 * @param {Record<string, unknown> | null | undefined} groupedAccount
 */
export function getFacebookConnectionEntities(groupedAccount) {
  if (!groupedAccount?.isConnected) return [];

  const entities = Array.isArray(groupedAccount.entities) ? groupedAccount.entities : [];
  const seen = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];

  for (const entity of entities) {
    if (!entity || entity.isConnected === false) continue;
    if ((entity.entityType || "profile") !== "page") continue;
    const entityId = String(entity.entityId || entity.platformUserId || "").trim();
    if (!entityId) continue;
    const key = `page:${entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(entity);
  }

  if (!rows.length && groupedAccount.platformUserId && groupedAccount.entityType === "page") {
    rows.push({
      id: groupedAccount.id,
      platformUserId: groupedAccount.platformUserId,
      entityType: "page",
      entityId: groupedAccount.entityId || groupedAccount.platformUserId,
      accountName: groupedAccount.accountName,
      username: groupedAccount.username,
      profileImage: groupedAccount.profileImage,
      isConnected: true,
      isPrimary: groupedAccount.isPrimary,
      isTokenExpired: groupedAccount.isTokenExpired,
    });
  }

  return rows.sort((a, b) => String(a.accountName || "").localeCompare(String(b.accountName || "")));
}

/**
 * LinkedIn profile + company pages from grouped account entities.
 * @param {Record<string, unknown> | null | undefined} groupedAccount
 */
export function getLinkedInConnectionEntities(groupedAccount) {
  if (!groupedAccount?.isConnected) return [];

  const entities = Array.isArray(groupedAccount.entities) ? groupedAccount.entities : [];
  const seen = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const rows = [];

  for (const entity of entities) {
    if (!entity || entity.isConnected === false) continue;
    const entityType = entity.entityType || "profile";
    if (entityType !== "profile" && entityType !== "organization") continue;
    const entityId = String(entity.entityId || entity.platformUserId || "").trim();
    if (!entityId && entityType === "organization") continue;
    const key = `${entityType}:${entityId || "profile"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(entity);
  }

  if (!rows.length && groupedAccount.platformUserId) {
    rows.push({
      id: groupedAccount.id,
      platformUserId: groupedAccount.platformUserId,
      entityType: groupedAccount.entityType === "organization" ? "organization" : "profile",
      entityId: groupedAccount.entityId || groupedAccount.platformUserId,
      accountName: groupedAccount.accountName,
      username: groupedAccount.username,
      profileImage: groupedAccount.profileImage,
      isConnected: true,
      isPrimary: groupedAccount.isPrimary,
    });
  }

  return rows.sort((a, b) => {
    if (a.entityType === "profile" && b.entityType !== "profile") return -1;
    if (b.entityType === "profile" && a.entityType !== "profile") return 1;
    return String(a.accountName || "").localeCompare(String(b.accountName || ""));
  });
}

/**
 * @param {Record<string, unknown> | null | undefined} groupedAccount
 * @returns {Array<Record<string, unknown>>}
 */
export function getDistinctOAuthConnections(groupedAccount) {
  if (!groupedAccount?.isConnected) return [];

  const entities = Array.isArray(groupedAccount.entities) ? groupedAccount.entities : [];
  const seen = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const roots = [];

  for (const entity of entities) {
    if (!entity || entity.isConnected === false) continue;
    const entityType = entity.entityType || "profile";
    if (!OAUTH_ROOT_ENTITY_TYPES.has(entityType)) continue;
    const platformUserId = String(entity.platformUserId || entity.entityId || "").trim();
    if (!platformUserId) continue;
    const key = `${entityType}:${platformUserId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(entity);
  }

  if (!roots.length && groupedAccount.platformUserId) {
    roots.push({
      id: groupedAccount.id,
      platformUserId: groupedAccount.platformUserId,
      entityType: groupedAccount.entityType || "profile",
      entityId: groupedAccount.entityId || groupedAccount.platformUserId,
      accountName: groupedAccount.accountName,
      username: groupedAccount.username,
      profileImage: groupedAccount.profileImage,
      isConnected: true,
      isPrimary: groupedAccount.isPrimary,
      isTokenExpired: groupedAccount.isTokenExpired,
    });
  }

  return roots;
}

/**
 * Flatten grouped platform accounts into one card per distinct OAuth login.
 * @param {Array<Record<string, unknown>>} accounts
 */
export function listConnectionCardsFromAccounts(accounts) {
  /** @type {Array<{ platform: string, account: Record<string, unknown>, entity: Record<string, unknown> | null, cardKey: string, displayAccount: Record<string, unknown> }>} */
  const cards = [];

  for (const grouped of accounts) {
    if (!grouped?.isConnected) continue;
    const platform = String(grouped.platform || "");
    const roots =
      platform === "facebook" ? getFacebookConnectionEntities(grouped) : getDistinctOAuthConnections(grouped);

    if (!roots.length) {
      cards.push({
        platform,
        account: grouped,
        entity: null,
        cardKey: platform,
        displayAccount: grouped,
      });
      continue;
    }

    for (const entity of roots) {
      const entityId = entity.id || entity._id;
      const cardKey = `${platform}:${entityId || entity.platformUserId || entity.entityId}`;
      cards.push({
        platform,
        account: grouped,
        entity,
        cardKey,
        displayAccount: {
          ...grouped,
          accountName: entity.accountName || grouped.accountName,
          username: entity.username || grouped.username,
          profileImage: entity.profileImage || grouped.profileImage,
          platformUserId: entity.platformUserId || grouped.platformUserId,
          entityId: entity.entityId || grouped.entityId,
          entityType: entity.entityType || grouped.entityType,
          isTokenExpired: entity.isTokenExpired ?? grouped.isTokenExpired,
          connectedAccountId: entityId,
        },
      });
    }
  }

  return cards;
}

/**
 * @param {Record<string, unknown>} groupedAccount
 */
export function countDistinctOAuthConnections(groupedAccount) {
  return getDistinctOAuthConnections(groupedAccount).length;
}
