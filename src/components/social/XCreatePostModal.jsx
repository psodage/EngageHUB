import { useEffect, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToX } from "../../services/socialApi";

const MAX = 280;

export default function XCreatePostModal({ open, onClose, onPublishSuccess }) {
  const { setToast } = useApp();
  const [content, setContent] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [posting, setPosting] = useState(false);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setContent("");
      setFieldError("");
      setSubmitError("");
    }
    prevOpen.current = open;
  }, [open]);

  if (!open) return null;

  const trimmed = content.trim();
  const length = content.length;
  const overLimit = length > MAX;
  const submitDisabled = posting || !trimmed.length || overLimit;

  const validateForSubmit = () => {
    if (!content.trim()) {
      setFieldError("Post content is required and cannot be only spaces.");
      return false;
    }
    if (overLimit) {
      setFieldError(`Post cannot exceed ${MAX} characters.`);
      return false;
    }
    setFieldError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validateForSubmit()) return;
    setPosting(true);
    try {
      await postToX(trimmed);
      setToast({ message: "Post published successfully on X." });
      onPublishSuccess?.();
      setContent("");
      setFieldError("");
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not publish post on X.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("reconnect") ||
        lower.includes("not connected") ||
        lower.includes("token expired") ||
        lower.includes("unauthorized")
      ) {
        setSubmitError("X account is not connected or token expired. Please reconnect your X account.");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="x-create-post-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          onClick={onClose}
          disabled={posting}
          aria-label="Close"
        >
          <CloseIcon size={18} />
        </button>
        <h2 id="x-create-post-title" className="pr-8 text-lg font-semibold text-white">
          Create post on X
        </h2>
        <p className="mt-1 text-xs text-slate-400">Text posts only, up to {MAX} characters.</p>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="x-post-content" className="mb-1 block text-xs font-medium text-slate-400">
              Post content
            </label>
            <textarea
              id="x-post-content"
              rows={6}
              maxLength={MAX}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              placeholder="What's happening?"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (fieldError) setFieldError("");
                if (submitError) setSubmitError("");
              }}
              disabled={posting}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "x-post-content-error" : "x-post-content-count"}
            />
            <div className="mt-1 flex justify-end text-xs text-slate-400">
              <span id="x-post-content-count" className={overLimit ? "text-rose-400" : ""}>
                {length} / {MAX}
              </span>
            </div>
            {fieldError ? (
              <p id="x-post-content-error" className="mt-1 text-xs text-rose-400" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
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
              disabled={posting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitDisabled}
            >
              {posting ? "Posting…" : "Post to X"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
