/** @typedef {"default" | "wide" | "settings" | "composer" | "channel"} DashboardContentLayout */

/** Max-width tokens shared by topbar and main content for horizontal alignment. */
export const DASHBOARD_CONTENT_MAX = {
  default: "max-w-7xl",
  wide: "max-w-[88rem]",
  settings: "max-w-6xl",
  composer: "max-w-[88rem]",
  channel: "max-w-6xl",
};

/** @param {string} pathname @returns {DashboardContentLayout} */
export function getDashboardContentLayout(pathname) {
  if (pathname.startsWith("/create-post") || pathname.startsWith("/schedule/new")) {
    return "composer";
  }
  if (/^\/channels\/[^/]+$/.test(pathname)) {
    return "channel";
  }
  if (pathname.startsWith("/settings")) {
    return "settings";
  }
  if (pathname.startsWith("/schedule")) {
    return "wide";
  }
  return "default";
}

/** @param {DashboardContentLayout} layout */
export function getDashboardContentMaxClass(layout) {
  return DASHBOARD_CONTENT_MAX[layout] || DASHBOARD_CONTENT_MAX.default;
}
/** Whether the top bar should show the standard page title (some routes use in-page headers only). */
export function shouldShowTopbarTitle(pathname) {
  return !pathname.startsWith("/create-post");
}
