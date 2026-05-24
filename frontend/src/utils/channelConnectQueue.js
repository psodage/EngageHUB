const STORAGE_KEY = "engagehub-channel-connect-queue";

export function loadConnectQueue() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { queue: [], statusMap: {}, flow: "settings" };
    const parsed = JSON.parse(raw);
    return {
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      statusMap: parsed.statusMap && typeof parsed.statusMap === "object" ? parsed.statusMap : {},
      flow: parsed.flow === "channels" || parsed.flow === "onboarding" ? parsed.flow : "settings",
    };
  } catch {
    return { queue: [], statusMap: {}, flow: "settings" };
  }
}

export function saveConnectQueue(queue, statusMap, flow = "settings") {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, statusMap, flow }));
}

export function clearConnectQueue() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasActiveConnectQueue() {
  const { queue, statusMap } = loadConnectQueue();
  if (!queue.length) return false;
  return queue.some((platform) => !["connected", "skipped"].includes(statusMap[platform]));
}

export function getNextPendingPlatform(queue, statusMap) {
  return queue.find((platform) => !["connected", "skipped"].includes(statusMap[platform])) || "";
}
