import { getCreatePostChannelLabel, getPlatformKeyFromCreatePostChannelKey } from "./createPostChannels";

/** @param {string} status */
export function getScheduledChannelStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "success" || normalized === "published") {
    return { label: "Published", tone: "published" };
  }
  if (normalized === "failed") {
    return { label: "Not published", tone: "failed" };
  }
  if (normalized === "publishing") {
    return { label: "Publishing", tone: "publishing" };
  }
  if (normalized === "scheduled") {
    return { label: "Scheduled", tone: "scheduled" };
  }
  return { label: "Pending", tone: "pending" };
}

/**
 * Merge channelKeys with channelResults for detail UI.
 * @param {{ channelKeys?: string[], channelResults?: Array<Record<string, unknown>>, status?: string }} post
 */
export function buildScheduledPostChannelRows(post) {
  const channelKeys = Array.isArray(post?.channelKeys) ? post.channelKeys : [];
  const results = Array.isArray(post?.channelResults) ? post.channelResults : [];
  const byChannelKey = new Map();

  for (const result of results) {
    const rawKey = result.channelKey || (String(result.platformKey || "").includes(":") ? result.platformKey : "");
    if (rawKey) {
      byChannelKey.set(rawKey, result);
      continue;
    }
    const platformKey = String(result.platformKey || "");
    const match = channelKeys.find(
      (key) => getPlatformKeyFromCreatePostChannelKey(key) === platformKey && !byChannelKey.has(key)
    );
    if (match) byChannelKey.set(match, result);
  }

  const fallbackStatus = post?.status === "scheduled" ? "scheduled" : "pending";

  return channelKeys.map((channelKey) => {
    const result = byChannelKey.get(channelKey);
    const status = result?.status || fallbackStatus;
    const meta = getScheduledChannelStatusMeta(status);
    return {
      channelKey,
      platformKey: getPlatformKeyFromCreatePostChannelKey(channelKey),
      label: getCreatePostChannelLabel(channelKey),
      status,
      statusLabel: meta.label,
      tone: meta.tone,
      error: String(result?.error || "").trim(),
      publishedAt: result?.publishedAt || null,
    };
  });
}
