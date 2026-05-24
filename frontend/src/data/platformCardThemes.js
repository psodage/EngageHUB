/** Glass card accents per platform — light + dark, subtle gradients for Connected Channels. */
export const PLATFORM_CARD_THEMES = {
  facebook: {
    gradient:
      "from-blue-500/[0.12] via-blue-400/[0.06] to-white/80 dark:from-blue-600/25 dark:via-blue-900/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(24,119,242,0.35)]",
    iconBrand: "bg-[#1877F2] text-white",
  },
  instagram: {
    gradient:
      "from-fuchsia-500/[0.12] via-purple-500/[0.08] to-white/80 dark:from-fuchsia-600/20 dark:via-purple-900/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(221,42,123,0.35)]",
    iconBrand: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  },
  threads: {
    gradient:
      "from-slate-400/[0.10] via-slate-300/[0.05] to-white/80 dark:from-slate-600/20 dark:via-slate-800/20 dark:to-slate-900/80",
    glow: "group-hover:shadow-[0_0_18px_rgba(100,116,139,0.3)]",
    iconBrand: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  },
  linkedin: {
    gradient:
      "from-sky-500/[0.12] via-cyan-400/[0.06] to-white/80 dark:from-sky-600/20 dark:via-blue-900/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(10,102,194,0.35)]",
    iconBrand: "bg-[#0A66C2] text-white",
  },
  youtube: {
    gradient:
      "from-red-500/[0.12] via-red-400/[0.06] to-white/80 dark:from-red-600/20 dark:via-red-950/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(255,0,0,0.3)]",
    iconBrand: "bg-[#FF0000] text-white",
  },
  x: {
    gradient:
      "from-slate-400/[0.10] via-slate-300/[0.05] to-white/80 dark:from-slate-600/25 dark:via-slate-800/20 dark:to-slate-950/80",
    glow: "group-hover:shadow-[0_0_18px_rgba(15,23,42,0.25)] dark:group-hover:shadow-[0_0_18px_rgba(255,255,255,0.12)]",
    iconBrand: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  },
  reddit: {
    gradient:
      "from-orange-500/[0.12] via-orange-400/[0.06] to-white/80 dark:from-orange-600/20 dark:via-orange-950/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(255,69,0,0.3)]",
    iconBrand: "bg-[#FF4500] text-white",
  },
  pinterest: {
    gradient:
      "from-rose-500/[0.12] via-rose-400/[0.06] to-white/80 dark:from-rose-600/20 dark:via-rose-950/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(230,0,35,0.3)]",
    iconBrand: "bg-[#E60023] text-white",
  },
  telegram: {
    gradient:
      "from-cyan-500/[0.12] via-cyan-400/[0.06] to-white/80 dark:from-cyan-600/20 dark:via-cyan-950/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(38,165,228,0.35)]",
    iconBrand: "bg-[#26A5E4] text-white",
  },
  discord: {
    gradient:
      "from-indigo-500/[0.12] via-indigo-400/[0.06] to-white/80 dark:from-indigo-600/20 dark:via-indigo-950/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(88,101,242,0.35)]",
    iconBrand: "bg-[#5865F2] text-white",
  },
  googleBusiness: {
    gradient:
      "from-emerald-500/[0.12] via-emerald-400/[0.06] to-white/80 dark:from-emerald-600/20 dark:via-emerald-950/15 dark:to-slate-900/70",
    glow: "group-hover:shadow-[0_0_18px_rgba(52,168,83,0.35)]",
    iconBrand: "bg-[#4285F4] text-white",
  },
};

export const DEFAULT_PLATFORM_CARD_THEME = PLATFORM_CARD_THEMES.threads;

export function getPlatformCardTheme(platformKey) {
  return PLATFORM_CARD_THEMES[platformKey] || DEFAULT_PLATFORM_CARD_THEME;
}
