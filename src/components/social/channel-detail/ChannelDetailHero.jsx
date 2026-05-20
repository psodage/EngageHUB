import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { getPlatformDetailTheme } from "../../../data/platformDetailThemes";
import { SOCIAL_PLATFORM_CONFIGS } from "../../../data/socialPlatforms";
import PlatformBrandIcon from "../../channels/PlatformBrandIcon";

export default function ChannelDetailHero({ platformKey, label, subtitle }) {
  const theme = getPlatformDetailTheme(platformKey);
  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((p) => p.key === platformKey);

  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-3xl border ${theme.border} bg-gradient-to-br ${theme.hero} p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8 md:p-10`}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${theme.radial} 0%, transparent 70%)` }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full blur-3xl opacity-60"
        style={{ background: `radial-gradient(circle, ${theme.radial} 0%, transparent 70%)` }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwIDkuOTQtOC4wNiAxOC0xOCAxOHMtMTgtOC4wNi0xOC0xOCA4LjA2LTE4IDE4LTE4IDE4IDguMDYgMTggMTh6IiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIuMDMiLz48L2c+PC9zdmc+')] opacity-40"
        aria-hidden
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <motion.div
          className="flex items-start gap-4"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} className={`shrink-0 ${theme.glow} rounded-2xl`}>
            <PlatformBrandIcon platformKey={platformKey} size="lg" className="shadow-xl ring-2 ring-white/20" />
          </motion.div>
          <motion.div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {platformConfig?.label || label} · Control Center
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{label}</h1>
            <p className="mt-2 max-w-xl text-base text-slate-300">{subtitle}</p>
          </motion.div>
        </motion.div>

        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.25)] backdrop-blur-md"
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <CheckCircle2 size={16} className="text-emerald-300" aria-hidden />
          Connected
        </motion.span>
      </div>
    </motion.header>
  );
}
