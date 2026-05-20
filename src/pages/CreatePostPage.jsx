import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getSocialAccounts } from "../services/socialApi";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { createEmptyChannelDraft } from "../data/platformComposerConfig";
import ChannelPickerStep from "../components/create-post/ChannelPickerStep";
import CreatePostWorkspace from "../components/create-post/CreatePostWorkspace";

export default function CreatePostPage() {
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

  useEffect(() => {
    getSocialAccounts()
      .then(setConnectedAccounts)
      .catch(() => setConnectedAccounts([]));
  }, []);

  const connectedByPlatform = useMemo(
    () => connectedAccounts.reduce((acc, item) => ({ ...acc, [item.platform]: item }), {}),
    [connectedAccounts]
  );

  const connectedPlatformConfigs = useMemo(
    () => SOCIAL_PLATFORM_CONFIGS.filter((c) => connectedByPlatform[c.key]?.isConnected),
    [connectedByPlatform]
  );

  useEffect(() => {
    if (!scopedPlatformKey) return;
    if (!connectedByPlatform[scopedPlatformKey]?.isConnected) return;
    setSelectedChannelKeys([scopedPlatformKey]);
    setDrafts({ [scopedPlatformKey]: createEmptyChannelDraft(scopedPlatformKey) });
    setStep("compose");
  }, [scopedPlatformKey, connectedByPlatform]);

  const toggleChannel = useCallback((key) => {
    setSelectedChannelKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelKeys(connectedPlatformConfigs.map((c) => c.key));
  }, [connectedPlatformConfigs]);

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
      navigate(`/channels/${scopedPlatformKey}`);
      return;
    }
    setStep("pick");
  }, [scopedPlatformKey, navigate]);

  useEffect(() => {
    if (step === "compose" && selectedChannelKeys.length === 0) {
      setStep("pick");
    }
  }, [step, selectedChannelKeys.length]);

  if (!connectedPlatformConfigs.length) {
    return (
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
  }

  if (step === "compose" && selectedChannelKeys.length > 0) {
    return (
      <CreatePostWorkspace
        selectedChannelKeys={selectedChannelKeys}
        connectedByPlatform={connectedByPlatform}
        drafts={drafts}
        onSetDrafts={onSetDrafts}
        onBack={handleBack}
      />
    );
  }

  return (
    <ChannelPickerStep
      title="Create post"
      subtitle="Select channels, write your post, and publish to all at once."
      connectedPlatformConfigs={connectedPlatformConfigs}
      connectedByPlatform={connectedByPlatform}
      selectedKeys={selectedChannelKeys}
      onToggle={toggleChannel}
      onSelectAll={selectAllChannels}
      onClearAll={clearAllChannels}
      onContinue={startCompose}
    />
  );
}
