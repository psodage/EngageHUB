import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import SocialPlatformIcon from "./SocialPlatformIcon";

const STATUS_LABELS = {
  connected: "Connected",
  skipped: "Skipped",
  failed: "Failed",
  processing: "Connecting…",
  pending: "Queued",
};

function StatusBadge({ status }) {
  const styles = {
    connected: "bg-brand-50 text-brand-700 border-brand-200",
    skipped: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    processing: "bg-slate-100 text-slate-600 border-slate-200",
    pending: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${styles[status] || styles.pending}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function PlatformCard({
  platform,
  isSelected,
  status = "not-selected",
  disabled = false,
  started = false,
  isProcessing = false,
  connectedAccount,
  onToggle,
}) {
  const description = platform.connectSubtitle || platform.hint;
  const isConnected = status === "connected";
  const isInteractive = !started && !disabled;

  return (
    <motion.button
      type="button"
      disabled={!isInteractive && !started}
      onClick={() => isInteractive && onToggle?.(platform.key)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={isInteractive ? { y: -2 } : undefined}
      className={`group relative w-full rounded-xl border p-3.5 text-left transition-colors duration-200 ${
        isConnected
          ? "border-brand-200 bg-brand-50/50"
          : isSelected && !started
            ? "border-brand-400/60 bg-brand-50/40 ring-1 ring-brand-500/20"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
      } ${disabled ? "cursor-not-allowed opacity-45" : started ? "cursor-default" : "cursor-pointer"} flex items-start gap-3`}
    >
      <SocialPlatformIcon platformKey={platform.key} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{platform.label}</span>
        <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-slate-500">
          {disabled ? "Coming soon" : description}
        </span>
        {(started || isConnected) && status !== "not-selected" ? (
          <span className="mt-2 block">
            <StatusBadge status={isConnected ? "connected" : status} />
          </span>
        ) : null}
        {isConnected && connectedAccount ? (
          <span className="mt-1.5 block truncate text-[11px] text-slate-600">
            {connectedAccount.accountName || connectedAccount.username || "Connected"}
          </span>
        ) : null}
      </span>
      {!started && isInteractive && !isConnected ? (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
            isSelected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white"
          }`}
        >
          {isSelected ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      ) : null}
      {isConnected && !started ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white">
          <Check size={12} strokeWidth={3} />
        </span>
      ) : null}
      {isProcessing ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-brand-500">
          <Loader2 size={14} className="animate-spin" />
        </span>
      ) : null}
    </motion.button>
  );
}
