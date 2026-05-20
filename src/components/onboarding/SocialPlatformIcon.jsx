import PlatformBrandIcon from "../channels/PlatformBrandIcon";

const SIZE_MAP = { sm: "sm", md: "md" };

/** @deprecated Prefer PlatformBrandIcon directly — kept for onboarding cards. */
export default function SocialPlatformIcon({ platformKey, size = "sm", className = "" }) {
  return <PlatformBrandIcon platformKey={platformKey} size={SIZE_MAP[size] || "sm"} className={className} />;
}
