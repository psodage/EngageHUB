from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/components/create-post/CreatePostWorkspace.jsx"

content = '''import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, CalendarDays, Eye, Maximize2, Minimize2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { syncSharedToAllDrafts, getSharedCaptionLimit } from "../../utils/sharedPostSync";
import { uploadSocialPublicMediaFile } from "../../services/socialApi";
import { createScheduledPost } from "../../services/scheduleApi";
import ChannelPreviewPanel from "./ChannelPreviewPanel";
import SchedulePostOptions from "./SchedulePostOptions";
import SharedPostComposer from "./SharedPostComposer";

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function defaultScheduleDateTime() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T09:00`;
}

export default function CreatePostWorkspace({
  selectedChannelKeys,
  previewChannelKey,
  onPreviewChannelChange,
  connectedByPlatform,
  drafts,
  onSetDrafts,
  onBack,
}) {
  const navigate = useNavigate();
  const { setToast } = useApp();
  const initialPreview =
    previewChannelKey && selectedChannelKeys.includes(previewChannelKey)
      ? previewChannelKey
      : selectedChannelKeys[0] || "";
  const [activeChannel, setActiveChannel] = useState(initialPreview);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleDateTime);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [sharedCaption, setSharedCaption] = useState("");
  const [sharedFile, setSharedFile] = useState(null);

  const captionLimit = getSharedCaptionLimit(selectedChannelKeys);

  useEffect(() => {
    if (!selectedChannelKeys.length) return;
    if (selectedChannelKeys.includes(activeChannel)) return;
    const next = selectedChannelKeys[0];
    setActiveChannel(next);
    onPreviewChannelChange?.(next);
  }, [selectedChannelKeys, activeChannel, onPreviewChannelChange]);

  const setPreviewChannel = (key) => {
    setActiveChannel(key);
    onPreviewChannelChange?.(key);
  };

  const submitLabel = useMemo(() => {
    const n = selectedChannelKeys.length;
    return `Schedule for ${n} channel${n === 1 ? "" : "s"}`;
  }, [selectedChannelKeys.length]);

  const handleSubmit = async () => {
    if (!sharedCaption.trim() && !sharedFile) {
      setToast({ message: "Add a caption or media before scheduling.", error: true });
      return;
    }

    if (!scheduledAt) {
      setToast({ message: "Choose a date and time to schedule.", error: true });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setToast({ message: "Pick a date and time in the future.", error: true });
      return;
    }

    const shared = { caption: sharedCaption, file: sharedFile, mediaUrl: "" };
    const synced = syncSharedToAllDrafts(selectedChannelKeys, shared);
    onSetDrafts(synced);

    setScheduling(true);
    try {
      let mediaUrl = "";
      if (sharedFile) {
        mediaUrl = await uploadSocialPublicMediaFile(sharedFile);
        if (!mediaUrl) throw new Error("Media upload failed.");
      }

      await createScheduledPost({
        title: scheduleTitle.trim() || sharedCaption.slice(0, 80) || "Scheduled post",
        caption: sharedCaption,
        mediaUrl,
        channelKeys: selectedChannelKeys,
        drafts: synced,
        scheduledAt: scheduledDate.toISOString(),
        timezone,
      });

      setToast({
        message: `Scheduled for ${selectedChannelKeys.length} channel(s). View them in Queue.`,
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

  const cardShell = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100 p-4 dark:bg-slate-950 md:p-6"
    : "mx-auto flex max-w-6xl flex-col";

  return (
    <section className={cardShell}>
      <article className="flex min-h-[min(720px,calc(100vh-10rem))] flex-1 flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Schedule post</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-lg border border-buffer-300 bg-buffer-50 px-3 py-1.5 text-sm font-semibold text-buffer-800 sm:inline-flex dark:border-buffer-500/40 dark:bg-buffer-500/15 dark:text-buffer-200">
              <Eye size={16} />
              Preview
            </span>
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
          <div className="flex min-h-0 flex-col overflow-y-auto border-r border-slate-200 dark:border-slate-700">
            <SharedPostComposer
              caption={sharedCaption}
              file={sharedFile}
              captionLimit={captionLimit}
              selectedChannelKeys={selectedChannelKeys}
              connectedByPlatform={connectedByPlatform}
              activeChannelKey={activeChannel}
              onChannelClick={setPreviewChannel}
              onCaptionChange={setSharedCaption}
              onFileChange={setSharedFile}
            />

            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
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

          <aside className="flex min-h-[420px] flex-col overflow-y-auto bg-slate-50/80 p-5 dark:bg-slate-950/50 lg:min-h-0">
            <ChannelPreviewPanel
              selectedChannelKeys={selectedChannelKeys}
              previewChannelKey={activeChannel}
              onPreviewChannelChange={setPreviewChannel}
              connectedByPlatform={connectedByPlatform}
              sharedCaption={sharedCaption}
              sharedFile={sharedFile}
              drafts={drafts}
              className="h-full"
            />
          </aside>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
          <motion className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate("/schedule")}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <CalendarDays size={16} />
              View queue
            </button>
            {scheduledAt ? (
              <p className="mt-1 truncate text-xs text-slate-500">
                Queued for {new Date(scheduledAt).toLocaleString()}
              </p>
            ) : null}
          </motion>
          <button
            type="button"
            disabled={scheduling || (!sharedCaption.trim() && !sharedFile) || !scheduledAt}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarClock size={16} />
            {scheduling ? "Scheduling…" : submitLabel}
          </button>
        </footer>
      </article>
    </section>
  );
}
'''

content = content.replace("<motion", "<div").replace("</motion>", "</div>")

p.write_text(content, encoding="utf-8")
print("wrote", p)
