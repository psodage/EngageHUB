import { useApp } from "../../context/AppContext";
import { AUTH_FEEDBACK_REDIRECT_MS } from "./authFeedbackConstants";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function AuthAlert() {
  const { authAlert } = useApp();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!authAlert?.message) return undefined;
    const startedAt = Date.now();
    setProgress(100);

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, AUTH_FEEDBACK_REDIRECT_MS - elapsed);
      setProgress((remaining / AUTH_FEEDBACK_REDIRECT_MS) * 100);
    }, 100);

    return () => clearInterval(intervalId);
  }, [authAlert?.message]);

  if (!authAlert?.message) return null;

  const isError = Boolean(authAlert.error);
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
      aria-label={isError ? "Error" : "Success"}
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
        <div className="flex-1">
          <p className="text-sm font-semibold leading-relaxed">{authAlert.message}</p>
          {authAlert.redirecting ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isError ? "Returning to sign in..." : "Redirecting shortly..."}
            </p>
          ) : null}
        </div>
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
