import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CalendarDays } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  getSharedCaptionLimit,
  getSharedFromDrafts,
  syncSharedToAllDrafts,
} from "../../utils/sharedPostSync";
import { uploadSocialPublicMediaFile } from "../../services/socialApi";
import { createScheduledPost } from "../../services/scheduleApi";
import CreatePostWorkspaceHeader from "./CreatePostWorkspaceHeader";
import PreviewIdeasBoard from "./PreviewIdeasBoard";
import ChannelPreviewPanel from "./ChannelPreviewPanel";
import SchedulePostOptions from "./SchedulePostOptions";
import SharedPostComposer from "./SharedPostComposer";
import {
  defaultScheduleDateTime,
  parseLocalDateTime,
} from "../../utils/scheduleDateTime";
import {
  WORKSPACE_CARD,
  WORKSPACE_COMPOSER_COLUMN,
  WORKSPACE_COMPOSER_SCROLL,
  WORKSPACE_FOOTER,
  WORKSPACE_GRID,
  WORKSPACE_PREVIEW_ASIDE,
  WORKSPACE_SHELL,
} from "./workspaceLayout";

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export default function SchedulePostWorkspace({
  selectedChannelKeys,
  connectedByPlatform,
  drafts,
  onSetDrafts,
  onBack,
}) {
  const navigate = useNavigate();
  const { setToast } = useApp();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleDateTime);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [sharedCaption, setSharedCaption] = useState("");
  const [sharedFile, setSharedFile] = useState(null);
  const [previewPanelMode, setPreviewPanelMode] = useState("previews");
  const [ideaTopic, setIdeaTopic] = useState("");
  const [activePreviewChannelKey, setActivePreviewChannelKey] = useState(
    () => selectedChannelKeys[0] || ""
  );

  const captionLimit = getSharedCaptionLimit(selectedChannelKeys);
  const channelKeysKey = selectedChannelKeys.join(",");

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
  const ideasPlatformKey =
    activePreviewChannelKey?.split(":")[0] || selectedChannelKeys[0]?.split(":")[0] || "";

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
    return `Schedule for ${n} channel${n === 1 ? "" : "s"}`;
  }, [selectedChannelKeys.length]);

  const handleSubmit = async () => {
    if (!hasContent) {
      setToast({ message: "Add a caption or media before scheduling.", error: true });
      return;
    }
    if (!scheduledAt) {
      setToast({ message: "Choose a date and time to schedule.", error: true });
      return;
    }
    const scheduledDate = parseLocalDateTime(scheduledAt);
    if (!scheduledDate || scheduledDate.getTime() <= Date.now()) {
      setToast({ message: "Pick a date and time in the future.", error: true });
      return;
    }

    const shared = getSharedFromDrafts(selectedChannelKeys, drafts);
    const caption = sharedCaption.trim() || shared.caption.trim();
    const file = sharedFile || shared.file;
    const synced = syncSharedToAllDrafts(selectedChannelKeys, { caption, file, mediaUrl: shared.mediaUrl });
    onSetDrafts(synced);

    setScheduling(true);
    try {
      let mediaUrl = shared.mediaUrl || "";
      if (file) {
        mediaUrl = await uploadSocialPublicMediaFile(file);
        if (!mediaUrl) throw new Error("Media upload failed.");
      }

      await createScheduledPost({
        title: scheduleTitle.trim() || caption.slice(0, 80) || "Scheduled post",
        caption,
        mediaUrl,
        channelKeys: selectedChannelKeys,
        drafts: synced,
        scheduledAt: scheduledDate.toISOString(),
        timezone,
      });

      setToast({
        message: `Scheduled for ${selectedChannelKeys.length} channel(s).`,
      });
      setSharedCaption("");
      setSharedFile(null);
      navigate("/schedule");
    } catch (err) {
      setToast({ message: err?.message || "Scheduling failed.", error: true });
    } finally {
      setScheduling(false);
    }
  };

  const applyCaption = (text) => {
    handleCaptionChange(text || "");
  };

  const cardShell = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100 p-4 dark:bg-slate-950 md:p-6"
    : null;

  return (
    <section className={isFullscreen ? cardShell : WORKSPACE_SHELL}>
      <article className={WORKSPACE_CARD}>
        <CreatePostWorkspaceHeader
          title="Schedule post"
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

            <div id="workspace-schedule-options" className="border-t border-slate-100 p-5 dark:border-slate-800">
              <SchedulePostOptions
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                timezone={timezone}
                onTimezoneChange={setTimezone}
                scheduleTitle={scheduleTitle}
                onScheduleTitleChange={setScheduleTitle}
                selectedChannelKeys={selectedChannelKeys}
                caption={sharedCaption}
                disabled={scheduling}
              />
            </div>
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

        <footer className={`${WORKSPACE_FOOTER} flex-wrap`}>
          <button
            type="button"
            onClick={() => navigate("/schedule")}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <CalendarDays size={16} />
            View scheduled queue
          </button>
          <button
            type="button"
            disabled={scheduling || !hasContent || !scheduledAt}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarClock size={16} />
            {scheduling ? "Scheduling…" : submitLabel}
          </button>
        </footer>
      </article>
    </section>
  );
}
