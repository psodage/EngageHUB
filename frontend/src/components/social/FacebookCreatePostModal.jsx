import { useEffect, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToFacebook, uploadSocialPublicMedia } from "../../services/socialApi";

const MAX_MESSAGE = 63206;

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null | undefined} props.account Facebook Page account from AppContext
 */
export default function FacebookCreatePostModal({ open, onClose, account, onPublishSuccess }) {
  const { setToast } = useApp();
  const [message, setMessage] = useState("");
  const [mediaType, setMediaType] = useState("TEXT");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [posting, setPosting] = useState(false);
  const prevOpen = useRef(false);

  const connected = Boolean(account?.isConnected);
  const pageId = String(account?.entityId || account?.platformUserId || "").trim();

  useEffect(() => {
    if (open && !prevOpen.current) {
      setMessage("");
      setMediaType("TEXT");
      setMediaUrlInput("");
      setLinkUrl("");
      setFile(null);
      setErrors({});
      setSubmitError("");
    }
    prevOpen.current = open;
  }, [open]);

  if (!open) return null;

  const trimmedMessage = message.trim();
  const trimmedMediaUrl = mediaUrlInput.trim();
  const trimmedLink = linkUrl.trim();
  const msgLen = message.length;

  const validate = () => {
    const next = {};
    if (!connected) {
      next.account = "Connect a Facebook Page before publishing.";
    }
    if (!pageId) {
      next.account = "Select a Facebook Page to publish to.";
    }

    if (mediaType === "TEXT") {
      if (trimmedMediaUrl || trimmedLink) {
        next.mediaType = "Remove media URL and link for a text-only post, or change post type.";
      } else if (!trimmedMessage) {
        next.message = "Enter post text, or choose another post type.";
      }
    }
    if (mediaType === "LINK") {
      if (trimmedMediaUrl) next.mediaUrl = "Media URL is not used for link posts.";
      if (!trimmedLink) {
        next.linkUrl = "Enter a valid http(s) URL for the link post.";
      } else if (!isValidHttpUrl(trimmedLink)) {
        next.linkUrl = "URL must start with http:// or https://";
      }
      if (message.length > 0 && !trimmedMessage) {
        next.message = "Message cannot be only spaces.";
      }
    }
    if (mediaType === "IMAGE" || mediaType === "VIDEO") {
      if (trimmedLink) next.linkUrl = "Link URL is not used for image or video posts.";
      const hasMedia = Boolean(file) || Boolean(trimmedMediaUrl);
      if (!hasMedia) {
        next.media = `Add a media URL or upload a file for ${mediaType.toLowerCase()} posts.`;
      } else if (trimmedMediaUrl && !isValidHttpUrl(trimmedMediaUrl)) {
        next.mediaUrl = "Media URL must be a valid http(s) URL.";
      }
      if (message.length > 0 && !trimmedMessage) {
        next.message = "Caption cannot be only spaces.";
      }
    }

    if (msgLen > MAX_MESSAGE) {
      next.message = `Message cannot exceed ${MAX_MESSAGE.toLocaleString()} characters.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitDisabled =
    posting ||
    !connected ||
    !pageId ||
    msgLen > MAX_MESSAGE ||
    (mediaType === "TEXT" && (!trimmedMessage || trimmedMediaUrl || trimmedLink)) ||
    (mediaType === "LINK" && (!trimmedLink || !isValidHttpUrl(trimmedLink) || trimmedMediaUrl)) ||
    (mediaType === "IMAGE" &&
      (!file && (!trimmedMediaUrl || !isValidHttpUrl(trimmedMediaUrl)) || trimmedLink)) ||
    (mediaType === "VIDEO" &&
      (!file && (!trimmedMediaUrl || !isValidHttpUrl(trimmedMediaUrl)) || trimmedLink));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    let resolvedMediaUrl = trimmedMediaUrl;
    if (file && (mediaType === "IMAGE" || mediaType === "VIDEO")) {
      try {
        resolvedMediaUrl = await uploadSocialPublicMedia(file);
        if (!resolvedMediaUrl) {
          setSubmitError("Upload succeeded but no URL was returned. Try again.");
          return;
        }
      } catch (uploadErr) {
        setSubmitError(uploadErr?.message || "Could not upload media.");
        return;
      }
    }

    const payload = {
      message: trimmedMessage,
      mediaType,
      mediaUrl: mediaType === "IMAGE" || mediaType === "VIDEO" ? resolvedMediaUrl : "",
      linkUrl: mediaType === "LINK" ? trimmedLink : "",
      entityType: "page",
      entityId: pageId,
    };

    setPosting(true);
    try {
      await postToFacebook(payload);
      setToast({ message: "Post published successfully on Facebook." });
      onPublishSuccess?.();
      setMessage("");
      setMediaUrlInput("");
      setLinkUrl("");
      setFile(null);
      setErrors({});
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not publish post on Facebook.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("reconnect") ||
        lower.includes("not connected") ||
        lower.includes("token expired") ||
        lower.includes("facebook is not connected")
      ) {
        setSubmitError("Facebook is not connected or token expired. Reconnect your Facebook Page under Channels.");
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
      aria-labelledby="fb-create-post-title"
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
          disabled={posting}
          aria-label="Close"
        >
          <CloseIcon size={18} />
        </button>
        <h2 id="fb-create-post-title" className="pr-8 text-lg font-semibold text-white">
          Create post on Facebook
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Posts are published to {account?.accountName || account?.username || "this Page"}.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          {!connected ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
              Connect a Facebook Page first from Connect channels.
            </p>
          ) : null}
          {errors.account ? (
            <p className="text-xs text-rose-400" role="alert">
              {errors.account}
            </p>
          ) : null}

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Post type</span>
            <div className="flex flex-wrap gap-2">
              {["TEXT", "LINK", "IMAGE", "VIDEO"].map((t) => (
                <label key={t} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="fb-media-type"
                    className="border-slate-500 text-brand-500"
                    checked={mediaType === t}
                    onChange={() => {
                      setMediaType(t);
                      setErrors({});
                      setSubmitError("");
                    }}
                    disabled={posting}
                  />
                  {t === "TEXT" ? "Text" : t === "LINK" ? "Link" : t === "IMAGE" ? "Image" : "Video"}
                </label>
              ))}
            </div>
            {errors.mediaType ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.mediaType}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="fb-message" className="mb-1 block text-xs font-medium text-slate-400">
              Message / caption
            </label>
            <textarea
              id="fb-message"
              rows={5}
              maxLength={MAX_MESSAGE}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              placeholder={
                mediaType === "LINK"
                  ? "Optional commentary with your link"
                  : mediaType === "TEXT"
                    ? "What do you want to share?"
                    : "Optional caption"
              }
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setErrors((prev) => ({ ...prev, message: undefined }));
                if (submitError) setSubmitError("");
              }}
              disabled={posting}
              aria-invalid={Boolean(errors.message)}
            />
            <div className="mt-1 flex justify-end text-xs text-slate-400">
              <span className={msgLen > MAX_MESSAGE ? "text-rose-400" : ""}>
                {msgLen.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
              </span>
            </div>
            {errors.message ? (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {errors.message}
              </p>
            ) : null}
          </div>

          {mediaType === "LINK" ? (
            <div>
              <label htmlFor="fb-link" className="mb-1 block text-xs font-medium text-slate-400">
                Link URL
              </label>
              <input
                id="fb-link"
                type="url"
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setErrors((prev) => ({ ...prev, linkUrl: undefined }));
                }}
                disabled={posting}
              />
              {errors.linkUrl ? (
                <p className="mt-1 text-xs text-rose-400" role="alert">
                  {errors.linkUrl}
                </p>
              ) : null}
            </div>
          ) : null}

          {mediaType === "IMAGE" || mediaType === "VIDEO" ? (
            <div className="space-y-2">
              <div>
                <label htmlFor="fb-media-url" className="mb-1 block text-xs font-medium text-slate-400">
                  Media URL (optional if you upload a file)
                </label>
                <input
                  id="fb-media-url"
                  type="url"
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
                  placeholder="https://…"
                  value={mediaUrlInput}
                  onChange={(e) => {
                    setMediaUrlInput(e.target.value);
                    setErrors((prev) => ({ ...prev, mediaUrl: undefined, media: undefined }));
                  }}
                  disabled={posting || Boolean(file)}
                />
                {errors.mediaUrl ? (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {errors.mediaUrl}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="fb-file" className="mb-1 block text-xs font-medium text-slate-400">
                  Upload image or video
                </label>
                <input
                  id="fb-file"
                  type="file"
                  accept="image/*,video/*"
                  className="w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-100"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setErrors((prev) => ({ ...prev, media: undefined }));
                  }}
                  disabled={posting}
                />
                {errors.media ? (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {errors.media}
                  </p>
                ) : null}
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
              disabled={posting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitDisabled}
            >
              {posting ? "Posting…" : "Publish to Page"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
