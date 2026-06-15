import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { getLinkedInAccountsSession, selectLinkedInAccount, startSocialConnect } from "../services/socialApi";
import { useApp } from "../context/AppContext";
import OnboardingShell from "../components/onboarding/OnboardingShell";

function flowReturnPath(flow) {
  const f = (flow || "settings").toLowerCase();
  if (f === "onboarding") return "/onboarding/link-accounts";
  if (f === "settings") return "/settings/channels";
  return "/channels/linkedin";
}

function typeLabel(type) {
  return type === "organization" ? "Organization" : "Profile";
}

function DestinationCard({ destination, selected, onSelect, onboardingMode = false }) {
  const label = typeLabel(destination.type);
  return (
    <button
      type="button"
      onClick={() => onSelect(destination)}
      className={[
        "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left shadow-card transition",
        onboardingMode
          ? "bg-white hover:border-emerald-300"
          : "bg-white hover:border-buffer-300 dark:bg-slate-900 dark:hover:border-buffer-500",
        selected
          ? onboardingMode
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-buffer-500 ring-2 ring-buffer-500/20 dark:border-buffer-400 dark:ring-buffer-400/15"
          : onboardingMode
            ? "border-slate-200/90"
            : "border-slate-200/90 dark:border-slate-800",
      ].join(" ")}
    >
      <div
        className={[
          "relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl",
          onboardingMode ? "bg-slate-100" : "bg-slate-100 dark:bg-slate-800",
        ].join(" ")}
      >
        {destination.avatar ? (
          <img src={destination.avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={["truncate text-sm font-semibold", onboardingMode ? "text-slate-900" : "text-slate-900 dark:text-white"].join(" ")}>
              {destination.name || (destination.type === "organization" ? "LinkedIn Organization" : "LinkedIn Profile")}
            </p>
            <p className={["mt-0.5 truncate text-xs", onboardingMode ? "text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
              {label}
              {destination.permissionStatus ? ` · ${destination.permissionStatus}` : ""}
            </p>
            {destination.email ? (
              <p className={["mt-1 truncate text-xs", onboardingMode ? "text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
                {destination.email}
              </p>
            ) : null}
          </div>
          <div className="shrink-0">
            <CheckCircle2
              size={20}
              className={[
                "transition",
                selected
                  ? onboardingMode
                    ? "text-emerald-600"
                    : "text-buffer-600 dark:text-buffer-400"
                  : onboardingMode
                    ? "text-slate-300 group-hover:text-slate-400"
                    : "text-slate-300 group-hover:text-slate-400 dark:text-slate-700 dark:group-hover:text-slate-600",
              ].join(" ")}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function LinkedInAccountSelectPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => String(searchParams.get("session") || "").trim(), [searchParams]);
  const navigate = useNavigate();
  const { setToast, refreshConnectedAccounts } = useApp();

  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [destinations, setDestinations] = useState([]);
  const [flow, setFlow] = useState("settings");
  const [orgWarning, setOrgWarning] = useState("");
  const [selected, setSelected] = useState(null);
  const isOnboardingFlow = flow === "onboarding";

  const loadSession = async () => {
    if (!sessionId) {
      setError("Missing connection session. Please reconnect LinkedIn.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getLinkedInAccountsSession(sessionId);
      const next = Array.isArray(data?.destinations) ? data.destinations : [];
      setDestinations(next);
      setFlow(data?.flow || "settings");
      setOrgWarning(typeof data?.orgWarning === "string" ? data.orgWarning : "");
      setSelected((prev) => prev || (next[0] ? next[0] : null));
      if (!next.length) {
        setError("No LinkedIn publishing destinations were found for this account.");
      }
    } catch (err) {
      setError(err?.message || "Unable to load LinkedIn destinations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleSwitchAccount = async () => {
    try {
      const data = await startSocialConnect("linkedin", { flow });
      window.location.href = data.url;
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to restart LinkedIn login.", error: true });
    }
  };

  const handleFinish = async () => {
    if (!selected || finishing) return;
    setFinishing(true);
    try {
      const result = await selectLinkedInAccount({
        sessionId,
        accountId: selected.id,
        accountType: selected.type,
      });
      await refreshConnectedAccounts?.().catch(() => {});
      setToast?.({ message: "LinkedIn connected successfully." });
      const returnPath = flowReturnPath(result?.flow || flow);
      const qs = new URLSearchParams();
      qs.set("social_platform", "linkedin");
      qs.set("social_status", "connected");
      navigate(`${returnPath}?${qs.toString()}`, { replace: true });
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to finish connection.", error: true });
      setFinishing(false);
    }
  };

  const content = (
    <div className={isOnboardingFlow ? "mx-auto w-full max-w-3xl" : "mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8"}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            to={isOnboardingFlow ? "/onboarding/link-accounts" : "/channels"}
            className={[
              "inline-flex items-center gap-2 text-sm font-semibold",
              isOnboardingFlow
                ? "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                : "rounded-lg px-2 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            ].join(" ")}
          >
            <ChevronLeft size={18} aria-hidden />
            Back
          </Link>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className={[
              "inline-flex items-center gap-2 text-sm font-semibold",
              isOnboardingFlow
                ? "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                : "rounded-lg px-2 py-1.5 text-buffer-600 hover:text-buffer-700 dark:text-buffer-300 dark:hover:text-buffer-200",
            ].join(" ")}
          >
            Switch Account
            <ExternalLink size={16} aria-hidden />
          </button>
        </div>

        <article
          className={[
            "overflow-hidden rounded-3xl border shadow-card",
            isOnboardingFlow
              ? "border-slate-200 bg-white"
              : "buffer-card border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
          ].join(" ")}
        >
          <div
            className={[
              "border-b border-slate-200/80 px-6 py-5",
              isOnboardingFlow ? "bg-slate-50/60" : "bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/30",
            ].join(" ")}
          >
            <h1 className={["text-lg font-semibold", isOnboardingFlow ? "text-slate-900" : "text-slate-900 dark:text-white"].join(" ")}>
              Choose your LinkedIn destination
            </h1>
            <p className={["mt-1 text-sm", isOnboardingFlow ? "text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
              Select the profile or organization page you want to publish from in EngageHub.
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            {orgWarning ? (
              <div
                className={[
                  "rounded-2xl border p-4 text-sm",
                  isOnboardingFlow
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
                ].join(" ")}
              >
                {orgWarning}
              </div>
            ) : null}

            {loading ? (
              <div
                className={[
                  "flex items-center gap-3 rounded-2xl border p-4 text-sm",
                  isOnboardingFlow
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
                ].join(" ")}
              >
                <Loader2 className="animate-spin" size={18} aria-hidden />
                Loading LinkedIn destinations…
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold">We couldn’t load your LinkedIn destinations.</p>
                <p className="opacity-90">{error}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadSession}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
                  >
                    <RefreshCcw size={14} aria-hidden />
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-transparent px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/60"
                  >
                    Switch Account
                    <ExternalLink size={14} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {destinations.map((d) => (
                  <DestinationCard
                    key={`${d.type}:${d.id}`}
                    destination={d}
                    selected={selected?.type === d.type && selected?.id === d.id}
                    onboardingMode={isOnboardingFlow}
                    onSelect={(next) => setSelected(next)}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={loading || Boolean(error) || !selected || finishing}
                onClick={handleFinish}
                className={[
                  "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition",
                  isOnboardingFlow ? "rounded-full shadow-sm" : "rounded-xl",
                  loading || error || !selected || finishing
                    ? "bg-slate-400 dark:bg-slate-700"
                    : isOnboardingFlow
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-buffer-600 hover:bg-buffer-700 dark:bg-buffer-500 dark:hover:bg-buffer-600",
                ].join(" ")}
              >
                {finishing ? <Loader2 className="animate-spin" size={18} aria-hidden /> : null}
                Finish Connection
              </button>
            </div>
          </div>
        </article>
      </div>
  );

  if (isOnboardingFlow) return <OnboardingShell>{content}</OnboardingShell>;
  return <div className="dashboard-page">{content}</div>;
}

