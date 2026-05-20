import {
  FaDiscord,
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaReddit,
  FaTelegram,
  FaYoutube,
} from "react-icons/fa";
import { FaGoogle, FaThreads, FaXTwitter } from "react-icons/fa6";

/** Official brand icons (react-icons / Simple Icons). */
export const PLATFORM_BRAND_ICONS = {
  instagram: FaInstagram,
  facebook: FaFacebook,
  linkedin: FaLinkedin,
  youtube: FaYoutube,
  x: FaXTwitter,
  threads: FaThreads,
  pinterest: FaPinterest,
  telegram: FaTelegram,
  discord: FaDiscord,
  reddit: FaReddit,
  googleBusiness: FaGoogle,
  github: FaGithub,
};

export const PLATFORM_BRAND_GRADIENT = {
  instagram: "from-[#f58529] via-[#dd2a7b] to-[#8134af]",
  facebook: "from-[#1877F2] to-[#0d65d9]",
  linkedin: "from-[#0A66C2] to-[#004182]",
  youtube: "from-[#FF0000] to-[#cc0000]",
  x: "from-slate-800 to-slate-950 dark:from-white dark:to-slate-200",
  threads: "from-slate-900 to-slate-700 dark:from-white dark:to-slate-300",
  pinterest: "from-[#E60023] to-[#bd001c]",
  telegram: "from-[#26A5E4] to-[#1c8fd4]",
  discord: "from-[#5865F2] to-[#4752c4]",
  reddit: "from-[#FF4500] to-[#e03d00]",
  googleBusiness: "from-[#4285F4] via-[#34A853] to-[#FBBC05]",
  github: "from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white",
};

export const PLATFORM_BRAND_BG = {
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
  github: "bg-slate-800 text-white dark:bg-white dark:text-slate-900",
};

export function getPlatformBrandIcon(platformKey) {
  return PLATFORM_BRAND_ICONS[platformKey] || null;
}
