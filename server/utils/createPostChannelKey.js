/**
 * Parse create-post / schedule channel keys (e.g. facebook:page:id, linkedin:profile:id).
 * @param {string} channelKey
 * @returns {{ platformKey: string, entityType: string, entityId: string }}
 */
export function parseCreatePostChannelKey(channelKey) {
  const raw = String(channelKey || "").trim();
  if (raw === "linkedin") {
    return { platformKey: "linkedin", entityType: "profile", entityId: "" };
  }
  if (raw.startsWith("linkedin:")) {
    const parts = raw.split(":");
    if (parts.length >= 3) {
      return {
        platformKey: "linkedin",
        entityType: parts[1] || "profile",
        entityId: parts.slice(2).join(":"),
      };
    }
    return { platformKey: "linkedin", entityType: parts[1] || "profile", entityId: "" };
  }
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

/** @param {string} channelKey @param {string} status @param {Record<string, unknown>} [extra] */
export function buildScheduledChannelResult(channelKey, status, extra = {}) {
  const { platformKey } = parseCreatePostChannelKey(channelKey);
  return { channelKey: String(channelKey || "").trim(), platformKey, status, ...extra };
}
