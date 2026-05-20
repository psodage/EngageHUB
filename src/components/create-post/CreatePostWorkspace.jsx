import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import { createEmptyChannelDraft } from "../../data/platformComposerConfig";
import {
  getSharedCaptionLimit,
  getSharedFromDrafts,
  syncSharedToAllDrafts,
} from "../../utils/sharedPostSync";
import { publishToAllChannelsWithProgress, CHANNEL_PUBLISH_STATUS } from "../../utils/multiChannelPublish";
import CreatePostWorkspaceHeader from "./CreatePostWorkspaceHeader";
import ChannelPreviewPanel from "./ChannelPreviewPanel";
import ChannelPublishProgress from "./ChannelPublishProgress";
import PreviewIdeasBoard from "./PreviewIdeasBoard";
import SharedPostComposer from "./SharedPostComposer";
import {
  WORKSPACE_CARD,
  WORKSPACE_COMPOSER_COLUMN,
  WORKSPACE_COMPOSER_SCROLL,
  WORKSPACE_FOOTER,
  WORKSPACE_GRID,
  WORKSPACE_PREVIEW_ASIDE,
  WORKSPACE_SHELL,
} from "./workspaceLayout";

export default function CreatePostWorkspace({
  selectedChannelKeys,
  connectedByPlatform,
  drafts,
  onSetDrafts,
  onBack,
}) {
  const { setToast, refreshConnectedAccounts } = useApp();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sharedCaption, setSharedCaption] = useState("");
  const [sharedFile, setSharedFile] = useState(null);
  const [ideaTopic, setIdeaTopic] = useState("");
  const [channelStatuses, setChannelStatuses] = useState({});
  const [channelErrors, setChannelErrors] = useState({});
  const [previewPanelMode, setPreviewPanelMode] = useState("previews");
  const [activePreviewChannelKey, setActivePreviewChannelKey] = useState(
    () => selectedChannelKeys[0] || ""
  );

  const captionLimit = getSharedCaptionLimit(selectedChannelKeys);
  const channelKeysKey = selectedChannelKeys.join(",");
  const isPublishingOrDone = publishing || Object.keys(channelStatuses).length > 0;

  useEffect(() => {
    if (!selectedChannelKeys.length) return;
    const shared = getSharedFromDrafts(selectedChannelKeys, drafts);
    setSharedCaption(shared.caption);
    setSharedFile(shared.file);
  }, [channelKeysKey]);

  useEffect(() => {
    if (!selectedChannelKeys.length) return;
    if (!selectedChannelKeys.includes(activePreviewChannelKey)) {
      setActivePreviewChannelKey(selectedChannelKeys[0]);
    }
  }, [channelKeysKey, activePreviewChannelKey, selectedChannelKeys]);

  const previewChannelKeys = activePreviewChannelKey ? [activePreviewChannelKey] : [];
  const ideasPlatformKey = activePreviewChannelKey || selectedChannelKeys[0] || "";

  const sharedMediaUrl = useMemo(
    () => getSharedFromDrafts(selectedChannelKeys, drafts).mediaUrl,
    [selectedChannelKeys, drafts, channelKeysKey]
  );

  const pushSharedToDrafts = (patch) => {
    const current = getSharedFromDrafts(selectedChannelKeys, drafts);
    const shared = {
      caption: patch.caption !== undefined ? patch.caption : sharedCaption,
      file: patch.file !== undefined ? patch.file : sharedFile,
      mediaUrl: patch.mediaUrl !== undefined ? patch.mediaUrl : current.mediaUrl,
    };
    if (patch.caption !== undefined) setSharedCaption(shared.caption);
    if (patch.file !== undefined) setSharedFile(shared.file);
    onSetDrafts(syncSharedToAllDrafts(selectedChannelKeys, shared));
  };

  const handleCaptionChange = (value) => {
    pushSharedToDrafts({ caption: value.slice(0, captionLimit) });
  };

  const handleFileChange = (file) => {
    pushSharedToDrafts(file ? { file, mediaUrl: "" } : { file: null });
  };

  const handleSuggestedImageSelect = (url) => {
    pushSharedToDrafts({ mediaUrl: url, file: null });
    setSharedFile(null);
  };

  const handleClearSuggestedMedia = () => {
    pushSharedToDrafts({ mediaUrl: "" });
  };

  const applyCaption = (text) => {
    handleCaptionChange(text || "");
  };

  const hasContent = useMemo(
    () =>
      Boolean(
        sharedCaption.trim() ||
          sharedFile ||
          selectedChannelKeys.some((k) => drafts[k]?.caption?.trim() || drafts[k]?.file || drafts[k]?.mediaUrl)
      ),
    [sharedCaption, sharedFile, selectedChannelKeys, drafts]
  );

  const submitLabel = useMemo(() => {
    const n = selectedChannelKeys.length;
    return `Post to ${n} channel${n === 1 ? "" : "s"}`;
  }, [selectedChannelKeys.length]);

  const handleSubmit = async () => {
    if (!hasContent) {
      setToast({ message: "Add a caption or media before posting.", error: true });
      return;
    }

    const shared = getSharedFromDrafts(selectedChannelKeys, drafts);
    const caption = sharedCaption.trim() || shared.caption.trim();
    const file = sharedFile || shared.file;
    const payload = { caption, file, mediaUrl: shared.mediaUrl || "" };
    const synced = syncSharedToAllDrafts(selectedChannelKeys, payload);
    onSetDrafts(synced);

    setPublishing(true);
    setChannelErrors({});
    setChannelStatuses(
      Object.fromEntries(selectedChannelKeys.map((k) => [k, CHANNEL_PUBLISH_STATUS.pending]))
    );

    try {
      const { ok, failed, statuses } = await publishToAllChannelsWithProgress(
        selectedChannelKeys,
        payload,
        {
          connectedByPlatform,
          onStatusChange: (next, detail) => {
            setChannelStatuses({ ...next });
            if (detail?.error && detail.platformKey) {
              setChannelErrors((prev) => ({ ...prev, [detail.platformKey]: detail.error }));
            }
          },
        }
      );

      setChannelStatuses(statuses);

      if (ok.length) {
        setSharedCaption("");
        setSharedFile(null);
        const labels = ok
          .map(({ platformKey }) => SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey)?.label || platformKey)
          .join(", ");
        setToast({
          message:
            ok.length === selectedChannelKeys.length
              ? `Posted to all ${ok.length} channel(s): ${labels}.`
              : `Posted to ${ok.length} channel(s): ${labels}.`,
        });
        try {
          await refreshConnectedAccounts();
        } catch {
          /* non-fatal */
        }
        const cleared = {};
        selectedChannelKeys.forEach((key) => {
          cleared[key] = createEmptyChannelDraft(key);
        });
        onSetDrafts(cleared);
      }

      if (failed.length && !ok.length) {
        setToast({ message: "Could not post to any channel. See progress below.", error: true });
      } else if (failed.length) {
        setToast({ message: `${failed.length} channel(s) failed. See progress below.`, error: true });
      }
    } catch (err) {
      setToast({ message: err?.message || "Publish failed.", error: true });
    } finally {
      setPublishing(false);
    }
  };

  const cardShell = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100 p-4 dark:bg-slate-950 md:p-6"
    : WORKSPACE_SHELL;

  const workspaceCardClass = isFullscreen
    ? "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
    : WORKSPACE_CARD;

  return (
    <section className={cardShell}>
      <article className={workspaceCardClass}>
        <CreatePostWorkspaceHeader
          title="Create post"
          selectedChannelKeys={selectedChannelKeys}
          connectedByPlatform={connectedByPlatform}
          onBack={onBack}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((v) => !v)}
          previewPanelMode={previewPanelMode}
          activePreviewChannelKey={activePreviewChannelKey}
          onSelectPreviewChannel={setActivePreviewChannelKey}
          onTemplatesClick={() => setPreviewPanelMode("templates")}
          onAiAssistantClick={() => setPreviewPanelMode("ai")}
          onPreviewClick={() => setPreviewPanelMode("previews")}
        />

        <div className={WORKSPACE_GRID}>
          <div className={WORKSPACE_COMPOSER_COLUMN}>
            <div className={WORKSPACE_COMPOSER_SCROLL}>
            <SharedPostComposer
              caption={sharedCaption}
              file={sharedFile}
              mediaUrl={sharedMediaUrl}
              captionLimit={captionLimit}
              onCaptionChange={handleCaptionChange}
              onFileChange={handleFileChange}
              onSuggestedImageSelect={handleSuggestedImageSelect}
              onClearSuggestedMedia={handleClearSuggestedMedia}
            />

            {isPublishingOrDone ? (
              <div className="border-t border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/30">
                <ChannelPublishProgress
                  selectedChannelKeys={selectedChannelKeys}
                  channelStatuses={channelStatuses}
                  errors={channelErrors}
                />
              </div>
            ) : null}
            </div>
          </div>

          <aside className={WORKSPACE_PREVIEW_ASIDE}>
            {previewPanelMode === "previews" ? (
              <ChannelPreviewPanel
                selectedChannelKeys={previewChannelKeys}
                connectedByPlatform={connectedByPlatform}
                sharedCaption={sharedCaption}
                sharedFile={sharedFile}
                drafts={drafts}
                channelStatuses={channelStatuses}
                className="h-full min-h-0"
              />
            ) : (
              <PreviewIdeasBoard
                focus={previewPanelMode}
                caption={sharedCaption}
                onApplyCaption={applyCaption}
                selectedPlatform={ideasPlatformKey}
                topic={ideaTopic}
                onTopicChange={setIdeaTopic}
                onClose={() => setPreviewPanelMode("previews")}
                onApplied={() => setPreviewPanelMode("previews")}
              />
            )}
          </aside>
        </div>

        <footer className={WORKSPACE_FOOTER}>
          <p className="text-sm text-slate-500">
            Post goes live immediately on all selected channels.
          </p>
          <button
            type="button"
            disabled={publishing || !hasContent}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            {publishing ? "Posting…" : submitLabel}
          </button>
        </footer>
      </article>
    </section>
  );
}
