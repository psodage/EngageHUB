import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { getInstagramAccountsSession, selectInstagramAccount, startSocialConnect } from "../services/socialApi";
import { useApp } from "../context/AppContext";

function flowReturnPath(flow) {
  const f = (flow || "settings").toLowerCase();
  if (f === "onboarding") return "/onboarding/link-accounts";
  if (f === "settings") return "/settings/channels";
  return "/channels/instagram";
}

function accountTypeLabel(type) {
  return String(type || "").toLowerCase() === "creator" ? "Creator" : "Business";
}

function InstagramAccountCard({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.instagramAccountId)}
      className={[
        "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left shadow-card transition",
        "bg-white hover:border-buffer-300 dark:bg-slate-900 dark:hover:border-buffer-500",
        selected ? "border-buffer-500 ring-2 ring-buffer-500/20 dark:border-buffer-400 dark:ring-buffer-400/15" : "border-slate-200/90 dark:border-slate-800",
      ].join(" ")}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        {item.profilePicture ? (
          <img src={item.profilePicture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {item.username ? `@${item.username}` : "Instagram account"}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {item.name || "Professional account"} · {accountTypeLabel(item.accountType)}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              Linked Page: {item.linkedPageName || "Facebook Page"}
            </p>
          </div>
          <CheckCircle2
            size={20}
            className={[
              "shrink-0 transition",
              selected ? "text-buffer-600 dark:text-buffer-400" : "text-slate-300 group-hover:text-slate-400 dark:text-slate-700 dark:group-hover:text-slate-600",
            ].join(" ")}
            aria-hidden
          />
        </div>
      </div>
    </button>
  );
}

export default function InstagramAccountSelectPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => String(searchParams.get("session") || "").trim(), [searchParams]);
  const navigate = useNavigate();
  const { setToast, refreshConnectedAccounts } = useApp();

  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [flow, setFlow] = useState("settings");
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [autoConnectPage, setAutoConnectPage] = useState(true);

  const loadSession = async () => {
    if (!sessionId) {
      setError("Missing connection session. Please reconnect Instagram.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getInstagramAccountsSession(sessionId);
      const next = Array.isArray(data?.instagramAccounts) ? data.instagramAccounts : [];
      setAccounts(next);
      setFlow(data?.flow || "settings");
      setSelectedAccountId((prev) => prev || (next[0]?.instagramAccountId ? String(next[0].instagramAccountId) : ""));
    } catch (err) {
      setError(err?.message || "Unable to load Instagram professional accounts.");
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
      const data = await startSocialConnect("instagram", { flow });
      window.location.href = data.url;
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to restart Meta login.", error: true });
    }
  };

  const handleFinish = async () => {
    if (!selectedAccountId || finishing) return;
    setFinishing(true);
    try {
      const result = await selectInstagramAccount({
        sessionId,
        instagramAccountId: selectedAccountId,
        autoConnectLinkedFacebookPage: autoConnectPage,
      });
      await refreshConnectedAccounts?.().catch(() => {});
      setToast?.({ message: "Instagram account connected successfully." });
      const returnPath = flowReturnPath(result?.flow || flow);
      const qs = new URLSearchParams();
      qs.set("social_platform", "instagram");
      qs.set("social_status", "connected");
      navigate(`${returnPath}?${qs.toString()}`, { replace: true });
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to finish connection.", error: true });
      setFinishing(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            to={isOnboardingFlow ? "/onboarding/link-accounts" : "/channels"}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ChevronLeft size={18} aria-hidden />
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-buffer-600 hover:text-buffer-700 dark:text-buffer-300 dark:hover:text-buffer-200"
          >
            Switch Facebook Account
            <ExternalLink size={16} aria-hidden />
          </button>
        </div>

        <article className="buffer-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200/80 bg-slate-50/60 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/30">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Select Instagram Account</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose the Instagram professional account you want to manage.
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <Loader2 className="animate-spin" size={18} aria-hidden />
                Loading Instagram accounts...
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold">Instagram permissions are missing.</p>
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
                </div>
              </div>
            ) : !accounts.length ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <p className="font-semibold">No Instagram professional accounts found.</p>
                <p>Make sure your Instagram account is professional and connected to a Facebook Page.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {accounts.map((item) => (
                  <InstagramAccountCard
                    key={item.instagramAccountId}
                    item={item}
                    selected={selectedAccountId === item.instagramAccountId}
                    onSelect={(id) => setSelectedAccountId(String(id))}
                  />
                ))}
              </div>
            )}

            {!loading && !error && accounts.length ? (
              <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoConnectPage}
                  onChange={(e) => setAutoConnectPage(Boolean(e.target.checked))}
                  className="h-4 w-4 rounded border-slate-300 text-buffer-600 focus:ring-buffer-500 dark:border-slate-600"
                />
                Auto-connect linked Facebook Page
              </label>
            ) : null}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={loading || Boolean(error) || !selectedAccountId || finishing}
                onClick={handleFinish}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition",
                  loading || error || !selectedAccountId || finishing
                    ? "bg-slate-400 dark:bg-slate-700"
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
    </div>
  );
}
