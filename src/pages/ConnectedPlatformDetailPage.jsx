import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  disconnectGoogleBusinessLocation,
  disconnectSocialAccount,
  getPostHistory,
  refreshSocial,
  startSocialConnect,
} from "../services/socialApi";
import { isPlatformConnectTemporarilyDisabled } from "../data/socialPlatforms";
import { syncGitHubAccount } from "../services/githubApi";
import GitHubDashboard from "../components/github/GitHubDashboard";
import { AlertCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import {
  buildScopedCreatePostPath,
  getChannelDisplayInfo,
  resolveFacebookDisplayAccount,
  resolveLinkedInDisplayAccount,
} from "../utils/channelDisplay";
import { getChannelEntityIdFromSearch } from "../utils/navigation";
import { normalizeChannelTab } from "../data/channelNav";
import PostHistoryPanel from "../components/social/PostHistoryPanel";
import ChannelProfileView from "../components/social/ChannelProfileView";
import ChannelProfilePageLayout from "../components/social/channel-detail/ChannelProfilePageLayout";

function formatPlatformLabel(platformKey) {
  const config = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  return config?.label || platformKey;
}

export default function ConnectedPlatformDetailPage() {
  const { platformKey } = useParams();
  const { connectedAccounts, setToast, refreshConnectedAccounts } = useApp();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const detailTab = normalizeChannelTab(searchParams.get("tab"));
  const scopedEntityId = useMemo(
    () => getChannelEntityIdFromSearch(searchParams.toString()),
    [searchParams]
  );

  const account = useMemo(
    () => connectedAccounts.find((item) => item.platform === platformKey),
    [connectedAccounts, platformKey]
  );

  const displayAccount = useMemo(() => {
    if (!account?.isConnected) return account;
    if (platformKey === "facebook") return resolveFacebookDisplayAccount(account, scopedEntityId);
    if (platformKey === "linkedin") return resolveLinkedInDisplayAccount(account, scopedEntityId);
    return account;
  }, [account, platformKey, scopedEntityId]);

  const createPostPath = useMemo(() => {
    if (!platformKey) return "/create-post";
    const entityId =
      platformKey === "facebook" || platformKey === "linkedin"
        ? String(displayAccount?.entityId || scopedEntityId || "").trim()
        : "";
    const entityType =
      platformKey === "facebook"
        ? String(displayAccount?.entityType || (scopedEntityId ? "" : "profile")).trim()
        : platformKey === "linkedin"
          ? String(displayAccount?.entityType || "").trim()
          : "";
    return buildScopedCreatePostPath(
      { platformKey, entityId, entityType },
      platformKey === "facebook" ? account : null
    );
  }, [platformKey, displayAccount?.entityId, displayAccount?.entityType, scopedEntityId, account]);

  const setDetailTab = (tabId) => {
    const next = normalizeChannelTab(tabId);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "profile") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true }
    );
  };
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [postCount, setPostCount] = useState(null);
  const bumpHistory = () => setHistoryRefreshKey((n) => n + 1);
  const [disconnectingGoogleLocationId, setDisconnectingGoogleLocationId] = useState("");
  const [disconnectingAccountId, setDisconnectingAccountId] = useState("");
  const [connectingAnother, setConnectingAnother] = useState(false);

  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  const label = formatPlatformLabel(platformKey);
  const capabilities = account?.capabilities?.length ? account.capabilities : PLATFORM_CAPABILITY_MATRIX[platformKey]?.badges || [];
  const channelInfo = displayAccount ? getChannelDisplayInfo(displayAccount) : null;

  const historyTargetId =
    platformKey === "facebook" || platformKey === "linkedin"
      ? String(displayAccount?.entityId || scopedEntityId || "").trim()
      : "";

  useEffect(() => {
    if (!platformKey || !account?.isConnected) return;
    getPostHistory({
      platform: platformKey,
      targetId: historyTargetId || undefined,
      page: 1,
      limit: 1,
    })
      .then(({ pagination }) => setPostCount(pagination.total ?? 0))
      .catch(() => setPostCount(0));
  }, [platformKey, account?.isConnected, historyRefreshKey, historyTargetId]);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      if (platformKey === "github") {
        await syncGitHubAccount();
      } else {
        await refreshSocial(platformKey);
      }
      if (refreshConnectedAccounts) await refreshConnectedAccounts();
      setToast?.({ message: `${channelInfo?.platformLabel || label} synced successfully.` });
      bumpHistory();
    } catch (err) {
      setToast?.({ message: err?.message || "Sync failed. Try again.", error: true });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectGoogleBusinessLocation = async (entity) => {
    const locationId = entity?.entityId ? String(entity.entityId).trim() : "";
    if (!locationId || disconnectingGoogleLocationId) return;
    setDisconnectingGoogleLocationId(locationId);
    try {
      await disconnectGoogleBusinessLocation(locationId);
      if (refreshConnectedAccounts) await refreshConnectedAccounts();
      setToast?.({ message: "Google Business location disconnected." });
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to disconnect Google Business location.", error: true });
    } finally {
      setDisconnectingGoogleLocationId("");
    }
  };

  const handleDisconnectOAuthConnection = async (entity) => {
    const accountId = entity?.id ? String(entity.id).trim() : "";
    if (!accountId || disconnectingAccountId) return;
    setDisconnectingAccountId(accountId);
    try {
      const result = await disconnectSocialAccount(platformKey, accountId);
      if (refreshConnectedAccounts) await refreshConnectedAccounts();
      if (!result?.isConnected) {
        navigate("/channels");
        return;
      }
      setToast?.({ message: "Account disconnected." });
    } catch (err) {
      setToast?.({ message: err?.message || "Unable to disconnect account.", error: true });
    } finally {
      setDisconnectingAccountId("");
    }
  };

  const handleDisconnectEntity = async (entity) => {
    if (platformKey === "googleBusiness" && entity?.entityType === "location") {
      await handleDisconnectGoogleBusinessLocation(entity);
      return;
    }
    await handleDisconnectOAuthConnection(entity);
  };

  const handleAddAnotherAccount = async () => {
    if (!platformKey || isPlatformConnectTemporarilyDisabled(platformKey)) {
      setToast?.({ message: "Connecting is temporarily unavailable for this platform.", error: true });
      return;
    }
    setConnectingAnother(true);
    try {
      const data = await startSocialConnect(platformKey, { flow: "channels" });
      window.location.href = data.url;
    } catch (err) {
      setToast?.({ message: err?.message || `Failed to connect ${platformKey}.`, error: true });
      setConnectingAnother(false);
    }
  };

  if (!platformConfig) {
    return (
      <div className="channel-page">
        <article className="channel-page-card buffer-card p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Unknown platform.</p>
          <Link to="/channels" className="mt-3 inline-block text-sm font-semibold text-buffer-600 hover:text-buffer-700">
            Back to Connect channels
          </Link>
        </article>
      </div>
    );
  }

  if (!account?.isConnected) {
    return (
      <div className="channel-page">
        <article className="channel-page-card buffer-card space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <AlertCircle size={18} className="text-amber-600" />
            <h1 className="text-lg font-semibold">{label} is not connected</h1>
          </div>
          <p className="text-sm text-slate-500">Connect this platform first from the Connect channels page.</p>
          <button
            type="button"
            onClick={() => navigate("/channels")}
            className="inline-flex rounded-lg bg-buffer-600 px-4 py-2 text-sm font-semibold text-white hover:bg-buffer-700"
          >
            Go to Connect channels
          </button>
        </article>
      </div>
    );
  }

  return (
    <>
      <ChannelProfilePageLayout
        account={displayAccount || account}
        platformKey={platformKey}
        postCount={postCount}
        createPostPath={createPostPath}
        onRefresh={handleRefresh}
        onAddAccount={handleAddAnotherAccount}
        addingAccount={connectingAnother}
        syncing={syncing}
        activeTab={detailTab}
        onTabChange={setDetailTab}
      >
        {detailTab === "profile" ? (
          <ChannelProfileView
            account={account}
            platformKey={platformKey}
            scopedEntityId={
              platformKey === "facebook" || platformKey === "linkedin" ? historyTargetId : ""
            }
            capabilities={capabilities}
            onDisconnectEntity={handleDisconnectEntity}
            disconnectingEntityId={disconnectingGoogleLocationId || disconnectingAccountId}
          />
        ) : null}

        {detailTab === "analytics" && platformKey === "github" ? (
          <GitHubDashboard
            account={account}
            setToast={setToast}
            onSyncComplete={async () => {
              if (refreshConnectedAccounts) await refreshConnectedAccounts();
              bumpHistory();
            }}
          />
        ) : null}

        {detailTab === "history" ? (
          <PostHistoryPanel
            platformKey={platformKey}
            targetId={historyTargetId || undefined}
            refreshKey={historyRefreshKey}
          />
        ) : null}
      </ChannelProfilePageLayout>
    </>
  );

}
