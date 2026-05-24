export function getLinkedInAuthorUrn(accountDoc) {
  const plain = accountDoc?.toObject?.({ depopulate: true }) || accountDoc || {};
  const entityType = (plain.entityType || "profile").toLowerCase();
  if (entityType === "organization") {
    const orgId =
      (plain.entityId ? String(plain.entityId).trim() : "") ||
      (plain.metadata?.organizationId ? String(plain.metadata.organizationId).trim() : "");
    if (!orgId) return "";
    return `urn:li:organization:${orgId}`;
  }
  const personId = plain.platformUserId ? String(plain.platformUserId).trim() : "";
  if (!personId) return "";
  return `urn:li:person:${personId}`;
}

