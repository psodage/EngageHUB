import { CheckCircle2, Loader2, SkipForward, XCircle } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./OnboardingActions";

export default function OnboardingFlowPanel({
  currentPlatform,
  processingPlatform,
  statusMap,
  finishing,
  onRetry,
  onSkip,
  onFinish,
}) {
  const currentFailed = currentPlatform && statusMap[currentPlatform] === "failed";
  const allDone = !currentPlatform;
  const platformLabel = currentPlatform
    ? currentPlatform.charAt(0).toUpperCase() + currentPlatform.slice(1)
    : "";

  return (
    <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">
        {currentPlatform ? `Connecting ${platformLabel}` : "All selected platforms processed"}
      </p>

      {processingPlatform ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={15} className="animate-spin text-brand-500" />
          Opening {processingPlatform} authorization…
        </p>
      ) : null}

      {currentFailed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton onClick={onRetry}>Retry</PrimaryButton>
          <SecondaryButton onClick={onSkip}>Skip</SecondaryButton>
        </div>
      ) : null}

      {allDone ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={13} /> Connected
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            <SkipForward size={13} /> Skipped
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
            <XCircle size={13} /> Failed
          </span>
          <div className="w-full pt-1 sm:ml-auto sm:w-auto sm:pt-0">
            <PrimaryButton onClick={onFinish} disabled={finishing} loading={finishing} className="w-full sm:w-auto">
              {finishing ? "Finalizing…" : "Go to Dashboard"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
