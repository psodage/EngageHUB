import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { AUTH_FEEDBACK_REDIRECT_MS } from "../auth/authFeedbackConstants";
import { useApp } from "../../context/AppContext";
import { createEmptyChannelDraft } from "../../data/platformComposerConfig";
import {
  getSharedCaptionLimit,
  getSharedFromDrafts,
  syncSharedToAllDrafts,
} from "../../utils/sharedPostSync";
import { getCreatePostChannelLabel } from "../../utils/createPostChannels";
import { publishToAllChannelsWithProgress, CHANNEL_PUBLISH_STATUS } from "../../utils/multiChannelPublish";
import { selectionNeedsRemoteMediaIngest } from "../../utils/channelMediaHosting";
import { importRemoteMediaAsFile, isAppHostedMediaUrl } from "../../utils/importRemoteMediaFile";
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
  channelOptions = [],
  drafts,
  onSetDrafts,
  onBack,
  onPublishSuccess,
}) {
  const { setToast, showAuthFeedback, refreshConnectedAccounts } = useApp();
  const publishSuccessTimerRef = useRef(null);
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
  const [importingRemoteMedia, setImportingRemoteMedia] = useState(false);
  const remoteMediaImportRef = useRef(0);

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

  useEffect(
    () => () => {
      if (publishSuccessTimerRef.current) {
        clearTimeout(publishSuccessTimerRef.current);
      }
    },
    []
  );

  const previewChannelKeys = activePreviewChannelKey ? [activePreviewChannelKey] : [];
  const ideasPlatformKey =
    activePreviewChannelKey?.split(":")[0] || selectedChannelKeys[0]?.split(":")[0] || "";

  const sharedMediaUrl = useMemo(
    () => getSharedFromDrafts(selectedChannelKeys, drafts).mediaUrl,
    [selectedChannelKeys, drafts, channelKeysKey]
  );

  const needsRemoteMediaImport = useMemo(
    () => selectionNeedsRemoteMediaIngest(selectedChannelKeys, { file: sharedFile, mediaUrl: sharedMediaUrl }),
    [selectedChannelKeys, sharedFile, sharedMediaUrl, channelKeysKey]
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

  useEffect(() => {
    if (!needsRemoteMediaImport || sharedFile) return;
    const url = (sharedMediaUrl || "").trim();
    if (!url || isAppHostedMediaUrl(url)) return;

    const importId = ++remoteMediaImportRef.current;
    setImportingRemoteMedia(true);

    (async () => {
      try {
        const mediaFile = await importRemoteMediaAsFile(url);
        if (importId !== remoteMediaImportRef.current) return;
        pushSharedToDrafts({ file: mediaFile, mediaUrl: "" });
        setSharedFile(mediaFile);
      } catch (err) {
        if (importId !== remoteMediaImportRef.current) return;
        setToast({
          message:
            err?.message ||
            "Could not import this image. Upload from your device or pick another preview image.",
          error: true,
        });
      } finally {
        if (importId === remoteMediaImportRef.current) {
          setImportingRemoteMedia(false);
        }
      }
    })();

    return () => {
      remoteMediaImportRef.current += 1;
    };
  }, [needsRemoteMediaImport, sharedMediaUrl, sharedFile, channelKeysKey]);

  const submitLabel = useMemo(() => {
    const n = selectedChannelKeys.length;
    return `Post to ${n} channel${n === 1 ? "" : "s"}`;
  }, [selectedChannelKeys.length]);

  const handleSubmit = async () => {
    if (importingRemoteMedia) {
      setToast({ message: "Wait for image import to finish.", error: true });
      return;
    }
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
          connectedByChannel: connectedByPlatform,
          channelOptions,
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
          .map(({ platformKey }) => getCreatePostChannelLabel(platformKey, channelOptions))
          .join(", ");
        const allSucceeded = ok.length === selectedChannelKeys.length;
        const successMessage = allSucceeded
          ? `Posted to all ${ok.length} channel(s): ${labels}.`
          : `Posted to ${ok.length} channel(s): ${labels}.`;

        try {
          await refreshConnectedAccounts();
        } catch {
          /* non-fatal */
        }

        if (allSucceeded && onPublishSuccess) {
          if (publishSuccessTimerRef.current) {
            clearTimeout(publishSuccessTimerRef.current);
          }
          showAuthFeedback({ message: successMessage, redirecting: true });
          publishSuccessTimerRef.current = setTimeout(() => {
            showAuthFeedback(null);
            onPublishSuccess();
          }, AUTH_FEEDBACK_REDIRECT_MS);
        } else {
          setToast({ message: successMessage });
          const cleared = {};
          selectedChannelKeys.forEach((key) => {
            cleared[key] = createEmptyChannelDraft(key);
          });
          onSetDrafts(cleared);
        }
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
    : null;

  return (
    <section className={isFullscreen ? cardShell : WORKSPACE_SHELL}>
      <article className={WORKSPACE_CARD}>
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
              linkedInMediaImporting={importingRemoteMedia}
              onCaptionChange={handleCaptionChange}
              onFileChange={handleFileChange}
              onSuggestedImageSelect={handleSuggestedImageSelect}
              onClearSuggestedMedia={handleClearSuggestedMedia}
            />

            {isPublishingOrDone ? (
              <div className="border-t border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/30">
                <ChannelPublishProgress
                  selectedChannelKeys={selectedChannelKeys}
                  channelOptions={channelOptions}
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
            disabled={publishing || importingRemoteMedia || !hasContent}
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
