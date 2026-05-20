import { SOCIAL_PLATFORM_ICON_MAP } from "./socialPlatformIcons";

const SIZE = {
  sm: "h-8 w-8 text-sm rounded-lg",
  md: "h-9 w-9 text-base rounded-lg",
};

export default function SocialPlatformIcon({ platformKey, size = "sm", className = "" }) {
  const config = SOCIAL_PLATFORM_ICON_MAP[platformKey];
  const Icon = config?.Icon;
  const brandClass = config?.brandClass || "from-slate-600 to-slate-700";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white ${SIZE[size]} ${brandClass} ${className}`}
      aria-hidden
    >
      {Icon ? <Icon /> : <span className="text-xs font-bold">?</span>}
    </span>
  );
}
