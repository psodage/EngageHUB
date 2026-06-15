import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SOCIAL_PLATFORM_CONFIGS, isPlatformConnectTemporarilyDisabled, getPlatformsForUserType } from "../data/socialPlatforms";
import { getSocialOAuthErrorMessage, startSocialConnect } from "../services/socialApi";
import { useApp } from "../context/AppContext";
import { stripOAuthRedirectFragment } from "../utils/oauthReturnUrl";
import OnboardingShell from "../components/onboarding/OnboardingShell";
import OnboardingHeader from "../components/onboarding/OnboardingHeader";
import ProgressTracker from "../components/onboarding/ProgressTracker";
import PlatformCard from "../components/onboarding/PlatformCard";
import OnboardingActions from "../components/onboarding/OnboardingActions";
import OnboardingFlowPanel from "../components/onboarding/OnboardingFlowPanel";

const ONBOARDING_STORAGE_KEY = "engagehub-onboarding-flow";

export default function LinkAccounts() {
  const navigate = useNavigate();
  const {
    setToast,
    completeOnboarding,
    setConnectionStatus,
    connectedAccounts,
    refreshConnectedAccounts,
    logout,
    user,
  } = useApp();
  const [selected, setSelected] = useState(() => {
    return getPlatformsForUserType(user?.userType).reduce((acc, platform) => {
      acc[platform.key] = false;
      return acc;
    }, {});
  });
  const [queue, setQueue] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [started, setStarted] = useState(false);
  const [processingPlatform, setProcessingPlatform] = useState("");
  const [finishing, setFinishing] = useState(false);

  const accountsByPlatform = useMemo(
    () =>
      connectedAccounts.reduce((acc, account) => {
        if (account?.platform) acc[account.platform] = account;
        return acc;
      }, {}),
    [connectedAccounts]
  );

  const orderedPlatforms = useMemo(() => {
    const userPlatforms = getPlatformsForUserType(user?.userType);
    const available = userPlatforms.filter(
      (p) => !isPlatformConnectTemporarilyDisabled(p.key)
    );
    const comingSoon = userPlatforms.filter(
      (p) => isPlatformConnectTemporarilyDisabled(p.key)
    );
    return [...available, ...comingSoon];
  }, [user?.userType]);

  const currentIndex = useMemo(
    () => queue.findIndex((platform) => !["connected", "skipped"].includes(statusMap[platform])),
    [queue, statusMap]
  );
  const currentPlatform = currentIndex >= 0 ? queue[currentIndex] : "";
  const processedCount = queue.filter((platform) => ["connected", "skipped"].includes(statusMap[platform])).length;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const progressTotal = started ? queue.length : getPlatformsForUserType(user?.userType).length;
  const progressCurrent = started ? processedCount : selectedCount;
  const progressPercent = progressTotal ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  const getDashboardPath = (userType) => {
    if (userType === "influencer") return "/dashboard/influencer";
    if (userType === "student") return "/dashboard/student";
    return "/dashboard/business";
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
    logout();
    navigate("/login", { replace: true });
  };

  const persistFlow = (nextQueue, nextStatusMap) => {
    sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ queue: nextQueue, statusMap: nextStatusMap }));
  };

  const loadPersistedFlow = () => {
    try {
      const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) return { queue: [], statusMap: {} };
      const parsed = JSON.parse(raw);
      return {
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        statusMap: parsed.statusMap && typeof parsed.statusMap === "object" ? parsed.statusMap : {},
      };
    } catch {
      return { queue: [], statusMap: {} };
    }
  };

  const finishOnboarding = async (nextQueue, nextStatusMap) => {
    if (finishing) return;
    setFinishing(true);
    const skippedPlatforms = nextQueue.filter((platform) => nextStatusMap[platform] === "skipped");
    const result = await completeOnboarding({ skippedPlatforms });
    setFinishing(false);
    if (!result.ok) {
      setToast({ message: result.error?.message || "Unable to complete onboarding.", error: true });
      return;
    }
    sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setToast({ message: "Your accounts are connected successfully." });
    navigate(getDashboardPath(user.userType));
  };

  const goToNext = async (nextQueue, nextStatusMap) => {
    const nextIndex = nextQueue.findIndex((platform) => !["connected", "skipped"].includes(nextStatusMap[platform]));
    if (nextIndex === -1) {
      await finishOnboarding(nextQueue, nextStatusMap);
      return;
    }

    const platform = nextQueue[nextIndex];
    const updatedStatus = { ...nextStatusMap, [platform]: "processing" };
    setStatusMap(updatedStatus);
    persistFlow(nextQueue, updatedStatus);
    setProcessingPlatform(platform);

    try {
      const data = await startSocialConnect(platform, { flow: "onboarding" });
      window.location.href = data.url;
    } catch (error) {
      const message = getSocialOAuthErrorMessage(error?.message, platform);
      const failedStatus = { ...updatedStatus, [platform]: "failed" };
      setStatusMap(failedStatus);
      persistFlow(nextQueue, failedStatus);
      setProcessingPlatform("");
      setToast({ message, error: true });
    }
  };

  useEffect(() => {
    const { queue: persistedQueue, statusMap: persistedStatusMap } = loadPersistedFlow();
    if (!persistedQueue.length) return;
    setQueue(persistedQueue);
    setStatusMap(persistedStatusMap);
    setStarted(true);
  }, []);

  useEffect(() => {
    if (!started) return;

    stripOAuthRedirectFragment();

    const params = new URLSearchParams(window.location.search);
    const returnedPlatform = (params.get("social_platform") || "").trim().toLowerCase();
    const platform = returnedPlatform === "thread" ? "threads" : returnedPlatform;
    const socialStatus = params.get("social_status");
    const reason = params.get("reason");
    const oauthDetail = params.get("oauth_detail");
    const oauthRedirectUri = params.get("oauth_redirect_uri");
    if (!platform || !socialStatus) return;

    const { queue: persistedQueue, statusMap: persistedStatusMap } = loadPersistedFlow();
    if (!persistedQueue.includes(platform)) return;

    const nextStatusMap = {
      ...persistedStatusMap,
      [platform]: socialStatus === "connected" ? "connected" : "failed",
    };

    setQueue(persistedQueue);
    setStatusMap(nextStatusMap);
    setProcessingPlatform("");

    const handleReturn = async () => {
      if (socialStatus === "connected") {
        setConnectionStatus(platform, true);
        await refreshConnectedAccounts().catch(() => {});
        setToast({ message: `${platform} connected successfully.` });
        goToNext(persistedQueue, nextStatusMap);
      } else {
        const message = getSocialOAuthErrorMessage(reason, platform, oauthDetail, oauthRedirectUri);
        setToast({ message, error: true });
      }
    };

    handleReturn();
    persistFlow(persistedQueue, nextStatusMap);

    params.delete("social_platform");
    params.delete("social_status");
    params.delete("reason");
    params.delete("oauth_detail");
    params.delete("oauth_redirect_uri");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [started, setToast, setConnectionStatus, refreshConnectedAccounts]);

  const handleToggle = (platform) => {
    const alreadyConnected = Boolean(accountsByPlatform[platform]?.isConnected);
    if (started || isPlatformConnectTemporarilyDisabled(platform) || alreadyConnected) return;
    setSelected((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const startFlow = async () => {
    const selectedPlatforms = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([platform]) => platform)
      .filter((platform) => !accountsByPlatform[platform]?.isConnected);
    if (!selectedPlatforms.length) {
      finishOnboarding([], {});
      return;
    }

    const initialStatuses = selectedPlatforms.reduce((acc, platform) => {
      acc[platform] = "pending";
      return acc;
    }, {});

    setStarted(true);
    setQueue(selectedPlatforms);
    setStatusMap(initialStatuses);
    persistFlow(selectedPlatforms, initialStatuses);
    await goToNext(selectedPlatforms, initialStatuses);
  };

  const retryCurrent = async () => {
    if (!currentPlatform) return;
    const nextStatusMap = { ...statusMap, [currentPlatform]: "pending" };
    setStatusMap(nextStatusMap);
    persistFlow(queue, nextStatusMap);
    await goToNext(queue, nextStatusMap);
  };

  const skipCurrent = async () => {
    if (!currentPlatform) return;
    const nextStatusMap = { ...statusMap, [currentPlatform]: "skipped" };
    setStatusMap(nextStatusMap);
    persistFlow(queue, nextStatusMap);
    await goToNext(queue, nextStatusMap);
  };

  const getCardStatus = (platformKey) => {
    if (started) return statusMap[platformKey] || "not-selected";
    if (accountsByPlatform[platformKey]?.isConnected) return "connected";
    return "not-selected";
  };

  return (
    <OnboardingShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <OnboardingHeader />
          <div className="flex items-start gap-2 self-start">
            <ProgressTracker
              processedCount={progressCurrent}
              totalCount={progressTotal}
              percent={progressPercent}
            />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {orderedPlatforms.map((platform) => {
              const disabled = isPlatformConnectTemporarilyDisabled(platform.key);
              const alreadyConnected = Boolean(accountsByPlatform[platform.key]?.isConnected);
              const cardStatus = getCardStatus(platform.key);
              const isSelected = selected[platform.key];
              const isProcessing = processingPlatform === platform.key;

              const isInstagramOrThreads = platform.key === "instagram" || platform.key === "threads";
              return (
                <PlatformCard
                  key={platform.key}
                  platform={platform}
                  isSelected={alreadyConnected ? false : isSelected}
                  status={cardStatus}
                  disabled={disabled || alreadyConnected}
                  started={started}
                  isProcessing={isProcessing}
                  onToggle={handleToggle}
                  className={isInstagramOrThreads ? "mt-2.5 sm:mt-3.5" : ""}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-4 shrink-0">
          {!started ? (
            <OnboardingActions
              selectedCount={selectedCount}
              finishing={finishing}
              onContinue={startFlow}
              onSkip={() => finishOnboarding([], {})}
            />
          ) : (
            <OnboardingFlowPanel
              currentPlatform={currentPlatform}
              processingPlatform={processingPlatform}
              statusMap={statusMap}
              finishing={finishing}
              onRetry={retryCurrent}
              onSkip={skipCurrent}
              onFinish={() => finishOnboarding(queue, statusMap)}
            />
          )}
        </div>

        <p className="mt-3 shrink-0 text-center text-[11px] text-slate-400">
          Secure OAuth · Credentials are never stored on our servers
        </p>
      </div>
    </OnboardingShell>
  );
}
