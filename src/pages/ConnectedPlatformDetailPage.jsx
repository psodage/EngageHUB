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
import { AlertCircle, Building2, PenSquare, Sparkles, User, Video } from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_CAPABILITY_MATRIX, SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { buildPostingTargetsConfig } from "../utils/connectedPlatformPostingTargets";
import { getChannelDisplayInfo } from "../utils/channelDisplay";
import XCreatePostModal from "../components/social/XCreatePostModal";
import FacebookCreatePostModal from "../components/social/FacebookCreatePostModal";
import LinkedInCreatePostModal from "../components/social/LinkedInCreatePostModal";
import ThreadsCreatePostModal from "../components/social/ThreadsCreatePostModal";
import InstagramCreatePostModal from "../components/social/InstagramCreatePostModal";
import YouTubeCreatePostModal from "../components/social/YouTubeCreatePostModal";
import TelegramCreatePostModal from "../components/social/TelegramCreatePostModal";
import DiscordCreatePostModal from "../components/social/DiscordCreatePostModal";
import GoogleBusinessCreatePostModal from "../components/social/GoogleBusinessCreatePostModal";
import { normalizeChannelTab } from "../data/channelNav";
import PostHistoryPanel from "../components/social/PostHistoryPanel";
import ChannelProfileView from "../components/social/ChannelProfileView";
import ChannelFeedPanel from "../components/social/ChannelFeedPanel";
import ChannelProfilePageLayout from "../components/social/channel-detail/ChannelProfilePageLayout";
import ChannelCreatePanel from "../components/social/channel-detail/ChannelCreatePanel";

function formatPlatformLabel(platformKey) {
  const config = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  return config?.label || platformKey;
}

function TargetBadge({ badge }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  if (badge === "profile") {
    return (
      <span className={base}>
        <User size={12} className="text-sky-600" aria-hidden />
        Profile
      </span>
    );
  }
  if (badge === "page" || badge === "organization") {
    return (
      <span className={base}>
        <Building2 size={12} className="text-amber-600" aria-hidden />
        {badge === "organization" ? "Business" : "Page"}
      </span>
    );
  }
  if (badge === "channel") {
    return (
      <span className={base}>
        <Video size={12} className="text-rose-600" aria-hidden />
        Channel
      </span>
    );
  }
  return (
    <span className={base}>
      <Sparkles size={12} className="text-violet-600" aria-hidden />
      Account
    </span>
  );
}

export default function ConnectedPlatformDetailPage() {
  const { platformKey } = useParams();
  const { connectedAccounts, setToast, refreshConnectedAccounts } = useApp();
  const navigate = useNavigate();
  const [instagramComposerOpen, setInstagramComposerOpen] = useState(false);
  const [threadsComposerOpen, setThreadsComposerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const goToComposer = (path) => {
    if (platformKey === "threads") {
      setThreadsComposerOpen(true);
      return;
    }
    navigate(path);
  };
  const [xPostModalOpen, setXPostModalOpen] = useState(false);
  const openXComposer = () => setXPostModalOpen(true);
  const [facebookPostModalOpen, setFacebookPostModalOpen] = useState(false);
  const openFacebookComposer = () => setFacebookPostModalOpen(true);

  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [linkedinModalOpen, setLinkedinModalOpen] = useState(false);
  const [linkedinPreset, setLinkedinPreset] = useState({ targetType: "profile", organizationId: null });
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramPresetChatId, setTelegramPresetChatId] = useState("");
  const openTelegramComposer = (preset = "") => {
    setTelegramPresetChatId(typeof preset === "string" ? preset : "");
    setTelegramModalOpen(true);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const detailTab = normalizeChannelTab(searchParams.get("tab"));
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
  const [feedPostCount, setFeedPostCount] = useState(null);
  const bumpHistory = () => setHistoryRefreshKey((n) => n + 1);
  const openLinkedInComposer = (action) => {
    setLinkedinPreset(
      action && typeof action === "object"
        ? { targetType: action.targetType || "profile", organizationId: action.organizationId ?? null }
        : { targetType: "profile", organizationId: null }
    );
    setLinkedinModalOpen(true);
  };

  const [googleBusinessModalOpen, setGoogleBusinessModalOpen] = useState(false);
  const [googleBusinessPreset, setGoogleBusinessPreset] = useState(null);
  const [disconnectingGoogleLocationId, setDisconnectingGoogleLocationId] = useState("");
  const [disconnectingAccountId, setDisconnectingAccountId] = useState("");
  const [connectingAnother, setConnectingAnother] = useState(false);
  const openGoogleBusinessComposer = (preset) => {
    setGoogleBusinessPreset(
      preset && typeof preset === "object" && preset.accountId && preset.locationId ? preset : null
    );
    setGoogleBusinessModalOpen(true);
  };

  const [discordModalOpen, setDiscordModalOpen] = useState(false);
  const [discordPreset, setDiscordPreset] = useState(null);
  const openDiscordComposer = (preset) => {
    setDiscordPreset(preset && typeof preset === "object" && preset.channelId != null ? preset : null);
    setDiscordModalOpen(true);
  };

  const account = useMemo(
    () => connectedAccounts.find((item) => item.platform === platformKey),
    [connectedAccounts, platformKey]
  );

  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((platform) => platform.key === platformKey);
  const label = formatPlatformLabel(platformKey);
  const capabilities = account?.capabilities?.length ? account.capabilities : PLATFORM_CAPABILITY_MATRIX[platformKey]?.badges || [];
  const channelInfo = account ? getChannelDisplayInfo(account) : null;

  const postingTargets = useMemo(() => buildPostingTargetsConfig(platformKey, account), [platformKey, account]);

  useEffect(() => {
    if (!platformKey || !account?.isConnected) return;
    getPostHistory({ platform: platformKey, page: 1, limit: 1 })
      .then(({ pagination }) => setFeedPostCount(pagination.total ?? 0))
      .catch(() => setFeedPostCount(0));
  }, [platformKey, account?.isConnected, historyRefreshKey]);

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

  const runPrimaryCreate = () => {
    if (platformKey === "x") openXComposer();
    else if (platformKey === "linkedin") openLinkedInComposer({ targetType: "profile", organizationId: null });
    else if (platformKey === "facebook") openFacebookComposer();
    else if (platformKey === "instagram") setInstagramComposerOpen(true);
    else if (platformKey === "googleBusiness") openGoogleBusinessComposer(null);
    else if (platformKey === "youtube") setYoutubeModalOpen(true);
    else if (platformKey === "telegram") openTelegramComposer("");
    else if (platformKey === "discord") openDiscordComposer(null);
    else if (platformKey === "threads") goToComposer(postingTargets?.primaryCtaPath);
    else if (postingTargets?.primaryCtaPath) navigate(postingTargets.primaryCtaPath);
  };

  const runTargetCreate = (card) => {
    if (platformKey === "x") openXComposer();
    else if (platformKey === "linkedin" && card.linkedinAction) openLinkedInComposer(card.linkedinAction);
    else if (platformKey === "facebook") openFacebookComposer();
    else if (platformKey === "instagram") setInstagramComposerOpen(true);
    else if (platformKey === "googleBusiness") openGoogleBusinessComposer(card.googleBusinessPreset);
    else if (platformKey === "youtube") setYoutubeModalOpen(true);
    else if (platformKey === "telegram") openTelegramComposer(card.telegramChatId || "");
    else if (platformKey === "discord") openDiscordComposer(card.discordPreset || null);
    else if (platformKey === "threads") goToComposer(card.path);
    else navigate(card.path);
  };

  const showPrimaryCta =
    postingTargets?.primaryCtaPath ||
    ["linkedin", "facebook", "instagram", "googleBusiness", "youtube", "telegram", "discord"].includes(platformKey);

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

  const panelClass = detailTab === "feed" ? "channel-page-content--feed" : "";

  return (
    <>
      <ChannelProfilePageLayout
        account={account}
        platformKey={platformKey}
        postCount={feedPostCount}
        onRefresh={handleRefresh}
        onAddAccount={handleAddAnotherAccount}
        addingAccount={connectingAnother}
        syncing={syncing}
        activeTab={detailTab}
        onTabChange={setDetailTab}
        panelClassName={panelClass}
      >
        {detailTab === "profile" ? (
          <ChannelProfileView
            account={account}
            platformKey={platformKey}
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

        {detailTab === "feed" ? (
          <ChannelFeedPanel
            platformKey={platformKey}
            account={account}
            refreshKey={historyRefreshKey}
            onPostCount={setFeedPostCount}
          />
        ) : null}

        {detailTab === "create" ? (
          <ChannelCreatePanel
            postingTargets={postingTargets}
            showPrimaryCta={showPrimaryCta}
            onPrimaryCreate={runPrimaryCreate}
            onTargetCreate={runTargetCreate}
            TargetBadge={TargetBadge}
            label={label}
            onOpenComposer={() => navigate(`/create-post?platform=${encodeURIComponent(platformKey)}`)}
          />
        ) : null}

        {detailTab === "history" ? (
          <PostHistoryPanel platformKey={platformKey} refreshKey={historyRefreshKey} />
        ) : null}
      </ChannelProfilePageLayout>

      {platformKey === "x" ? (
          <XCreatePostModal open={xPostModalOpen} onClose={() => setXPostModalOpen(false)} onPublishSuccess={bumpHistory} />
        ) : null}
        {platformKey === "facebook" ? (
          <FacebookCreatePostModal
            open={facebookPostModalOpen}
            onClose={() => setFacebookPostModalOpen(false)}
            account={account}
            onPublishSuccess={bumpHistory}
          />
        ) : null}
        {platformKey === "linkedin" ? (
          <LinkedInCreatePostModal
            open={linkedinModalOpen}
            onClose={() => setLinkedinModalOpen(false)}
            account={account}
            preset={linkedinPreset}
            onPublishSuccess={bumpHistory}
          />
        ) : null}

        {platformKey === "threads" ? (
          <ThreadsCreatePostModal open={threadsComposerOpen} onClose={() => setThreadsComposerOpen(false)} onPublishSuccess={bumpHistory} />
        ) : null}
        {platformKey === "instagram" ? (
          <InstagramCreatePostModal open={instagramComposerOpen} onClose={() => setInstagramComposerOpen(false)} onPublishSuccess={bumpHistory} />
        ) : null}
        {platformKey === "googleBusiness" ? (
          <GoogleBusinessCreatePostModal
            open={googleBusinessModalOpen}
            onClose={() => {
              setGoogleBusinessModalOpen(false);
              setGoogleBusinessPreset(null);
            }}
            account={account}
            preset={googleBusinessPreset}
            onPublishSuccess={bumpHistory}
          />
        ) : null}
        {platformKey === "youtube" ? (
          <YouTubeCreatePostModal open={youtubeModalOpen} onClose={() => setYoutubeModalOpen(false)} account={account} onPublishSuccess={bumpHistory} />
        ) : null}
        {platformKey === "telegram" ? (
          <TelegramCreatePostModal
            open={telegramModalOpen}
            onClose={() => {
              setTelegramModalOpen(false);
              setTelegramPresetChatId("");
            }}
            account={account}
            presetChatId={telegramPresetChatId}
            onPublishSuccess={bumpHistory}
          />
        ) : null}
        {platformKey === "discord" ? (
          <DiscordCreatePostModal
            open={discordModalOpen}
            onClose={() => {
              setDiscordModalOpen(false);
              setDiscordPreset(null);
            }}
            account={account}
            preset={discordPreset}
            onPublishSuccess={bumpHistory}
          />
        ) : null}
    </>
  );

}
