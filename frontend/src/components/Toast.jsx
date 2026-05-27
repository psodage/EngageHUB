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
      className={`fixed left-1/2 top-4 z-[70] w-[min(680px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border px-4 pb-4 pt-3.5 shadow-2xl backdrop-blur-md sm:top-6 sm:px-5 ${
        isError
          ? "border-red-100 bg-white/90 text-slate-900 shadow-[0_20px_50px_rgba(239,68,68,0.1)] dark:border-red-500/20 dark:bg-slate-950/90 dark:text-slate-100"
          : "border-emerald-100 bg-white/90 text-slate-900 shadow-[0_20px_50px_rgba(16,185,129,0.1)] dark:border-emerald-500/20 dark:bg-slate-950/90 dark:text-slate-100"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            isError
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
          }`}
        >
          <Icon size={16} />
        </span>
        <p className="flex-1 pr-2 text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-200">{toast.message}</p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[3px] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <div
          className={`h-full transition-[width] duration-100 ease-linear ${
            isError ? "bg-red-500 dark:bg-red-400" : "bg-emerald-500 dark:bg-emerald-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
