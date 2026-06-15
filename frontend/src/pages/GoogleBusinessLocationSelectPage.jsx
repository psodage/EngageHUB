import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import PlatformBrandIcon from "../components/channels/PlatformBrandIcon";
import {
  getGoogleBusinessLocationsSession,
  selectGoogleBusinessLocations,
  startSocialConnect,
} from "../services/socialApi";
import { useApp } from "../context/AppContext";
import OnboardingShell from "../components/onboarding/OnboardingShell";

function flowReturnPath(flow) {
  const f = (flow || "settings").toLowerCase();
  if (f === "onboarding") return "/onboarding/link-accounts";
  if (f === "settings") return "/settings/channels";
  return "/channels/googleBusiness";
}

function LocationCard({ location, selected, onToggle, onboardingMode = false }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(location.locationId)}
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
      <PlatformBrandIcon platformKey="googleBusiness" size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={["truncate text-sm font-semibold", onboardingMode ? "text-slate-900" : "text-slate-900 dark:text-white"].join(" ")}>
              {location.title || `Location ${location.locationId}`}
            </p>
            <p className={["mt-0.5 truncate text-xs", onboardingMode ? "text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
              {location.accountName || "Google Business Account"} · Business
            </p>
            <p className={["mt-1 truncate text-xs", onboardingMode ? "text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
              {location.address || location.primaryCategory || "Business profile"}
            </p>
          </div>
          <CheckCircle2
            size={20}
            className={[
              "shrink-0 transition",
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
    </button>
  );
}

export default function GoogleBusinessLocationSelectPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => String(searchParams.get("session") || "").trim(), [searchParams]);
  const navigate = useNavigate();
  const { setToast, refreshConnectedAccounts } = useApp();

  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState([]);
  const [flow, setFlow] = useState("settings");
  const isOnboardingFlow = flow === "onboarding";
  const [selectedIds, setSelectedIds] = useState([]);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const allSelected = locations.length > 0 && selectedIds.length === locations.length;
  const isQuotaError = (message) => /rate limit|quota exceeded/i.test(String(message || ""));

  const loadSession = async ({ autoRetry = false } = {}) => {
    if (!sessionId) {
      setError("Missing connection session. Please reconnect Google Business Profile.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getGoogleBusinessLocationsSession(sessionId);
      const next = Array.isArray(data?.locations) ? data.locations : [];
      setLocations(next);
      setFlow(data?.flow || "settings");
      setSelectedIds((prev) => (prev.length ? prev : next.slice(0, 1).map((row) => row.locationId)));
      setRetryCountdown(0);
      if (!next.length) {
        setError("No Google Business Profiles found for this account.");
      }
    } catch (err) {
      const message = err?.message || "Unable to load Google Business Profiles.";
      setError(message);
      if (autoRetry && isQuotaError(message)) {
        setRetryCountdown(90);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession({ autoRetry: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (retryCountdown <= 0 || loading || locations.length > 0) return undefined;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          loadSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCountdown, loading, locations.length]);

  const handleSwitchAccount = async () => {
    try {
      const data = await startSocialConnect("googleBusiness", { flow });
      window.location.href = data.url;
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to restart Google login.", error: true });
    }
  };

  const toggleLocation = (locationId) => {
    setSelectedIds((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(locations.map((loc) => loc.locationId));
  };

  const handleFinish = async () => {
    if (!selectedIds.length || finishing) {
      if (!selectedIds.length) setToast?.({ message: "Select at least one business profile.", error: true });
      return;
    }
    setFinishing(true);
    try {
      const result = await selectGoogleBusinessLocations({ sessionId, locationIds: selectedIds });
      await refreshConnectedAccounts?.().catch(() => {});
      setToast?.({
        message:
          result?.count > 1
            ? `${result.count} Google Business Profiles connected.`
            : "Google Business Profile connected successfully.",
      });
      const returnPath = flowReturnPath(result?.flow || flow);
      const qs = new URLSearchParams();
      qs.set("social_platform", "googleBusiness");
      qs.set("social_status", "connected");
      navigate(`${returnPath}?${qs.toString()}`, { replace: true });
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to finish connection.", error: true });
      setFinishing(false);
    }
  };

  const content = (
      <div className={isOnboardingFlow ? "mx-auto w-full max-w-4xl" : "mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8"}>
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
            Cancel
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
            Switch Google Account
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
              Select Google Business Profiles
            </h1>
            <p className={["mt-1 text-sm", isOnboardingFlow ? "text-slate-500" : "text-slate-500 dark:text-slate-400"].join(" ")}>
              Choose the business locations you want to manage from EngageHub.
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            {!loading && !error ? (
              <label
                className={[
                  "inline-flex items-center gap-2 text-sm font-medium",
                  isOnboardingFlow ? "text-slate-700" : "text-slate-700 dark:text-slate-200",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-buffer-600 focus:ring-buffer-500"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Select All
              </label>
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
                {retryCountdown > 0
                  ? `Google API rate limit — retrying in ${retryCountdown}s…`
                  : "Loading Google Business Profiles from Google (may take up to a minute)…"}
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold">We couldn’t load your business profiles.</p>
                <p className="opacity-90">{error}</p>
                {isQuotaError(error) ? (
                  <p className="text-xs opacity-80">
                    Google limits how many requests per minute your Cloud project can make. Wait before retrying, and
                    avoid clicking Connect again on the channels page.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadSession()}
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
                    Switch Google Account
                    <ExternalLink size={14} aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {locations.map((loc) => (
                  <LocationCard
                    key={`${loc.accountId}:${loc.locationId}`}
                    location={loc}
                    selected={selectedIds.includes(loc.locationId)}
                    onboardingMode={isOnboardingFlow}
                    onToggle={toggleLocation}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => navigate(isOnboardingFlow ? "/onboarding/link-accounts" : "/channels")}
                className={[
                  "border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50",
                  isOnboardingFlow
                    ? "rounded-full"
                    : "rounded-xl dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || Boolean(error) || !selectedIds.length || finishing}
                onClick={handleFinish}
                className={[
                  "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition",
                  isOnboardingFlow ? "rounded-full shadow-sm" : "rounded-xl",
                  loading || error || !selectedIds.length || finishing
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
