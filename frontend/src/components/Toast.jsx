import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";

const TOAST_DURATION_MS = 7000;

export default function Toast() {
  const { toast, setToast } = useApp();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast) return undefined;
    const startedAt = Date.now();
    setProgress(100);

    const timeoutId = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, TOAST_DURATION_MS - elapsed);
      setProgress((remaining / TOAST_DURATION_MS) * 100);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [toast, setToast]);

  if (!toast) return null;

  const isError = Boolean(toast.error);
  const Icon = isError ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={`fixed left-1/2 top-4 z-[70] w-[min(680px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm sm:top-6 sm:px-5 ${
        isError
          ? "border-red-200/80 bg-white/95 text-slate-900 dark:border-red-500/40 dark:bg-slate-900/95 dark:text-slate-100"
          : "border-emerald-200/80 bg-white/95 text-slate-900 dark:border-emerald-500/40 dark:bg-slate-900/95 dark:text-slate-100"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            isError
              ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300"
              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
          }`}
        >
          <Icon size={16} />
        </span>
        <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/75 dark:bg-slate-700/75">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            isError ? "bg-red-500 dark:bg-red-400" : "bg-emerald-500 dark:bg-emerald-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
