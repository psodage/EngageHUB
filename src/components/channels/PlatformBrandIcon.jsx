import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";

const BRAND_STYLES = {
  facebook: "bg-[#1877F2] text-white",
  instagram: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  threads: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  linkedin: "bg-[#0A66C2] text-white",
  youtube: "bg-[#FF0000] text-white",
  x: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  reddit: "bg-[#FF4500] text-white",
  pinterest: "bg-[#E60023] text-white",
  telegram: "bg-[#26A5E4] text-white",
  discord: "bg-[#5865F2] text-white",
  googleBusiness: "bg-[#4285F4] text-white",
};

const SIZE_CLASS = {
  sm: "h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4",
  md: "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-14 w-14 rounded-2xl [&_svg]:h-7 [&_svg]:w-7",
};

export default function PlatformBrandIcon({ platformKey, size = "lg", className = "" }) {
  const config = SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey);
  const Icon = config?.icon;
  const brand = BRAND_STYLES[platformKey] || "bg-slate-700 text-white";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center shadow-sm ${SIZE_CLASS[size]} ${brand} ${className}`}
      aria-hidden
    >
      {Icon ? (
        <Icon size={size === "lg" ? 28 : size === "sm" ? 16 : 22} strokeWidth={1.75} />
      ) : (
        <span className="text-sm font-bold">?</span>
      )}
    </span>
  );
}
