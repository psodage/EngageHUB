import { BarChart3, History, User } from "lucide-react";

/** Profile sections shown under an active channel in the sidebar. */
export const CHANNEL_PROFILE_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "history", label: "History", icon: History },
];

const GITHUB_ANALYTICS_TAB = { id: "analytics", label: "Analytics", icon: BarChart3 };

/** @param {string} [platformKey] */
export function getChannelTabsForPlatform(platformKey) {
  if (platformKey === "github") {
    return [CHANNEL_PROFILE_TABS[0], GITHUB_ANALYTICS_TAB, ...CHANNEL_PROFILE_TABS.slice(1)];
  }
  return CHANNEL_PROFILE_TABS;
}

export const CHANNEL_TAB_IDS = new Set([
  ...CHANNEL_PROFILE_TABS.map((t) => t.id),
  GITHUB_ANALYTICS_TAB.id,
]);

/** @param {string | null} tab */
export function normalizeChannelTab(tab) {
  if (tab && CHANNEL_TAB_IDS.has(tab)) return tab;
  return "profile";
}
