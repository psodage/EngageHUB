import { useApp } from "../../context/AppContext";

export default function AuthAlert() {
  const { authAlert } = useApp();
  if (!authAlert?.message) return null;

  const isError = Boolean(authAlert.error);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-live="assertive"
      aria-label={isError ? "Error" : "Success"}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border px-6 py-5 text-center shadow-2xl ${
          isError ? "border-red-200 bg-red-50" : "border-emerald-200 bg-white"
        }`}
      >
        <p className={`text-sm font-semibold leading-snug ${isError ? "text-red-800" : "text-slate-900"}`}>
          {authAlert.message}
        </p>
        {authAlert.redirecting ? (
          <p className="mt-2 text-xs text-slate-500">
            {isError ? "Returning to sign in…" : "Redirecting you shortly…"}
          </p>
        ) : isError ? (
          <p className="mt-2 text-xs text-slate-500">Please try again.</p>
        ) : null}
      </div>
    </div>
  );
}
