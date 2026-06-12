import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSocialAccounts } from "../services/socialApi";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { createEmptyChannelDraft } from "../data/platformComposerConfig";
import ChannelPickerStep from "../components/create-post/ChannelPickerStep";
import SchedulePostWorkspace from "../components/create-post/SchedulePostWorkspace";
import {
  buildConnectedByChannelKey,
  mapAccountsToCreatePostChannelOptions,
  parseCreatePostChannelKey,
} from "../utils/createPostChannels";

export default function SchedulePostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [step, setStep] = useState("pick");
  const [selectedChannelKeys, setSelectedChannelKeys] = useState([]);
  const [drafts, setDrafts] = useState({});

  const scopedPlatformKey = useMemo(() => {
    const raw = searchParams.get("platform")?.trim() || "";
    if (!raw) return null;
    return SOCIAL_PLATFORM_CONFIGS.some((c) => c.key === raw) ? raw : null;
  }, [searchParams]);

  const scopedEntityId = useMemo(() => searchParams.get("entity")?.trim() || "", [searchParams]);

  useEffect(() => {
    getSocialAccounts()
      .then(setConnectedAccounts)
      .catch(() => setConnectedAccounts([]));
  }, []);

  const connectedByPlatform = useMemo(
    () => connectedAccounts.reduce((acc, item) => ({ ...acc, [item.platform]: item }), {}),
    [connectedAccounts]
  );

  const channelOptions = useMemo(
    () => mapAccountsToCreatePostChannelOptions(connectedAccounts),
    [connectedAccounts]
  );

  const connectedByChannel = useMemo(
    () => buildConnectedByChannelKey(connectedAccounts),
    [connectedAccounts]
  );

  useEffect(() => {
    if (!scopedPlatformKey) return;
    if (!connectedByPlatform[scopedPlatformKey]?.isConnected) return;

    let keys = [scopedPlatformKey];

    if (scopedPlatformKey === "facebook") {
      if (!scopedEntityId) return;
      const platformChannelKeys = channelOptions
        .filter((o) => o.platformKey === "facebook")
        .map((o) => o.key);
      const match = platformChannelKeys.find(
        (key) => parseCreatePostChannelKey(key).entityId === scopedEntityId
      );
      if (!match) return;
      keys = [match];
    }

    setSelectedChannelKeys(keys);
    const nextDrafts = {};
    keys.forEach((key) => {
      nextDrafts[key] = createEmptyChannelDraft(key);
    });
    setDrafts(nextDrafts);
    setStep("compose");
  }, [scopedPlatformKey, scopedEntityId, connectedByPlatform, channelOptions]);

  const toggleChannel = useCallback((key) => {
    setSelectedChannelKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelKeys(channelOptions.map((c) => c.key));
  }, [channelOptions]);

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
    if (step === "compose") {
      setStep("pick");
      return;
    }
    navigate("/schedule");
  }, [scopedPlatformKey, scopedEntityId, step, navigate]);

  useEffect(() => {
    if (step === "compose" && selectedChannelKeys.length === 0) {
      setStep("pick");
    }
  }, [step, selectedChannelKeys.length]);

  const isComposeStep = step === "compose" && selectedChannelKeys.length > 0;

  let content;
  if (!channelOptions.length) {
    content = (
      <section className="buffer-card mx-auto max-w-lg p-6">
        <p className="font-semibold text-slate-900 dark:text-white">No connected platforms</p>
        <p className="mt-1 text-sm text-slate-500">Connect at least one channel to schedule posts.</p>
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
      <SchedulePostWorkspace
        selectedChannelKeys={selectedChannelKeys}
        connectedByPlatform={connectedByChannel}
        drafts={drafts}
        onSetDrafts={onSetDrafts}
        onBack={handleBack}
      />
    );
  } else {
    content = (
      <ChannelPickerStep
        title="Schedule post"
        subtitle="Select channels, add your content, and choose when it goes live."
        maxWidthClass={selectedChannelKeys.length ? "max-w-[88rem]" : "max-w-4xl"}
        connectedPlatformConfigs={channelOptions}
        selectedKeys={selectedChannelKeys}
        onToggle={toggleChannel}
        onSelectAll={selectAllChannels}
        onClearAll={clearAllChannels}
        onContinue={startCompose}
        continueLabel="Continue to schedule"
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
