import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSocialAccounts } from "../services/socialApi";
import { SOCIAL_PLATFORM_CONFIGS, PLATFORMS_BY_USER_TYPE } from "../data/socialPlatforms";
import { createEmptyChannelDraft } from "../data/platformComposerConfig";
import { useApp } from "../context/AppContext";
import ChannelPickerStep from "../components/create-post/ChannelPickerStep";
import CreatePostWorkspace from "../components/create-post/CreatePostWorkspace";
import {
  buildConnectedByChannelKey,
  mapAccountsToCreatePostChannelOptions,
  parseCreatePostChannelKey,
} from "../utils/createPostChannels";
import { resolveFacebookPageCreatePostPath } from "../utils/createPostChannels";

export default function CreatePostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [step, setStep] = useState("pick");
  const [selectedChannelKeys, setSelectedChannelKeys] = useState([]);
  const [drafts, setDrafts] = useState({});
  const { user } = useApp();
  const userType = user?.userType || "business";

  const scopedPlatformKey = useMemo(() => {
    const raw = searchParams.get("platform")?.trim() || "";
    if (!raw) return null;
    return SOCIAL_PLATFORM_CONFIGS.some((c) => c.key === raw) ? raw : null;
  }, [searchParams]);

  const scopedEntityId = useMemo(
    () => searchParams.get("entity")?.trim() || searchParams.get("entityId")?.trim() || "",
    [searchParams]
  );

  useEffect(() => {
    getSocialAccounts()
      .then(setConnectedAccounts)
      .catch(() => setConnectedAccounts([]));
  }, []);

  const filteredConnectedAccounts = useMemo(() => {
    const allowedKeys = PLATFORMS_BY_USER_TYPE[userType] || [];
    return connectedAccounts.filter((a) => allowedKeys.includes(a.platform));
  }, [connectedAccounts, userType]);

  const connectedByPlatform = useMemo(
    () => filteredConnectedAccounts.reduce((acc, item) => ({ ...acc, [item.platform]: item }), {}),
    [filteredConnectedAccounts]
  );

  const channelOptions = useMemo(
    () => mapAccountsToCreatePostChannelOptions(filteredConnectedAccounts),
    [filteredConnectedAccounts]
  );

  const connectedByChannel = useMemo(
    () => buildConnectedByChannelKey(filteredConnectedAccounts),
    [filteredConnectedAccounts]
  );

  useEffect(() => {
    if (!scopedPlatformKey) return;
    if (!connectedByPlatform[scopedPlatformKey]?.isConnected) return;

    let keys = [scopedPlatformKey];

    if (scopedPlatformKey === "facebook" || scopedPlatformKey === "linkedin") {
      const platformChannelKeys = channelOptions
        .filter((o) => o.platformKey === scopedPlatformKey)
        .map((o) => o.key);
      if (scopedEntityId) {
        const match = platformChannelKeys.find(
          (key) => parseCreatePostChannelKey(key).entityId === scopedEntityId
        );
        if (!match) return;
        keys = [match];
      } else if (scopedPlatformKey === "linkedin") {
        const profileKey = platformChannelKeys.find(
          (key) => parseCreatePostChannelKey(key).entityType === "profile"
        );
        keys = profileKey ? [profileKey] : platformChannelKeys.slice(0, 1);
      } else if (scopedPlatformKey === "facebook") {
        keys = platformChannelKeys.length ? [platformChannelKeys[0]] : [];
        if (!keys.length) return;
      }
    }

    setSelectedChannelKeys(keys);
    const nextDrafts = {};
    keys.forEach((key) => {
      nextDrafts[key] = createEmptyChannelDraft(key);
    });
    setDrafts(nextDrafts);
    setStep("compose");
  }, [scopedPlatformKey, scopedEntityId, connectedByPlatform, channelOptions]);

  const toggleChannel = useCallback(
    (key) => {
      const option = channelOptions.find((c) => c.key === key);
      if (option?.publishDisabled) return;
      setSelectedChannelKeys((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    },
    [channelOptions]
  );

  const publishableChannelOptions = useMemo(
    () => channelOptions.filter((c) => !c.publishDisabled),
    [channelOptions]
  );

  const selectAllChannels = useCallback(() => {
    setSelectedChannelKeys(publishableChannelOptions.map((c) => c.key));
  }, [publishableChannelOptions]);

  const clearAllChannels = useCallback(() => {
    setSelectedChannelKeys([]);
  }, []);

  const startCompose = useCallback(() => {
    const nextDrafts = {};
    selectedChannelKeys.forEach((key) => {
      nextDrafts[key] = drafts[key] || createEmptyChannelDraft(key);
    });
    setDrafts(nextDrafts);
    setStep("compose");
  }, [selectedChannelKeys, drafts]);

  const onSetDrafts = useCallback((nextDrafts) => {
    setDrafts(nextDrafts);
  }, []);

  const handleBack = useCallback(() => {
    if (scopedPlatformKey) {
      const entity = scopedEntityId ? `?entity=${encodeURIComponent(scopedEntityId)}` : "";
      navigate(`/channels/${scopedPlatformKey}${entity}`);
      return;
    }
    setStep("pick");
  }, [scopedPlatformKey, scopedEntityId, navigate]);

  const handlePublishSuccess = useCallback(() => {
    if (scopedPlatformKey) {
      navigate("/create-post", { replace: true });
    }
    setSelectedChannelKeys([]);
    setDrafts({});
    setStep("pick");
  }, [scopedPlatformKey, navigate]);

  useEffect(() => {
    if (step === "compose" && selectedChannelKeys.length === 0) {
      setStep("pick");
    }
  }, [step, selectedChannelKeys.length]);

  const isComposeStep = step === "compose" && selectedChannelKeys.length > 0;

  let content;
  if (!channelOptions.length) {
    content = (
      <section className="buffer-card mx-auto w-full max-w-lg p-6">
        <p className="font-semibold text-slate-900 dark:text-white">No connected platforms</p>
        <p className="mt-1 text-sm text-slate-500">Connect at least one channel to create posts.</p>
        <button
          type="button"
          onClick={() => navigate("/channels")}
          className="mt-4 rounded-lg bg-buffer-600 px-4 py-2 text-sm font-semibold text-white hover:bg-buffer-700"
        >
          Connect channels
        </button>
      </section>
    );
  } else if (isComposeStep) {
    content = (
      <CreatePostWorkspace
        selectedChannelKeys={selectedChannelKeys}
        connectedByPlatform={connectedByChannel}
        channelOptions={channelOptions}
        drafts={drafts}
        onSetDrafts={onSetDrafts}
        onBack={handleBack}
        onPublishSuccess={handlePublishSuccess}
      />
    );
  } else {
    content = (
      <ChannelPickerStep
        title="Create post"
        subtitle="Select channels, write your post, and publish to all at once."
        connectedPlatformConfigs={channelOptions}
        selectedKeys={selectedChannelKeys}
        onToggle={toggleChannel}
        onSelectAll={selectAllChannels}
        onClearAll={clearAllChannels}
        onContinue={startCompose}
      />
    );
  }

  return (
    <div
      className={`flex min-h-0 w-full flex-1 flex-col ${
        isComposeStep ? "overflow-y-auto lg:overflow-hidden" : "overflow-y-auto overflow-x-hidden overscroll-contain"
      }`}
    >
      {content}
    </div>
  );
}
