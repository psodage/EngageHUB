import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  PLATFORM_CAPABILITY_MATRIX,
  SOCIAL_PLATFORM_CONFIGS,
  isHiddenConnectPlatform,
  isPlatformConnectTemporarilyDisabled,
  getPlatformsForUserType,
} from "../data/socialPlatforms";
import {
  disconnectSocial,
  disconnectSocialAccount,
  getSocialAccounts,
  getSocialOAuthErrorMessage,
  manualConnectSocial,
  refreshSocial,
  startSocialConnect,
} from "../services/socialApi";
import {
  clearConnectQueue,
  getNextPendingPlatform,
  loadConnectQueue,
  saveConnectQueue,
} from "../utils/channelConnectQueue";
import { stripOAuthRedirectFragment } from "../utils/oauthReturnUrl";

function resolveOAuthFlow(pathname) {
  if (pathname.startsWith("/channels") && !pathname.startsWith("/settings")) return "channels";
  return "settings";
}

export function useSocialConnections({ setToast, refreshConnectedAccounts, onOAuthSuccess } = {}) {
  const location = useLocation();
  const oauthFlow = resolveOAuthFlow(location.pathname);
  const advancingQueueRef = useRef(false);
  const { user } = useApp();
  const userType = user?.userType || "business";

  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [processingPlatform, setProcessingPlatform] = useState("");
  const [disconnectDialog, setDisconnectDialog] = useState({ open: false, platform: "", accountId: "" });
  const [oauthBanner, setOauthBanner] = useState(null);

  const visibleAccounts = useMemo(
    () => accounts.filter((item) => !isHiddenConnectPlatform(item.platform)),
    [accounts]
  );

  const accountsByPlatform = useMemo(
    () =>
      visibleAccounts.reduce((acc, item) => {
        acc[item.platform] = item;
        return acc;
      }, {}),
    [visibleAccounts]
  );

  const { availablePlatforms, temporarilyDisabledPlatforms } = useMemo(() => {
    const userPlatforms = getPlatformsForUserType(userType);
    const available = [];
    const disabled = [];
    for (const platform of userPlatforms) {
      if (isPlatformConnectTemporarilyDisabled(platform.key)) disabled.push(platform);
      else available.push(platform);
    }
    return { availablePlatforms: available, temporarilyDisabledPlatforms: disabled };
  }, [userType]);

  const summary = useMemo(() => {
    const connected = visibleAccounts.filter((item) => item.isConnected).length;
    const reconnectRequired = visibleAccounts.filter((item) => item.isConnected && item.isTokenExpired).length;
    const pendingPlatforms = getPlatformsForUserType(userType).filter(
      (platform) =>
        !isPlatformConnectTemporarilyDisabled(platform.key) && !accountsByPlatform[platform.key]?.isConnected
    ).length;
    return {
      totalConnected: connected,
      reconnectRequired,
      pendingPlatforms,
    };
  }, [visibleAccounts, accountsByPlatform, userType]);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      if (refreshConnectedAccounts) {
        setAccounts(await refreshConnectedAccounts());
      } else {
        setAccounts(await getSocialAccounts());
      }
    } catch (error) {
      setToast?.({ message: error.message || "Unable to load connected accounts.", error: true });
    } finally {
      setLoadingAccounts(false);
    }
  }, [refreshConnectedAccounts, setToast]);

  const finishConnectQueue = useCallback(
    (queue, statusMap) => {
      const connectedCount = queue.filter((platform) => statusMap[platform] === "connected").length;
      clearConnectQueue();
      setProcessingPlatform("");
      if (connectedCount > 0) {
        setOauthBanner({
          type: "success",
          message:
            connectedCount === 1
              ? "Channel linked successfully."
              : `${connectedCount} channels linked successfully.`,
        });
      }
    },
    []
  );

  const connectPlatform = useCallback(
    async (platform, options = {}) => {
      const flow = options.flow || oauthFlow;
      const fromQueue = Boolean(options.fromQueue);

      if (isPlatformConnectTemporarilyDisabled(platform)) {
        setToast?.({ message: "Connecting to this platform is temporarily unavailable.", error: true });
        if (fromQueue) clearConnectQueue();
        return false;
      }

      setProcessingPlatform(platform);
      try {
        if (PLATFORM_CAPABILITY_MATRIX[platform]?.oauth === false) {
          await manualConnectSocial(platform);
          await loadAccounts();
          if (!fromQueue) {
            setToast?.({ message: `${platform} connected via manual bot setup.` });
          }
          return true;
        }

        const data = await startSocialConnect(platform, { flow });
        window.location.href = data.url;
        return true;
      } catch (error) {
        setToast?.({ message: error.message || `Failed to connect ${platform}.`, error: true });
        if (fromQueue) clearConnectQueue();
        return false;
      } finally {
        if (!fromQueue || PLATFORM_CAPABILITY_MATRIX[platform]?.oauth === false) {
          setProcessingPlatform("");
        }
      }
    },
    [loadAccounts, oauthFlow, setToast]
  );

  const advanceConnectQueue = useCallback(
    async (queue, statusMap, flow) => {
      if (advancingQueueRef.current) return;
      advancingQueueRef.current = true;

      try {
        const nextPlatform = getNextPendingPlatform(queue, statusMap);
        if (!nextPlatform) {
          finishConnectQueue(queue, statusMap);
          return;
        }

        const doneCount = queue.filter((platform) => statusMap[platform] === "connected").length;
        setOauthBanner({
          type: "success",
          message: `Linking ${nextPlatform} (${doneCount + 1} of ${queue.length})…`,
        });

        const nextStatusMap = { ...statusMap, [nextPlatform]: "processing" };
        saveConnectQueue(queue, nextStatusMap, flow);

        const ok = await connectPlatform(nextPlatform, { flow, fromQueue: true });
        if (!ok) {
          setProcessingPlatform("");
        } else if (PLATFORM_CAPABILITY_MATRIX[nextPlatform]?.oauth === false) {
          const connectedStatusMap = { ...nextStatusMap, [nextPlatform]: "connected" };
          saveConnectQueue(queue, connectedStatusMap, flow);
          await advanceConnectQueue(queue, connectedStatusMap, flow);
        }
      } finally {
        advancingQueueRef.current = false;
      }
    },
    [connectPlatform, finishConnectQueue]
  );

  const startConnectQueue = useCallback(
    async (platformKeys, flow = oauthFlow) => {
      const queue = platformKeys.filter((key) => !isPlatformConnectTemporarilyDisabled(key));
      if (!queue.length) {
        setToast?.({ message: "No channels available to connect.", error: true });
        return;
      }

      const statusMap = queue.reduce((acc, platform) => {
        acc[platform] = "pending";
        return acc;
      }, {});

      saveConnectQueue(queue, statusMap, flow);
      await advanceConnectQueue(queue, statusMap, flow);
    },
    [accountsByPlatform, advanceConnectQueue, oauthFlow, setToast]
  );

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    stripOAuthRedirectFragment();
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("social_platform");
    const status = params.get("social_status");
    const reason = params.get("reason");
    const oauthDetail = params.get("oauth_detail");
    const oauthRedirectUri = params.get("oauth_redirect_uri");
    if (!platform || !status) return;

    const { queue, statusMap, flow } = loadConnectQueue();
    const inQueue = queue.includes(platform);

    if (status === "connected") {
      setToast?.({ message: `${platform} connected successfully.` });
      if (!inQueue) {
        setOauthBanner({ type: "success", message: `${platform} account connected.` });
      }
      onOAuthSuccess?.(platform);

      void (async () => {
        await loadAccounts();
        if (refreshConnectedAccounts) await refreshConnectedAccounts();

        if (inQueue) {
          const nextStatusMap = { ...statusMap, [platform]: "connected" };
          saveConnectQueue(queue, nextStatusMap, flow);
          setProcessingPlatform("");
          await advanceConnectQueue(queue, nextStatusMap, flow);
        }
      })();
    } else {
      const message = getSocialOAuthErrorMessage(reason, platform, oauthDetail, oauthRedirectUri);
      setToast?.({ message, error: true });
      setOauthBanner({ type: "error", message });
      if (inQueue) {
        clearConnectQueue();
        setProcessingPlatform("");
      }
    }

    params.delete("social_platform");
    params.delete("social_status");
    params.delete("reason");
    params.delete("oauth_detail");
    params.delete("oauth_redirect_uri");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`
    );
  }, [advanceConnectQueue, loadAccounts, onOAuthSuccess, refreshConnectedAccounts, setToast]);

  const reconnectPlatform = async (platform) => {
    if (isPlatformConnectTemporarilyDisabled(platform)) {
      setToast?.({ message: "Reconnect is temporarily unavailable for this platform.", error: true });
      return;
    }
    setProcessingPlatform(platform);
    try {
      const result = await refreshSocial(platform);
      if (result.refreshed) {
        setToast?.({ message: `${platform} token refreshed.` });
        await loadAccounts();
      } else {
        await connectPlatform(platform);
      }
    } catch {
      await connectPlatform(platform);
    } finally {
      setProcessingPlatform("");
    }
  };

  const disconnectPlatform = async () => {
    const platform = disconnectDialog.platform;
    const accountId = disconnectDialog.accountId;
    setProcessingPlatform(platform);
    const current = [...accounts];
    try {
      if (accountId) {
        await disconnectSocialAccount(platform, accountId);
        setToast?.({ message: `${platform} account disconnected.` });
      } else {
        setAccounts((prev) =>
          prev.map((item) => (item.platform === platform ? { ...item, isConnected: false } : item))
        );
        await disconnectSocial(platform);
        setToast?.({ message: `${platform} disconnected.` });
      }
      await loadAccounts();
    } catch (error) {
      setAccounts(current);
      setToast?.({ message: error.message || `Failed to disconnect ${platform}.`, error: true });
    } finally {
      setDisconnectDialog({ open: false, platform: "", accountId: "" });
      setProcessingPlatform("");
    }
  };

  return {
    accounts: visibleAccounts,
    accountsByPlatform,
    availablePlatforms,
    temporarilyDisabledPlatforms,
    summary,
    loadingAccounts,
    processingPlatform,
    disconnectDialog,
    setDisconnectDialog,
    oauthBanner,
    loadAccounts,
    connectPlatform,
    startConnectQueue,
    reconnectPlatform,
    disconnectPlatform,
  };
}
