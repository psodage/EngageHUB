import { useEffect, useMemo, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postYouTubeVideo } from "../../services/socialApi";

const MAX_TITLE = 100;
const MAX_DESC = 5000;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024;

const YOUTUBE_CATEGORIES = [
  { id: "22", label: "People & Blogs" },
  { id: "24", label: "Entertainment" },
  { id: "23", label: "Comedy" },
  { id: "27", label: "Education" },
  { id: "28", label: "Science & Technology" },
  { id: "26", label: "Howto & Style" },
  { id: "25", label: "News & Politics" },
  { id: "10", label: "Music" },
  { id: "20", label: "Gaming" },
  { id: "17", label: "Sports" },
  { id: "19", label: "Travel & Events" },
  { id: "15", label: "Pets & Animals" },
  { id: "2", label: "Autos & Vehicles" },
  { id: "1", label: "Film & Animation" },
  { id: "29", label: "Nonprofits & Activism" },
];

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null | undefined} props.account Grouped YouTube account from AppContext.
 * @param {() => void} [props.onPublishSuccess]
 */
export default function YouTubeCreatePostModal({ open, onClose, account, onPublishSuccess }) {
  const { setToast } = useApp();
  const [channelId, setChannelId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState("22");
  const [privacyStatus, setPrivacyStatus] = useState("private");
  const [madeForKids, setMadeForKids] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const prevOpen = useRef(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const channels = useMemo(() => {
    const entities = Array.isArray(account?.entities) ? account.entities : [];
    const rows = entities
      .filter((e) => e?.platformUserId)
      .map((e) => ({
        id: String(e.platformUserId),
        name: e.accountName || e.username || String(e.platformUserId),
      }));
    if (rows.length) return rows;
    if (account?.platformUserId) {
      return [
        {
          id: String(account.platformUserId),
          name: account.accountName || account.username || String(account.platformUserId),
        },
      ];
    }
    return [];
  }, [account]);

  const multiChannel = channels.length > 1;

  useEffect(() => {
    if (open && !prevOpen.current) {
      setTitle("");
      setDescription("");
      setTags("");
      setCategoryId("22");
      setPrivacyStatus("private");
      setMadeForKids(false);
      setVideoFile(null);
      setFileInputKey((k) => k + 1);
      setErrors({});
      setSubmitError("");
      setUploadProgress(null);
      if (channels.length === 1) {
        setChannelId(channels[0].id);
      } else {
        setChannelId("");
      }
    }
    prevOpen.current = open;
  }, [open, channels]);

  useEffect(() => {
    if (multiChannel || !channels.length) return;
    setChannelId(channels[0].id);
  }, [multiChannel, channels]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const titleLen = title.length;
  const descLen = description.length;

  const validate = () => {
    const next = {};
    if (!channels.length) {
      next.channel = "No YouTube channel is connected.";
    } else if (multiChannel && !channelId) {
      next.channel = "Select a YouTube channel.";
    } else if (channelId && !channels.some((c) => c.id === channelId)) {
      next.channel = "That channel is not available on this connection.";
    }
    if (!videoFile) {
      next.video = "Choose a video file to upload.";
    } else {
      const mime = (videoFile.type || "").toLowerCase();
      if (!mime.startsWith("video/")) {
        next.video = "File must be a video (MIME type must start with video/).";
      } else if (videoFile.size > MAX_VIDEO_BYTES) {
        next.video = "Video must be 256MB or smaller.";
      }
    }
    if (!trimmedTitle) {
      next.title = "Title is required and cannot be only spaces.";
    } else if (trimmedTitle.length > MAX_TITLE) {
      next.title = `Title cannot exceed ${MAX_TITLE} characters.`;
    }
    if (descLen > MAX_DESC) {
      next.description = `Description cannot exceed ${MAX_DESC} characters.`;
    }
    if (!["public", "private", "unlisted"].includes(privacyStatus)) {
      next.privacy = "Select a privacy status.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitDisabled =
    uploading ||
    !channels.length ||
    (multiChannel && !channelId) ||
    !videoFile ||
    !trimmedTitle ||
    titleLen > MAX_TITLE ||
    descLen > MAX_DESC;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setUploadProgress(null);
    if (!validate()) return;
    setUploading(true);
    try {
      const payload = {
        channelId: multiChannel ? channelId : channelId || channels[0]?.id || "",
        title: trimmedTitle,
        description: description.trim(),
        tags: tags.trim(),
        categoryId,
        privacyStatus,
        madeForKids,
        videoFile,
      };
      await postYouTubeVideo(payload, ({ loaded, total }) => {
        if (total > 0) setUploadProgress(Math.min(100, Math.round((loaded / total) * 100)));
      });
      setToast({ message: "Video uploaded successfully on YouTube." });
      onPublishSuccess?.();
      setTitle("");
      setDescription("");
      setTags("");
      setCategoryId("22");
      setPrivacyStatus("private");
      setMadeForKids(false);
      setVideoFile(null);
      setFileInputKey((k) => k + 1);
      setErrors({});
      setUploadProgress(null);
      if (channels.length === 1) setChannelId(channels[0].id);
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not upload video to YouTube.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("reconnect") ||
        lower.includes("not connected") ||
        lower.includes("token expired") ||
        lower.includes("unauthorized")
      ) {
        setSubmitError("YouTube is not connected or the token expired. Please reconnect your YouTube channel.");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-upload-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          onClick={onClose}
          disabled={uploading}
          aria-label="Close"
        >
          <CloseIcon size={18} />
        </button>
        <h2 id="yt-upload-title" className="pr-8 text-lg font-semibold text-white">
          Upload video to YouTube
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Videos upload to your channel via the YouTube Data API. Max file size 256MB. Title up to {MAX_TITLE} characters;
          description optional up to {MAX_DESC.toLocaleString()}.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          {channels.length ? (
            <div>
              <label htmlFor="yt-channel" className="mb-1 block text-xs font-medium text-slate-400">
                Channel
              </label>
              {multiChannel ? (
                <select
                  id="yt-channel"
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                  value={channelId}
                  onChange={(e) => {
                    setChannelId(e.target.value);
                    setErrors((prev) => ({ ...prev, channel: undefined }));
                    setSubmitError("");
                  }}
                  disabled={uploading}
                  aria-invalid={Boolean(errors.channel)}
                >
                  <option value="">Select channel…</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                  {channels[0]?.name || "Connected channel"}
                </p>
              )}
              {errors.channel ? (
                <p className="mt-1 text-xs text-rose-400" role="alert">
                  {errors.channel}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-amber-200/90">Connect a YouTube channel before uploading.</p>
          )}

          <div>
            <label htmlFor="yt-video-file" className="mb-1 block text-xs font-medium text-slate-400">
              Video file
            </label>
            <input
              key={fileInputKey}
              id="yt-video-file"
              type="file"
              className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              accept="video/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setVideoFile(f);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.video;
                  return next;
                });
                setSubmitError("");
              }}
            />
            {videoFile ? (
              <p className="mt-1 text-xs text-slate-400">
                Selected: <span className="text-slate-200">{videoFile.name}</span> (
                {(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            ) : null}
            {errors.video ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.video}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="yt-title" className="mb-1 block text-xs font-medium text-slate-400">
              Title
            </label>
            <input
              id="yt-title"
              type="text"
              maxLength={MAX_TITLE + 50}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrors((prev) => ({ ...prev, title: undefined }));
                setSubmitError("");
              }}
              disabled={uploading}
              aria-invalid={Boolean(errors.title)}
            />
            <div className="mt-1 flex justify-end text-xs text-slate-500">
              <span className={titleLen > MAX_TITLE ? "text-rose-400" : ""}>
                {titleLen} / {MAX_TITLE}
              </span>
            </div>
            {errors.title ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.title}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="yt-desc" className="mb-1 block text-xs font-medium text-slate-400">
              Description (optional)
            </label>
            <textarea
              id="yt-desc"
              rows={4}
              maxLength={MAX_DESC}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => ({ ...prev, description: undefined }));
                setSubmitError("");
              }}
              disabled={uploading}
            />
            <div className="mt-1 flex justify-end text-xs text-slate-500">
              <span className={descLen > MAX_DESC ? "text-rose-400" : ""}>
                {descLen} / {MAX_DESC.toLocaleString()}
              </span>
            </div>
            {errors.description ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.description}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="yt-tags" className="mb-1 block text-xs font-medium text-slate-400">
              Tags (optional, comma-separated)
            </label>
            <input
              id="yt-tags"
              type="text"
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              placeholder="marketing, tutorial, update"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={uploading}
            />
          </div>

          <div>
            <label htmlFor="yt-category" className="mb-1 block text-xs font-medium text-slate-400">
              Category
            </label>
            <select
              id="yt-category"
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={uploading}
            >
              {YOUTUBE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Privacy</span>
            <select
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={privacyStatus}
              onChange={(e) => {
                setPrivacyStatus(e.target.value);
                setErrors((prev) => ({ ...prev, privacy: undefined }));
              }}
              disabled={uploading}
              aria-invalid={Boolean(errors.privacy)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
            </select>
            {errors.privacy ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.privacy}
              </p>
            ) : null}
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="rounded border-slate-500 text-brand-500"
                checked={madeForKids}
                onChange={(e) => setMadeForKids(e.target.checked)}
                disabled={uploading}
              />
              Made for kids
            </label>
            <p className="mt-1 text-[11px] text-slate-500">Required by YouTube for compliance (self-declared).</p>
          </div>

          {uploading && uploadProgress != null ? (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Uploading to server…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-rose-400" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitDisabled}
            >
              {uploading ? "Uploading…" : "Upload to YouTube"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
