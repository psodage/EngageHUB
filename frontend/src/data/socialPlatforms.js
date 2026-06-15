import { PLATFORM_BRAND_ICONS } from "./platformBrandIcons";

export const SOCIAL_PLATFORM_CONFIGS = [
  {
    key: "instagram",
    label: "Instagram",
    icon: PLATFORM_BRAND_ICONS.instagram,
    hint: "Professional account only",
    connectSubtitle: "Business, Creator, or Profile",
  },
  {
    key: "threads",
    label: "Threads",
    icon: PLATFORM_BRAND_ICONS.threads,
    hint: "Threads profile publishing",
    connectSubtitle: "Profile",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: PLATFORM_BRAND_ICONS.linkedin,
    hint: "Profile + organizations/pages by access",
    connectSubtitle: "Page or Profile",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: PLATFORM_BRAND_ICONS.facebook,
    hint: "Facebook page publishing",
    connectSubtitle: "Page",
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: PLATFORM_BRAND_ICONS.youtube,
    hint: "Channel publishing and analytics",
    connectSubtitle: "Channel",
  },
  {
    key: "x",
    label: "X",
    icon: PLATFORM_BRAND_ICONS.x,
    hint: "Profile and brand accounts (API tier dependent)",
    connectSubtitle: "Profile",
  },
  {
    key: "googleBusiness",
    label: "Google Business",
    icon: PLATFORM_BRAND_ICONS.googleBusiness,
    hint: "Business profile location updates",
    connectSubtitle: "Business location",
  },
  {
    key: "github",
    label: "GitHub",
    icon: PLATFORM_BRAND_ICONS.github,
    hint: "Repositories, activity & dev analytics",
    connectSubtitle: "Developer profile",
  },
  {
    key: "reddit",
    label: "Reddit",
    icon: PLATFORM_BRAND_ICONS.reddit,
    hint: "Community posting with authenticated scopes",
    connectSubtitle: "Profile",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    icon: PLATFORM_BRAND_ICONS.pinterest,
    hint: "Boards and pins publishing",
    connectSubtitle: "Board or Profile",
  },
];

export const PLATFORMS_BY_USER_TYPE = {
  business: ["instagram", "facebook", "linkedin", "x", "youtube", "googleBusiness"],
  influencer: ["instagram", "threads", "x", "youtube", "facebook", "pinterest"],
  student: ["instagram", "linkedin", "threads", "github"],
};

export function getPlatformsForUserType(userType) {
  const keys = PLATFORMS_BY_USER_TYPE[userType] || PLATFORMS_BY_USER_TYPE.business;
  return SOCIAL_PLATFORM_CONFIGS.filter((p) => keys.includes(p.key));
}

/** Display order in the Connect a New Channel modal (3-column grid). */
export const CONNECT_CHANNEL_MODAL_PLATFORM_ORDER = [
  "instagram",
  "threads",
  "linkedin",
  "facebook",
  "googleBusiness",
  "x",
  "youtube",
  "github",
  "reddit",
];

/** @param {Array<{ key: string }>} platforms */
export function sortPlatformsForConnectModal(platforms) {
  const order = new Map(CONNECT_CHANNEL_MODAL_PLATFORM_ORDER.map((key, index) => [key, index]));
  return [...platforms].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
}

/** Platforms removed from Connect channels UI (legacy accounts may still exist in the database). */
export const HIDDEN_CONNECT_PLATFORM_KEYS = new Set(["telegram", "discord"]);

export function isHiddenConnectPlatform(platformKey) {
  return HIDDEN_CONNECT_PLATFORM_KEYS.has(platformKey);
}

/** New connections and reconnect OAuth are hidden/disabled in the UI until re-enabled. */
export const TEMPORARILY_DISABLED_CONNECT_PLATFORM_KEYS = new Set(["reddit", "pinterest"]);

export function isPlatformConnectTemporarilyDisabled(platformKey) {
  return TEMPORARILY_DISABLED_CONNECT_PLATFORM_KEYS.has(platformKey);
}

export const PLATFORM_CAPABILITY_MATRIX = {
  facebook: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  instagram: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  threads: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  linkedin: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  youtube: { badges: ["Posting", "Analytics", "Media Upload"], supportLevel: "full", oauth: true },
  x: { badges: ["Posting", "Limited API"], supportLevel: "limited", oauth: true },
  reddit: { badges: ["Posting", "Limited API"], supportLevel: "limited", oauth: true },
  googleBusiness: { badges: ["Posting", "Analytics"], supportLevel: "full", oauth: true },
  github: { badges: ["Analytics", "Activity", "Scheduling-ready"], supportLevel: "full", oauth: true },
};
