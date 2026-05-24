import { Loader2 } from "lucide-react";

export function PrimaryButton({ children, onClick, disabled, loading, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, loading, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export default function OnboardingActions({ onContinue, onSkip, finishing, selectedCount }) {
  return (
    <div className="shrink-0 border-t border-slate-100 pt-4">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-xs text-slate-500 sm:text-left">
          {selectedCount > 0
            ? `${selectedCount} platform${selectedCount === 1 ? "" : "s"} selected`
            : "Select at least one platform to continue"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SecondaryButton onClick={onSkip} disabled={finishing} loading={finishing}>
            Skip for now
          </SecondaryButton>
          <PrimaryButton onClick={onContinue} disabled={!selectedCount}>
            Continue
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
