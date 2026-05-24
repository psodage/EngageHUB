import { PLATFORM_BRAND_BG, getPlatformBrandIcon } from "../../data/platformBrandIcons";

const SIZE_CLASS = {
  sm: "h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4",
  md: "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-14 w-14 rounded-2xl [&_svg]:h-7 [&_svg]:w-7",
};

const ICON_PX = { sm: 16, md: 22, lg: 28 };

export default function PlatformBrandIcon({ platformKey, size = "lg", className = "" }) {
  const Icon = getPlatformBrandIcon(platformKey);
  const brand = PLATFORM_BRAND_BG[platformKey] || "bg-slate-700 text-white";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center shadow-sm ${SIZE_CLASS[size]} ${brand} ${className}`}
      aria-hidden
    >
      {Icon ? <Icon size={ICON_PX[size] || ICON_PX.lg} /> : <span className="text-sm font-bold">?</span>}
    </span>
  );
}
