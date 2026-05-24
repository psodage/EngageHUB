const STATUS_CONFIG = {
  connected: {
    label: "Connected",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    pulse: true,
  },
  disconnected: {
    label: "Disconnected",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    dot: "bg-slate-400",
    pulse: false,
  },
  needs_attention: {
    label: "Needs Attention",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    pulse: true,
  },
};

export function resolveConnectionStatus({ status, isConnected, account }) {
  if (status) return status;
  if (account?.isTokenExpired) return "needs_attention";
  if (account?.isConnected ?? isConnected) return "connected";
  return "disconnected";
}

const PREMIUM_STATUS = {
  connected: {
    pill: "border border-emerald-500/35 bg-emerald-500/10 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
    dot: "bg-emerald-400",
    pulse: true,
  },
  disconnected: {
    pill: "border border-white/10 bg-white/5 text-slate-400",
    dot: "bg-slate-500",
    pulse: false,
  },
  needs_attention: {
    pill: "border border-amber-500/35 bg-amber-500/10 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    dot: "bg-amber-400",
    pulse: true,
  },
};

export default function ConnectionStatusBadge({ isConnected, status, account, className = "", variant = "default" }) {
  const resolved = resolveConnectionStatus({ status, isConnected, account });
  const config =
    variant === "premium"
      ? { ...(STATUS_CONFIG[resolved] || STATUS_CONFIG.disconnected), ...(PREMIUM_STATUS[resolved] || PREMIUM_STATUS.disconnected) }
      : STATUS_CONFIG[resolved] || STATUS_CONFIG.disconnected;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.pill} ${className}`}
      role="status"
      aria-label={config.label}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot} ${config.pulse ? "animate-ping" : ""}`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`} />
      </span>
      {config.label}
    </span>
  );
}
