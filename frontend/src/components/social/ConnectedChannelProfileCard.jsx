import { motion } from "framer-motion";
import { ArrowUpRight, Unplug } from "lucide-react";
import ConnectionStatusBadge from "./ConnectionStatusBadge";
import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { getPlatformCardTheme } from "../../data/platformCardThemes";

const cardMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
};

export default function ConnectedChannelProfileCard({ platformConfig, account, onOpen, onDisconnect }) {
  const platformKey = platformConfig?.key || account?.platform;
  const theme = getPlatformCardTheme(platformKey);
  const displayName = account?.accountName || account?.username || platformConfig?.label || "Connected";
  const handle = account?.username ? `@${String(account.username).replace(/^@/, "")}` : null;
  const profileImage =
    account?.profileImage ||
    `https://placehold.co/160x160/e2e8f0/64748b?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;

  return (
    <motion.article
      layout
      {...cardMotion}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br ${theme.gradient} bg-white/70 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-slate-900/50 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_16px_44px_rgba(0,0,0,0.45)]`}
    >
      {typeof onDisconnect === "function" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500 opacity-0 shadow-sm backdrop-blur-sm transition hover:border-red-200 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 group-hover:opacity-100 dark:border-slate-600/80 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:border-red-500/40 dark:hover:text-red-400"
          aria-label={`Disconnect ${platformConfig?.label}`}
        >
          <Unplug size={10} aria-hidden />
          Disconnect
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-0 flex-1 flex-col items-center rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
        aria-label={`Open ${platformConfig?.label} profile`}
      >
        <motion.div className="relative mb-3 shrink-0" layout>
          <motion.img
            src={profileImage}
            alt={displayName}
            className="h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow-md ring-2 ring-slate-200/60 transition-transform duration-300 group-hover:scale-105 dark:border-white/20 dark:ring-slate-700/80"
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          />
          <motion.span
            className={`absolute -bottom-1 -right-1 transition-shadow duration-300 ${theme.glow}`}
            whileHover={{ scale: 1.08 }}
          >
            <PlatformBrandIcon platformKey={platformKey} size="sm" className="shadow-md ring-2 ring-white dark:ring-slate-900" />
          </motion.span>
        </motion.div>

        <motion.div className="w-full min-w-0 space-y-0.5 px-1" layout>
          <p className="line-clamp-1 text-lg font-semibold text-gray-900 dark:text-white">{displayName}</p>
          {handle ? (
            <p className="line-clamp-1 text-sm text-gray-500 dark:text-slate-400">{handle}</p>
          ) : (
            <p className="text-sm text-transparent select-none" aria-hidden>
              —
            </p>
          )}
          <p className="pt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {platformConfig?.label}
          </p>
        </motion.div>

        <motion.div className="mt-2.5 shrink-0" layout>
          <ConnectionStatusBadge account={account} isConnected={account?.isConnected} />
        </motion.div>

        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/60 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 group-hover:border-slate-300 group-hover:shadow dark:border-slate-600/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white">
          Open Profile
          <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </button>
    </motion.article>
  );
}
