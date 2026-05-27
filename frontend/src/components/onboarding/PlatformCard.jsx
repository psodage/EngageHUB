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
    connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
  onToggle,
  className = "",
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
      className={`group relative w-full rounded-2xl border p-4 text-left transition-colors duration-200 ${
        isConnected
          ? "border-emerald-200 bg-emerald-50/60"
          : disabled
            ? "border-slate-200 bg-slate-50/10 dark:border-slate-800/40 dark:bg-slate-900/10"
            : status === "skipped"
              ? "border-amber-200 bg-amber-50/70"
              : isSelected && !started
                ? "border-brand-400/60 bg-brand-50/40 ring-1 ring-brand-500/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
      } ${disabled && !isConnected ? "cursor-not-allowed opacity-90" : started ? "cursor-default" : "cursor-pointer"} flex items-start gap-3.5 ${className}`}
    >
      <SocialPlatformIcon
        platformKey={platform.key}
        size="md"
        className={disabled && !isConnected ? "grayscale opacity-85" : ""}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${disabled && !isConnected ? "text-slate-800" : "text-slate-900"}`}>
          {platform.label}
        </span>
        <span className={`mt-0.5 block line-clamp-2 text-xs leading-snug ${disabled ? "text-slate-500" : "text-slate-500"}`}>
          {disabled ? "Coming soon" : description}
        </span>
        {(started || isConnected) && status !== "not-selected" ? (
          <span className="mt-2 block">
            <StatusBadge status={isConnected ? "connected" : status} />
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
      {isConnected ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white">
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
