import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import ConnectedChannelProfileCard from "../social/ConnectedChannelProfileCard";
import DisconnectConfirmationDialog from "../social/DisconnectConfirmationDialog";
import ConnectChannelModal from "./ConnectChannelModal";
import { useSocialConnections } from "../../hooks/useSocialConnections";
import { useApp } from "../../context/AppContext";
import { SOCIAL_PLATFORM_CONFIGS, sortPlatformsForConnectModal } from "../../data/socialPlatforms";
import { listConnectionCardsFromAccounts } from "../../utils/socialAccountEntities";

export default function ChannelsConnectionsPanel({ variant = "channels", showHeader = true }) {
  const navigate = useNavigate();
  const { setToast, refreshConnectedAccounts } = useApp();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const {
    accounts,
    accountsByPlatform,
    availablePlatforms,
    temporarilyDisabledPlatforms,
    summary,
    loadingAccounts,
    processingPlatform,
    disconnectDialog,
    setDisconnectDialog,
    oauthBanner,
    startConnectQueue,
    disconnectPlatform,
  } = useSocialConnections({ setToast, refreshConnectedAccounts });

  const openDetails = (platformKey, entityId = "") => {
    if (platformKey === "facebook" && entityId) {
      navigate(`/channels/facebook?entity=${encodeURIComponent(entityId)}`);
      return;
    }
    navigate(`/channels/${platformKey}`);
  };

  const connectedForGrid = useMemo(() => {
    return listConnectionCardsFromAccounts(accounts)
      .map((card) => ({
        ...card,
        platformConfig: SOCIAL_PLATFORM_CONFIGS.find((p) => p.key === card.platform),
      }))
      .filter((item) => item.platformConfig);
  }, [accounts]);

  const connectedKeys = useMemo(
    () => new Set(accounts.filter((a) => a.isConnected).map((a) => a.platform)),
    [accounts]
  );

  const modalPlatforms = useMemo(() => {
    const keys = new Set([
      ...availablePlatforms.map((p) => p.key),
      ...temporarilyDisabledPlatforms.map((p) => p.key),
    ]);
    return sortPlatformsForConnectModal(SOCIAL_PLATFORM_CONFIGS.filter((p) => keys.has(p.key)));
  }, [availablePlatforms, temporarilyDisabledPlatforms]);

  const handleStartConnectQueue = async (platformKeys) => {
    await startConnectQueue(platformKeys);
  };

  return (
    <section className="space-y-6">
      {showHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {variant === "settings" ? "Channels & connections" : "Connect channels"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Connect social profiles and manage publishing access. Each channel syncs posts, analytics, and scheduling.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-buffer-50 px-3 py-1 text-xs font-semibold text-buffer-700 dark:bg-buffer-500/15 dark:text-buffer-300">
              {summary.totalConnected} connected
            </span>
            {summary.reconnectRequired > 0 ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                {summary.reconnectRequired} need reconnect
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-buffer-700"
            >
              <Plus size={16} />
              Connect a channel
            </button>
          </div>
        </header>
      ) : null}

      {oauthBanner ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            oauthBanner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          {oauthBanner.message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Connected</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{summary.totalConnected}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Available to add</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{summary.pendingPlatforms}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Action needed</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{summary.reconnectRequired}</p>
        </div>
      </div>

      {!loadingAccounts && connectedForGrid.length > 0 ? (
        <article className="rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-card backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Connected channels</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Manage posting, analytics, and settings per channel</p>
            </div>
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Plus size={14} />
              Add channel
            </button>
          </div>
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {connectedForGrid.map(({ cardKey, displayAccount, platformConfig }) => (
              <ConnectedChannelProfileCard
                key={cardKey}
                platformConfig={platformConfig}
                account={displayAccount}
                onOpen={() =>
                  openDetails(platformConfig.key, String(displayAccount.entityId || "").trim())
                }
                onDisconnect={() =>
                  setDisconnectDialog({
                    open: true,
                    platform: platformConfig.key,
                    accountId: displayAccount.connectedAccountId || "",
                  })
                }
              />
            ))}
          </div>
        </article>
      ) : null}

      {!loadingAccounts && connectedForGrid.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/40">
          <AlertCircle className="mb-3 text-buffer-600" size={28} />
          <p className="text-base font-semibold text-slate-900 dark:text-white">No channels connected yet</p>
          <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
            Connect Instagram, Facebook, LinkedIn, and more to publish and schedule from one place.
          </p>
          <button
            type="button"
            onClick={() => setConnectModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-buffer-700"
          >
            <Plus size={16} />
            Connect a New Channel
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        <DisconnectConfirmationDialog
          open={disconnectDialog.open}
          platformLabel={disconnectDialog.platform}
          singleAccount={Boolean(disconnectDialog.accountId)}
          loading={!!processingPlatform}
          onCancel={() => setDisconnectDialog({ open: false, platform: "", accountId: "" })}
          onConfirm={disconnectPlatform}
        />
      </AnimatePresence>

      <ConnectChannelModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        platforms={modalPlatforms}
        connectedKeys={connectedKeys}
        processingPlatform={processingPlatform}
        onStartConnectQueue={handleStartConnectQueue}
      />
    </section>
  );
}
