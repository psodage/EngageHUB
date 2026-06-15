import {
  CalendarDays,
  Home,
  PenSquare,
  Radio,
  Settings,
  User,
  Link2,
  Palette,
} from "lucide-react";
import { SOCIAL_PLATFORM_CONFIGS } from "./socialPlatforms";

/** Hosted Express API on Render (OAuth callbacks and VITE_API_URL must use this host). */
export const DEPLOYED_API_BASE_URL = "https://engagehub.onrender.com";

export const STORAGE_KEYS = {
  theme: "engagehub-theme",
  auth: "engagehub-auth",
  authToken: "engagehub-auth-token",
  email: "engagehub-email",
  profileName: "engagehub-profile-name",
  onboardingCompleted: "engagehub-onboarding-completed",
  socialConnections: "engagehub-social-connections",
  draftSignupSession: "engagehub-draft-signup-session",
  userType: "engagehub-user-type",
  selectedUserType: "engagehub-selected-user-type",
  profileSetupCompleted: "engagehub-profile-setup-completed",
  profileCompleted: "engagehub-profile-completed",
  accountsLinked: "engagehub-accounts-linked",
  profileImage: "engagehub-profile-image",
};

/** Buffer-style primary navigation */
export const MAIN_NAV = [
  { key: "dashboard", label: "Home", path: "/dashboard", icon: Home },
  { key: "create-post", label: "Create", path: "/create-post", icon: PenSquare },
  { key: "schedule", label: "Schedule", path: "/schedule", icon: CalendarDays },
  { key: "channels", label: "Connect channels", path: "/channels", icon: Radio },
];

export const SETTINGS_NAV = [
  { key: "account", label: "Account", path: "/settings/account", icon: User, description: "Profile and password" },
  { key: "channels", label: "Channels & connections", path: "/settings/channels", icon: Link2, description: "Social accounts and OAuth" },
  { key: "preferences", label: "Preferences", path: "/settings/preferences", icon: Palette, description: "Appearance and defaults" },
];

/** @deprecated Use MAIN_NAV — kept for Topbar title lookup */
export const ROUTES = [
  ...MAIN_NAV,
  { key: "settings", label: "Settings", path: "/settings", icon: Settings },
];

export function getPageTitle(pathname) {
  const all = [...MAIN_NAV, ...SETTINGS_NAV, { label: "Settings", path: "/settings" }];
  const exact = all.find((r) => r.path === pathname);
  if (exact) return exact.label;
  if (pathname.startsWith("/settings/")) {
    const section = SETTINGS_NAV.find((r) => r.path === pathname);
    return section ? section.label : "Settings";
  }
  if (pathname.startsWith("/channels/")) {
    const platformKey = pathname.split("/")[2];
    const platform = SOCIAL_PLATFORM_CONFIGS?.find?.((p) => p.key === platformKey);
    if (platform) return platform.label;
    return "Channel";
  }
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/channels")) return "Connect channels";
  if (pathname.startsWith("/schedule/new")) return "Schedule post";
  if (/^\/schedule\/[^/]+$/.test(pathname)) return "Scheduled post";
  if (pathname.startsWith("/schedule")) return "Schedule";
  if (pathname.startsWith("/create-post")) return "Create";
  if (pathname === "/" || pathname === "/dashboard") return "Home";
  return "Home";
}
