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

export const SOCIAL_PLATFORM_ICON_MAP = {
  instagram: { Icon: FaInstagram, brandClass: "from-[#f58529] via-[#dd2a7b] to-[#8134af]" },
  facebook: { Icon: FaFacebook, brandClass: "from-[#1877F2] to-[#0d65d9]" },
  linkedin: { Icon: FaLinkedin, brandClass: "from-[#0A66C2] to-[#004182]" },
  youtube: { Icon: FaYoutube, brandClass: "from-[#FF0000] to-[#cc0000]" },
  x: { Icon: FaXTwitter, brandClass: "from-slate-800 to-slate-950 dark:from-white dark:to-slate-200" },
  threads: { Icon: FaThreads, brandClass: "from-slate-900 to-slate-700 dark:from-white dark:to-slate-300" },
  pinterest: { Icon: FaPinterest, brandClass: "from-[#E60023] to-[#bd001c]" },
  telegram: { Icon: FaTelegram, brandClass: "from-[#26A5E4] to-[#1c8fd4]" },
  discord: { Icon: FaDiscord, brandClass: "from-[#5865F2] to-[#4752c4]" },
  reddit: { Icon: FaReddit, brandClass: "from-[#FF4500] to-[#e03d00]" },
  googleBusiness: { Icon: FaGoogle, brandClass: "from-[#4285F4] via-[#34A853] to-[#FBBC05]" },
  github: { Icon: FaGithub, brandClass: "from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white" },
};
