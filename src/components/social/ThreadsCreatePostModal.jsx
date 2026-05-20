import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToThreads, uploadSocialPublicMedia } from "../../services/socialApi";

const THREADS_MAX_TEXT = 500;
const BYTES_IN_MB = 1024 * 1024;
const MAX_MEDIA_BYTES = 8 * BYTES_IN_MB;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm";

function initialErrors() {
  return { text: "", mediaUrl: "", mediaType: "", file: "", submit: "" };
}

export default function ThreadsCreatePostModal({ open, onClose, onPublishSuccess }) {
  const { setToast } = useApp();
  const [text, setText] = useState("");
  const [mediaType, setMediaType] = useState("TEXT");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState(initialErrors);
  const [posting, setPosting] = useState(false);

  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const resetForm = useCallback(() => {
    setText("");
    setMediaType("TEXT");
    setMediaUrlInput("");
    setFile(null);
    setErrors(initialErrors());
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

  const validate = () => {
    const next = initialErrors();
    const trimmedText = text.trim();
    const urlTrim = mediaUrlInput.trim();

    if (!["TEXT", "IMAGE", "VIDEO"].includes(mediaType)) {
      next.mediaType = "Choose a valid media type.";
    }

    if (mediaType === "TEXT") {
      if (!trimmedText.length) next.text = "Enter post text, or switch to image/video with a public media URL.";
      else if (trimmedText.length > THREADS_MAX_TEXT) next.text = `Text cannot exceed ${THREADS_MAX_TEXT} characters.`;
    } else {
      if (trimmedText.length > THREADS_MAX_TEXT) next.text = `Caption cannot exceed ${THREADS_MAX_TEXT} characters.`;
      if (!urlTrim && !file) next.mediaUrl = "Provide a public image/video URL or upload a file.";
      if (file) {
        if (file.size > MAX_MEDIA_BYTES) next.file = `File must be ${MAX_MEDIA_BYTES / BYTES_IN_MB}MB or smaller.`;
        const isVideo = mediaType === "VIDEO";
        const isImage = mediaType === "IMAGE";
        const mime = (file.type || "").toLowerCase();
        if (isImage && !mime.startsWith("image/")) next.file = "File type does not match IMAGE.";
        if (isVideo && !mime.startsWith("video/")) next.file = "File type does not match VIDEO.";
      }
      if (urlTrim) {
        try {
          const u = new URL(urlTrim);
          if (u.protocol !== "http:" && u.protocol !== "https:") next.mediaUrl = "URL must start with http:// or https://.";
        } catch {
          next.mediaUrl = "Enter a valid URL.";
        }
      }
    }

    const hasErr = Object.values(next).some(Boolean);
    setErrors(next);
    return !hasErr;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setPosting(true);
    setErrors((prev) => ({ ...prev, submit: "" }));

    try {
      let mediaUrl = "";
      if (mediaType !== "TEXT") {
        if (file) {
          mediaUrl = await uploadSocialPublicMedia(file);
        } else {
          mediaUrl = mediaUrlInput.trim();
        }
      }

      const payload = {
        text: mediaType === "TEXT" ? text.trim() : text.trim(),
        mediaUrl: mediaType === "TEXT" ? "" : mediaUrl,
        mediaType,
      };

      const result = await postToThreads(payload);
      const postId = result?.data?.postId || "";
      setToast({
        message: postId ? `${result.message || "Posted to Threads."} (id: ${postId})` : result?.message || "Posted to Threads.",
      });
      onPublishSuccess?.();
      resetForm();
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not publish to Threads.";
      setErrors((prev) => ({ ...prev, submit: msg }));
      setToast({ message: msg, error: true });
    } finally {
      setPosting(false);
    }
  };

  if (!open) return null;

  const previewRemote = !file && mediaUrlInput.trim() && (mediaType === "IMAGE" || mediaType === "VIDEO") ? mediaUrlInput.trim() : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="threads-create-title">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close dialog" onClick={() => !posting && onClose()} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="threads-create-title" className="text-lg font-semibold text-white">
              Create Threads post
            </h2>
            <p className="mt-1 text-xs text-slate-400">Text posts up to {THREADS_MAX_TEXT} characters. Media must use a URL Threads can reach (or upload to get a public link).</p>
          </div>
          <button
            type="button"
            disabled={posting}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            onClick={() => !posting && onClose()}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="block text-xs font-semibold text-slate-300">Media type</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {["TEXT", "IMAGE", "VIDEO"].map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={posting}
                  onClick={() => {
                    setMediaType(t);
                    setErrors(initialErrors());
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    mediaType === t
                      ? "border-violet-500 bg-violet-500/15 text-violet-200"
                      : "border-slate-600 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.mediaType ? <p className="mt-1 text-xs text-rose-400">{errors.mediaType}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300" htmlFor="threads-post-text">
              {mediaType === "TEXT" ? "Post text" : "Caption (optional)"}
            </label>
            <textarea
              id="threads-post-text"
              rows={5}
              maxLength={THREADS_MAX_TEXT}
              disabled={posting}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500 disabled:opacity-60"
              placeholder={mediaType === "TEXT" ? "What do you want to share?" : "Optional caption…"}
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>{errors.text ? <span className="text-rose-400">{errors.text}</span> : null}</span>
              <span>
                {text.length} / {THREADS_MAX_TEXT}
              </span>
            </div>
          </div>

          {mediaType !== "TEXT" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300" htmlFor="threads-media-url">
                  Public media URL (optional if you upload a file)
                </label>
                <input
                  id="threads-media-url"
                  type="url"
                  disabled={posting || Boolean(file)}
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500 disabled:opacity-60"
                />
                {errors.mediaUrl ? <p className="mt-1 text-xs text-rose-400">{errors.mediaUrl}</p> : null}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300">Upload image or video</label>
                <input
                  type="file"
                  accept={MEDIA_ACCEPT}
                  disabled={posting || Boolean(mediaUrlInput.trim())}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-white"
                />
                {errors.file ? <p className="mt-1 text-xs text-rose-400">{errors.file}</p> : null}
                <p className="mt-1 text-[11px] text-slate-500">Uploads are stored on your server and exposed at APP_BASE_URL so Threads can fetch them.</p>
              </div>
            </div>
          ) : null}

          {(filePreviewUrl || previewRemote) && mediaType === "IMAGE" ? (
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <img src={filePreviewUrl || previewRemote} alt="Preview" className="max-h-48 w-full object-contain bg-black" />
            </div>
          ) : null}
          {(filePreviewUrl || previewRemote) && mediaType === "VIDEO" ? (
            <div className="overflow-hidden rounded-lg border border-slate-700">
              <video src={filePreviewUrl || previewRemote} controls className="max-h-56 w-full bg-black" />
            </div>
          ) : null}

          {errors.submit ? <p className="text-sm text-rose-400">{errors.submit}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={posting}
              onClick={() => !posting && onClose()}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={posting}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Publish to Threads"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
