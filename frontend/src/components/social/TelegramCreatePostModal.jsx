import { useEffect, useMemo, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToTelegram, putTelegramTargets, uploadSocialPublicMediaFile } from "../../services/socialApi";

const MAX_MESSAGE = 4096;
const MAX_MEDIA_URL = 2048;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_DOC_BYTES = 50 * 1024 * 1024;

const DOC_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,application/pdf";

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function getTelegramTargets(account) {
  const raw = account?.metadata?.telegramTargets;
  return Array.isArray(raw) ? raw : [];
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null | undefined} props.account
 * @param {string} [props.presetChatId]
 * @param {() => void} [props.onPublishSuccess]
 */
export default function TelegramCreatePostModal({ open, onClose, account, presetChatId = "", onPublishSuccess }) {
  const { setToast, refreshConnectedAccounts } = useApp();
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState("");
  const [mediaType, setMediaType] = useState("TEXT");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [posting, setPosting] = useState(false);
  const [targetSaving, setTargetSaving] = useState(false);
  const [newTargetId, setNewTargetId] = useState("");
  const [newTargetTitle, setNewTargetTitle] = useState("");
  const [newTargetType, setNewTargetType] = useState("channel");
  const [targetFormError, setTargetFormError] = useState("");
  const prevOpen = useRef(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const targets = useMemo(() => getTelegramTargets(account), [account?.metadata?.telegramTargets]);

  useEffect(() => {
    if (open && !prevOpen.current) {
      const preset =
        presetChatId && targets.some((t) => String(t.chatId) === String(presetChatId)) ? presetChatId : targets[0]?.chatId || "";
      setChatId(preset ? String(preset) : "");
      setMessage("");
      setMediaType("TEXT");
      setMediaUrlInput("");
      setLinkUrl("");
      setButtonText("");
      setButtonUrl("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      setErrors({});
      setSubmitError("");
      setNewTargetId("");
      setNewTargetTitle("");
      setNewTargetType("channel");
      setTargetFormError("");
    }
    prevOpen.current = open;
  }, [open, presetChatId, targets]);

  useEffect(() => {
    if (!open || !presetChatId) return;
    if (targets.some((t) => String(t.chatId) === String(presetChatId))) {
      setChatId(String(presetChatId));
    }
  }, [open, presetChatId, targets]);

  const imagePreviewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const videoPreviewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("video/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [imagePreviewUrl, videoPreviewUrl]);

  if (!open) return null;

  const trimmedMessage = message.trim();
  const trimmedMediaUrl = mediaUrlInput.trim();
  const trimmedLink = linkUrl.trim();
  const trimmedBtnText = buttonText.trim();
  const trimmedBtnUrl = buttonUrl.trim();

  const validate = () => {
    const next = {};
    if (!targets.length) {
      next.chatId = "Add at least one Telegram channel or group below before posting.";
    } else if (!chatId) {
      next.chatId = "Select where to post.";
    } else if (!targets.some((t) => String(t.chatId) === String(chatId))) {
      next.chatId = "That target is not in your saved list.";
    }

    if (trimmedBtnText && !trimmedBtnUrl) {
      next.buttonUrl = "Button URL is required when button text is set.";
    }
    if (trimmedBtnUrl && !trimmedBtnText) {
      next.buttonText = "Button text is required when button URL is set.";
    }
    if (trimmedBtnUrl && !isValidHttpUrl(trimmedBtnUrl)) {
      next.buttonUrl = "Button URL must start with http:// or https://";
    }

    if (mediaType === "TEXT") {
      if (trimmedMediaUrl) next.mediaUrl = "Remove media URL for text posts, or change media type.";
      if (!trimmedMessage && !trimmedLink) {
        next.message = "Enter a message and/or link URL.";
      }
      if (trimmedLink && !isValidHttpUrl(trimmedLink)) {
        next.linkUrl = "Link URL must be a valid http(s) URL.";
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

    if (mediaType === "IMAGE" || mediaType === "VIDEO" || mediaType === "DOCUMENT") {
      if (trimmedLink) next.linkUrl = "Link URL is not used for this media type.";
      const hasMedia = Boolean(file) || Boolean(trimmedMediaUrl);
      if (!hasMedia) {
        next.media = `Add a media URL or upload a file for ${mediaType.toLowerCase()} posts.`;
      } else if (trimmedMediaUrl) {
        if (trimmedMediaUrl.length > MAX_MEDIA_URL) next.mediaUrl = `Media URL is too long (max ${MAX_MEDIA_URL}).`;
        else if (!isValidHttpUrl(trimmedMediaUrl)) next.mediaUrl = "Media URL must be a valid http(s) URL.";
      }
      if (file && mediaType === "IMAGE") {
        const ok = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes((file.type || "").toLowerCase());
        if (!ok) next.media = "Image must be JPG, PNG, GIF, or WebP.";
        else if (file.size > MAX_IMAGE_BYTES) next.media = "Image must be 20MB or smaller.";
      }
      if (file && mediaType === "VIDEO") {
        const vm = (file.type || "").toLowerCase();
        if (!["video/mp4", "video/quicktime", "video/webm"].includes(vm)) {
          next.media = "Video must be MP4, MOV, or WebM.";
        } else if (file.size > MAX_VIDEO_BYTES) next.media = "Video must be 100MB or smaller.";
      }
      if (file && mediaType === "DOCUMENT") {
        if (file.size > MAX_DOC_BYTES) next.media = "Document must be 50MB or smaller.";
      }
      if (message.length > 0 && !trimmedMessage) {
        next.message = "Caption cannot be only spaces.";
      }
    }

    if (trimmedMessage.length > MAX_MESSAGE) {
      next.message = `Message cannot exceed ${MAX_MESSAGE} characters.`;
    }

    const hasPayload = Boolean(trimmedMessage || trimmedMediaUrl || trimmedLink || file);
    if (!hasPayload && !next.media) {
      next.message = next.message || "Enter message text, a link, or media.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    setTargetFormError("");
    const id = newTargetId.trim();
    const title = newTargetTitle.trim();
    if (!id) {
      setTargetFormError("Chat ID is required (numeric id, -100…, or @channelusername).");
      return;
    }
    if (!title) {
      setTargetFormError("Title is required.");
      return;
    }
    if (!["channel", "group", "supergroup"].includes(newTargetType)) {
      setTargetFormError("Select channel, group, or supergroup.");
      return;
    }
    const nextTargets = [...targets, { chatId: id, chatTitle: title, chatType: newTargetType }];
    setTargetSaving(true);
    try {
      await putTelegramTargets(nextTargets);
      await refreshConnectedAccounts();
      setNewTargetId("");
      setNewTargetTitle("");
      setNewTargetType("channel");
      setChatId(id);
      setToast({ message: "Telegram target saved." });
    } catch (err) {
      setTargetFormError(err?.message || "Could not save target.");
    } finally {
      setTargetSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    setPosting(true);
    let mediaUrlFinal = trimmedMediaUrl;
    try {
      if (file && (mediaType === "IMAGE" || mediaType === "VIDEO" || mediaType === "DOCUMENT")) {
        mediaUrlFinal = await uploadSocialPublicMediaFile(file);
        if (!mediaUrlFinal) {
          throw new Error("Upload did not return a URL.");
        }
      }
      await postToTelegram({
        chatId,
        message: trimmedMessage,
        mediaType,
        mediaUrl: ["IMAGE", "VIDEO", "DOCUMENT"].includes(mediaType) ? mediaUrlFinal : "",
        linkUrl: mediaType === "LINK" ? trimmedLink : mediaType === "TEXT" ? trimmedLink : "",
        buttonText: trimmedBtnText,
        buttonUrl: trimmedBtnUrl,
      });
      setToast({ message: "Post published successfully on Telegram." });
      onPublishSuccess?.();
      setMessage("");
      setMediaUrlInput("");
      setLinkUrl("");
      setButtonText("");
      setButtonUrl("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      setErrors({});
      onClose();
    } catch (err) {
      const msg = err?.message || "Could not publish to Telegram.";
      setSubmitError(msg);
    } finally {
      setPosting(false);
    }
  };

  const showImagePreview =
    (file && file.type.startsWith("image/")) || (mediaType === "IMAGE" && trimmedMediaUrl && isValidHttpUrl(trimmedMediaUrl));
  const showVideoPreview =
    (file && file.type.startsWith("video/")) || (mediaType === "VIDEO" && trimmedMediaUrl && isValidHttpUrl(trimmedMediaUrl));
  const previewImageSrc = file?.type.startsWith("image/") ? imagePreviewUrl : trimmedMediaUrl;
  const previewVideoSrc = file?.type.startsWith("video/") ? videoPreviewUrl : trimmedMediaUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <h2 className="text-base font-semibold text-white">Create Telegram post</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-400">Telegram target</label>
            <select
              value={chatId}
              onChange={(ev) => setChatId(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              disabled={!targets.length}
            >
              {!targets.length ? <option value="">No targets saved yet</option> : null}
              {targets.map((t) => (
                <option key={String(t.chatId)} value={String(t.chatId)}>
                  {t.chatTitle} ({t.chatType}) · {t.chatId}
                </option>
              ))}
            </select>
            {errors.chatId ? <p className="mt-1 text-xs text-rose-400">{errors.chatId}</p> : null}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs font-medium text-slate-300">Add channel / group</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Add the bot to the chat, then save the chat id (from Telegram) here. For channels, make the bot an admin with post permission.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={newTargetId}
                onChange={(ev) => setNewTargetId(ev.target.value)}
                placeholder="Chat ID or @username"
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 sm:col-span-2"
              />
              <input
                value={newTargetTitle}
                onChange={(ev) => setNewTargetTitle(ev.target.value)}
                placeholder="Display name"
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 sm:col-span-2"
              />
              <select
                value={newTargetType}
                onChange={(ev) => setNewTargetType(ev.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="channel">Channel</option>
                <option value="group">Group</option>
                <option value="supergroup">Supergroup</option>
              </select>
              <button
                type="button"
                onClick={handleAddTarget}
                disabled={targetSaving}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
              >
                {targetSaving ? "Saving…" : "Save target"}
              </button>
            </div>
            {targetFormError ? <p className="mt-2 text-xs text-rose-400">{targetFormError}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Media type</label>
            <select
              value={mediaType}
              onChange={(ev) => setMediaType(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="TEXT">TEXT</option>
              <option value="IMAGE">IMAGE</option>
              <option value="VIDEO">VIDEO</option>
              <option value="DOCUMENT">DOCUMENT</option>
              <option value="LINK">LINK</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Message / caption</label>
            <textarea
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
              rows={4}
              placeholder={mediaType === "LINK" ? "Optional text above the link" : "Post text"}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            {errors.message ? <p className="mt-1 text-xs text-rose-400">{errors.message}</p> : null}
          </div>

          {(mediaType === "IMAGE" || mediaType === "VIDEO" || mediaType === "DOCUMENT") && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400">Media URL (optional if uploading)</label>
                <input
                  value={mediaUrlInput}
                  onChange={(ev) => setMediaUrlInput(ev.target.value)}
                  type="url"
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
                {errors.mediaUrl ? <p className="mt-1 text-xs text-rose-400">{errors.mediaUrl}</p> : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Upload file</label>
                <input
                  key={fileInputKey}
                  type="file"
                  accept={
                    mediaType === "IMAGE"
                      ? "image/jpeg,image/png,image/gif,image/webp"
                      : mediaType === "VIDEO"
                        ? "video/mp4,video/quicktime,video/webm"
                        : DOC_ACCEPT
                  }
                  onChange={(ev) => setFile(ev.target.files?.[0] || null)}
                  className="mt-1 w-full text-xs text-slate-300"
                />
                {errors.media ? <p className="mt-1 text-xs text-rose-400">{errors.media}</p> : null}
              </div>
            </>
          )}

          {(mediaType === "TEXT" || mediaType === "LINK") && (
            <div>
              <label className="block text-xs font-medium text-slate-400">
                {mediaType === "LINK" ? "Link URL (required)" : "Optional link URL"}
              </label>
              <input
                value={linkUrl}
                onChange={(ev) => setLinkUrl(ev.target.value)}
                type="url"
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.linkUrl ? <p className="mt-1 text-xs text-rose-400">{errors.linkUrl}</p> : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-400">Button text (optional)</label>
              <input
                value={buttonText}
                onChange={(ev) => setButtonText(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.buttonText ? <p className="mt-1 text-xs text-rose-400">{errors.buttonText}</p> : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Button URL (optional)</label>
              <input
                value={buttonUrl}
                onChange={(ev) => setButtonUrl(ev.target.value)}
                type="url"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.buttonUrl ? <p className="mt-1 text-xs text-rose-400">{errors.buttonUrl}</p> : null}
            </div>
          </div>

          {showImagePreview ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
              <p className="mb-2 text-xs text-slate-400">Preview</p>
              <img src={previewImageSrc || ""} alt="" className="max-h-48 w-full rounded object-contain" />
            </div>
          ) : null}
          {showVideoPreview ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
              <p className="mb-2 text-xs text-slate-400">Preview</p>
              <video src={previewVideoSrc || ""} controls className="max-h-48 w-full rounded" />
            </div>
          ) : null}
          {file && mediaType === "DOCUMENT" ? (
            <p className="text-xs text-slate-400">
              Document: <span className="text-slate-200">{file.name}</span>
            </p>
          ) : null}

          {submitError ? <p className="text-sm text-rose-400">{submitError}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={posting || !targets.length}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? "Posting…" : "Publish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
