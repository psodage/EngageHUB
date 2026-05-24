/** @param {string} pathname */
export function isDashboardActive(pathname) {
  return pathname === "/" || pathname === "/dashboard";
}

/** @param {string} pathname */
export function isCreatePostActive(pathname) {
  return pathname === "/create-post" || pathname.startsWith("/create-post/");
}

/** @param {string} pathname */
export function isScheduleActive(pathname) {
  return pathname === "/schedule" || pathname.startsWith("/schedule/");
}

/** Primary sidebar "Connect channels" — list page only (not channel detail). */
export function isChannelsListActive(pathname) {
  if (pathname.startsWith("/settings")) return false;
  return pathname === "/channels";
}

/** @param {string} pathname @param {string} platformKey */
export function isChannelDetailActive(pathname, platformKey) {
  return pathname === `/channels/${platformKey}`;
}

/** @param {string} search */
export function getChannelEntityIdFromSearch(search) {
  return new URLSearchParams(search).get("entity")?.trim() || "";
}

/** @param {string} search */
export function getChannelTabFromSearch(search) {
  const tab = new URLSearchParams(search).get("tab");
  if (tab === "create") return "profile";
  if (tab === "profile" || tab === "history" || tab === "analytics") return tab;
  return "profile";
}

/**
 * @param {string} pathname
 * @param {string} search
 * @param {{ platformKey: string, entityId?: string, entityType?: string }} channel
 */
export function isChannelSidebarItemActive(pathname, search, channel) {
  if (!isChannelDetailActive(pathname, channel.platformKey)) return false;
  if (!channel.entityId) return true;

  const entityId = getChannelEntityIdFromSearch(search);
  if (entityId) return channel.entityId === entityId;
  return Boolean(channel.isDefaultEntity);
}

/**
 * @param {string} pathname
 * @param {string} search
 * @param {string} platformKey
 * @param {string} tabId
 * @param {{ entityId?: string, isDefaultEntity?: boolean }} [options]
 */
export function isChannelTabActive(pathname, search, platformKey, tabId, options = {}) {
  if (pathname !== `/channels/${platformKey}`) return false;

  const entityId = options.entityId || "";
  if (entityId) {
    const searchEntity = getChannelEntityIdFromSearch(search);
    if (searchEntity && searchEntity !== entityId) return false;
    if (!searchEntity && !options.isDefaultEntity) return false;
  }

  return getChannelTabFromSearch(search) === tabId;
}

/** @param {string} pathname @param {string} [search] */
export function getActiveChannelPlatformKey(pathname, search = "") {
  const match = pathname.match(/^\/channels\/([^/]+)$/);
  if (match?.[1]) return match[1];
  if (isCreatePostActive(pathname)) {
    const platform = new URLSearchParams(search).get("platform")?.trim() || "";
    return platform || null;
  }
  return null;
}

/** @param {string} pathname */
export function isSettingsActive(pathname) {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

/** @param {string} pathname @param {string} section */
export function isSettingsSectionActive(pathname, section) {
  return pathname === `/settings/${section}`;
}

/** @param {string} pathname @param {string} key */
export function isMainNavActive(pathname, key) {
  switch (key) {
    case "dashboard":
      return isDashboardActive(pathname);
    case "create-post":
      return isCreatePostActive(pathname);
    case "schedule":
      return isScheduleActive(pathname);
    case "channels":
      return isChannelsListActive(pathname);
    default:
      return false;
  }
}
