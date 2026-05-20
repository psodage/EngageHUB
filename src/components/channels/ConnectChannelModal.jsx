import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import PlatformBrandIcon from "./PlatformBrandIcon";
import { isPlatformConnectTemporarilyDisabled } from "../../data/socialPlatforms";

export default function ConnectChannelModal({
  open,
  onClose,
  platforms = [],
  connectedKeys = new Set(),
  processingPlatform = "",
  onStartConnectQueue,
}) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  const selectablePlatforms = useMemo(
    () => platforms.filter((platform) => !isPlatformConnectTemporarilyDisabled(platform.key)),
    [platforms]
  );

  useEffect(() => {
    if (!open) {
      setSelectedKeys(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !processingPlatform) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, processingPlatform]);

  const togglePlatform = (platformKey) => {
    if (processingPlatform) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(platformKey)) next.delete(platformKey);
      else next.add(platformKey);
      return next;
    });
  };

  const handleContinue = () => {
    if (!selectedKeys.size || processingPlatform) return;
    onStartConnectQueue?.([...selectedKeys]);
  };

  const selectedCount = selectedKeys.size;
  const isStarting = Boolean(processingPlatform);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            disabled={isStarting}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-channel-title"
            className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/80 dark:bg-[#1a1a1a]"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <header className="relative border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <h2
                id="connect-channel-title"
                className="text-center text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
              >
                Connect a New Channel
              </h2>
              <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
                Select channels to link. You can add another account for platforms already connected.
              </p>
              <button
                type="button"
                onClick={onClose}
                disabled={isStarting}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </header>

            <motion.div
              className="max-h-[min(60vh,480px)] overflow-y-auto px-5 py-6 sm:px-6"
              layout
            >
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {platforms.map((platform) => {
                  const isConnected = connectedKeys.has(platform.key);
                  const isDisabled = isPlatformConnectTemporarilyDisabled(platform.key);
                  const isSelectable = !isDisabled;
                  const isSelected = selectedKeys.has(platform.key);
                  const isProcessing = processingPlatform === platform.key;
                  const subtitle = platform.connectSubtitle || platform.hint;

                  return (
                    <button
                      key={platform.key}
                      type="button"
                      disabled={!isSelectable || isStarting}
                      onClick={() => isSelectable && togglePlatform(platform.key)}
                      className={`group relative flex flex-col items-center gap-2.5 rounded-xl px-2 py-4 text-center transition ${
                        !isSelectable
                          ? "cursor-not-allowed opacity-45"
                          : isSelected
                            ? "bg-buffer-50 ring-2 ring-buffer-500/60 dark:bg-buffer-500/10"
                            : "hover:bg-slate-50 dark:hover:bg-white/5"
                      } ${isProcessing ? "ring-2 ring-buffer-500" : ""}`}
                    >
                      {isSelectable ? (
                        <span
                          className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition ${
                            isSelected
                              ? "border-buffer-600 bg-buffer-600 text-white"
                              : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                          }`}
                        >
                          {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                      ) : null}
                      <span className="relative">
                        <PlatformBrandIcon platformKey={platform.key} size="lg" />
                        {isProcessing ? (
                          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                            <Loader2 size={22} className="animate-spin text-white" />
                          </span>
                        ) : null}
                      </span>
                      <span className="w-full min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {platform.label.replace(/ \(Twitter\)/, "")}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          {isDisabled ? "Coming soon" : isConnected ? "Add another account" : subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isStarting
                  ? `Opening ${processingPlatform} login…`
                  : selectedCount
                    ? `${selectedCount} selected`
                    : "Select one or more channels"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isStarting}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selectedCount || isStarting || !selectablePlatforms.length}
                  className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isStarting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Linking…
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
