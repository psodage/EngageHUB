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
export function getChannelTabFromSearch(search) {
  const tab = new URLSearchParams(search).get("tab");
  if (tab === "profile" || tab === "feed" || tab === "create" || tab === "history") return tab;
  return "profile";
}

/** @param {string} pathname @param {string} search @param {string} platformKey @param {string} tabId */
export function isChannelTabActive(pathname, search, platformKey, tabId) {
  return pathname === `/channels/${platformKey}` && getChannelTabFromSearch(search) === tabId;
}

/** @param {string} pathname */
export function getActiveChannelPlatformKey(pathname) {
  const match = pathname.match(/^\/channels\/([^/]+)$/);
  return match?.[1] || null;
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
