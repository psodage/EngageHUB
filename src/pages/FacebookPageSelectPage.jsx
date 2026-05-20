import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ExternalLink, Loader2, RefreshCcw, User } from "lucide-react";
import { getFacebookPagesSession, selectFacebookPage, startSocialConnect } from "../services/socialApi";
import { useApp } from "../context/AppContext";

function flowReturnPath(flow) {
  const f = (flow || "settings").toLowerCase();
  if (f === "onboarding") return "/onboarding/platforms";
  if (f === "settings") return "/settings/channels";
  return "/channels/facebook";
}

function InstagramChip({ ig }) {
  if (!ig?.id) return null;
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-amber-500" />
      <span className="truncate">{ig.username ? `@${ig.username}` : "Instagram connected"}</span>
    </div>
  );
}

function AccountCard({ account, selected, onSelect }) {
  const ig = account?.instagram_business_account;
  const isProfile = account?.entityType === "profile";
  return (
    <button
      type="button"
      onClick={() => onSelect(account.id)}
      className={[
        "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left shadow-card transition",
        "bg-white hover:border-buffer-300 dark:bg-slate-900 dark:hover:border-buffer-500",
        selected ? "border-buffer-500 ring-2 ring-buffer-500/20 dark:border-buffer-400 dark:ring-buffer-400/15" : "border-slate-200/90 dark:border-slate-800",
      ].join(" ")}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        {account.pictureUrl ? (
          <img src={account.pictureUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : isProfile ? (
          <User size={22} className="text-slate-400" aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {account.name || (isProfile ? "Facebook Profile" : "Facebook Page")}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {account.category || (isProfile ? "Personal profile" : "Page")}
            </p>
          </div>
          <div className="shrink-0">
            <CheckCircle2
              size={20}
              className={[
                "transition",
                selected ? "text-buffer-600 dark:text-buffer-400" : "text-slate-300 group-hover:text-slate-400 dark:text-slate-700 dark:group-hover:text-slate-600",
              ].join(" ")}
              aria-hidden
            />
          </div>
        </div>
        <InstagramChip ig={ig} />
      </div>
    </button>
  );
}

export default function FacebookPageSelectPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => String(searchParams.get("session") || "").trim(), [searchParams]);
  const navigate = useNavigate();
  const { setToast, refreshConnectedAccounts } = useApp();

  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [pages, setPages] = useState([]);
  const [flow, setFlow] = useState("settings");
  const [selectedId, setSelectedId] = useState("");

  const destinations = useMemo(() => {
    const list = [];
    if (profile?.id) list.push(profile);
    for (const page of pages) {
      if (page?.id) list.push(page);
    }
    return list;
  }, [profile, pages]);

  const loadSession = async () => {
    if (!sessionId) {
      setError("Missing connection session. Please reconnect Facebook.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getFacebookPagesSession(sessionId);
      const nextProfile = data?.profile?.id ? data.profile : null;
      const nextPages = Array.isArray(data?.pages) ? data.pages : [];
      setProfile(nextProfile);
      setPages(nextPages);
      setFlow(data?.flow || "settings");
      const defaultId = nextProfile?.id || nextPages[0]?.id || "";
      setSelectedId((prev) => prev || (defaultId ? String(defaultId) : ""));
      if (!nextProfile?.id && !nextPages.length) {
        setError("No Facebook Profile or Pages were found for this account.");
      }
    } catch (err) {
      setError(err?.message || "Unable to load Facebook Pages.");
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
      const data = await startSocialConnect("facebook", { flow });
      window.location.href = data.url;
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to restart Facebook login.", error: true });
    }
  };

  const handleFinish = async () => {
    if (!selectedId || finishing) return;
    setFinishing(true);
    try {
      const result = await selectFacebookPage(sessionId, selectedId);
      await refreshConnectedAccounts?.().catch(() => {});
      const isProfile = profile?.id && selectedId === profile.id;
      if (result?.warning) {
        setToast?.({ message: result.warning, error: false });
      } else {
        setToast?.({
          message: isProfile ? "Facebook Profile connected successfully." : "Facebook Page connected successfully.",
        });
      }
      const returnPath = flowReturnPath(result?.flow || flow);
      const qs = new URLSearchParams();
      qs.set("social_platform", "facebook");
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
            to="/channels"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ChevronLeft size={18} aria-hidden />
            Back
          </Link>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-buffer-600 hover:text-buffer-700 dark:text-buffer-300 dark:hover:text-buffer-200"
          >
            Switch Account
            <ExternalLink size={16} aria-hidden />
          </button>
        </div>

        <article className="buffer-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200/80 bg-slate-50/60 px-6 py-5 dark:border-slate-800 dark:bg-slate-950/30">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Confirm your Account</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose your Facebook Profile or Page to connect.
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <Loader2 className="animate-spin" size={18} aria-hidden />
                Loading Facebook accounts…
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold">We couldn’t load your accounts.</p>
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
                {destinations.map((account) => (
                  <AccountCard
                    key={`${account.entityType || "page"}-${account.id}`}
                    account={account}
                    selected={selectedId === account.id}
                    onSelect={(id) => setSelectedId(String(id))}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                disabled={loading || Boolean(error) || !selectedId || finishing}
                onClick={handleFinish}
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition",
                  loading || error || !selectedId || finishing
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

