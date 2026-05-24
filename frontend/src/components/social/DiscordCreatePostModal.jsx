import { useEffect, useMemo, useRef, useState } from "react";
import { X as CloseIcon } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { postToDiscord, putDiscordTargets, uploadSocialPublicMediaFile } from "../../services/socialApi";

const DISCORD_CONTENT_MAX = 2000;
const EMBED_TITLE_MAX = 256;
const EMBED_DESC_MAX = 4096;

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isDiscordSnowflake(s) {
  return typeof s === "string" && /^\d{17,24}$/.test(s.trim());
}

function getDiscordTargets(account) {
  const raw = account?.metadata?.discordTargets;
  return Array.isArray(raw) ? raw : [];
}

function discordTargetRowKey(t) {
  return `${String(t.guildId || "").trim()}|||${String(t.channelId || "").trim()}|||${String(t.connectionType || "").toLowerCase()}`;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object | null | undefined} props.account
 * @param {{ guildId: string, channelId: string } | null} [props.preset]
 * @param {() => void} [props.onPublishSuccess]
 */
export default function DiscordCreatePostModal({ open, onClose, account, preset = null, onPublishSuccess }) {
  const { setToast, refreshConnectedAccounts } = useApp();
  const [targetKey, setTargetKey] = useState("");
  const [message, setMessage] = useState("");
  const [mediaType, setMediaType] = useState("TEXT");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDescription, setEmbedDescription] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [posting, setPosting] = useState(false);
  const [targetSaving, setTargetSaving] = useState(false);
  const [newConnType, setNewConnType] = useState("bot");
  const [newGuildId, setNewGuildId] = useState("");
  const [newGuildName, setNewGuildName] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [targetFormError, setTargetFormError] = useState("");
  const prevOpen = useRef(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const targets = useMemo(() => getDiscordTargets(account), [account?.metadata?.discordTargets]);

  const selectedTarget = useMemo(() => {
    if (!targetKey) return null;
    return targets.find((t) => discordTargetRowKey(t) === targetKey) || null;
  }, [targets, targetKey]);

  useEffect(() => {
    if (open && !prevOpen.current) {
      let initialKey = "";
      if (preset?.channelId != null && targets.length) {
        const presetGuild = String(preset.guildId ?? "").trim();
        const match = targets.find(
          (t) => String(t.channelId) === String(preset.channelId) && String(t.guildId || "").trim() === presetGuild
        );
        if (match) initialKey = discordTargetRowKey(match);
      }
      if (!initialKey && targets[0]) initialKey = discordTargetRowKey(targets[0]);
      setTargetKey(initialKey);
      setMessage("");
      setMediaType("TEXT");
      setMediaUrlInput("");
      setLinkUrl("");
      setEmbedTitle("");
      setEmbedDescription("");
      setEmbedUrl("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      setErrors({});
      setSubmitError("");
      setNewConnType("bot");
      setNewGuildId("");
      setNewGuildName("");
      setNewChannelId("");
      setNewChannelName("");
      setNewWebhookUrl("");
      setTargetFormError("");
    }
    prevOpen.current = open;
  }, [open, preset, targets]);

  useEffect(() => {
    if (!open || !preset?.channelId) return;
    const match = targets.find(
      (t) =>
        String(t.channelId) === String(preset.channelId) && String(t.guildId || "").trim() === String(preset.guildId || "").trim()
    );
    if (match) setTargetKey(discordTargetRowKey(match));
  }, [open, preset, targets]);

  if (!open) return null;

  const trimmedMessage = message.trim();
  const trimmedMediaUrl = mediaUrlInput.trim();
  const trimmedLink = linkUrl.trim();
  const trimmedEmbedTitle = embedTitle.trim();
  const trimmedEmbedDesc = embedDescription.trim();
  const trimmedEmbedUrl = embedUrl.trim();

  const validate = () => {
    const next = {};
    if (!targets.length) {
      next.target = "Save at least one Discord server/channel target below before posting.";
    } else if (!targetKey || !selectedTarget) {
      next.target = "Select where to post.";
    } else if (String(selectedTarget.connectionType).toLowerCase() === "bot") {
      if (!isDiscordSnowflake(String(selectedTarget.guildId || ""))) {
        next.target = "This bot target is missing a valid server id. Re-save the target.";
      }
    }

    if (!mediaType || !["TEXT", "IMAGE", "EMBED", "LINK"].includes(mediaType)) {
      next.mediaType = "Select a media type.";
    }

    const hasCore =
      Boolean(trimmedMessage || trimmedEmbedDesc || trimmedMediaUrl || trimmedLink) ||
      (mediaType === "EMBED" && Boolean(trimmedEmbedTitle || trimmedEmbedDesc));
    if (!hasCore) {
      next.content = "Enter message text, embed description, media URL, or link URL (for EMBED, title and/or description counts).";
    }

    if (trimmedMessage.length > DISCORD_CONTENT_MAX) {
      next.message = `Message cannot exceed ${DISCORD_CONTENT_MAX} characters.`;
    }
    if (trimmedEmbedTitle.length > EMBED_TITLE_MAX) {
      next.embedTitle = `Title cannot exceed ${EMBED_TITLE_MAX} characters.`;
    }
    if (trimmedEmbedDesc.length > EMBED_DESC_MAX) {
      next.embedDescription = `Description cannot exceed ${EMBED_DESC_MAX} characters.`;
    }

    if (message.length > 0 && !trimmedMessage) {
      next.message = "Message cannot be only spaces.";
    }

    if (mediaType === "IMAGE") {
      const hasUrl = Boolean(trimmedMediaUrl) && isValidHttpUrl(trimmedMediaUrl);
      const hasFile = Boolean(file);
      if (!hasUrl && !hasFile) {
        next.mediaUrl = "IMAGE posts require a valid media URL or an uploaded image.";
      } else if (trimmedMediaUrl && !isValidHttpUrl(trimmedMediaUrl)) {
        next.mediaUrl = "Media URL must start with http:// or https://.";
      }
    }

    if (mediaType === "LINK") {
      if (!trimmedLink) next.linkUrl = "LINK posts require a valid URL.";
      else if (!isValidHttpUrl(trimmedLink)) next.linkUrl = "URL must start with http:// or https://.";
    }

    if (mediaType === "EMBED") {
      if (!trimmedEmbedTitle && !trimmedEmbedDesc) {
        next.embed = "EMBED posts require an embed title and/or description.";
      }
    }

    if (trimmedEmbedUrl && !isValidHttpUrl(trimmedEmbedUrl)) {
      next.embedUrl = "Embed URL must be a valid http(s) URL.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    setTargetFormError("");
    const ctype = newConnType.toLowerCase();
    const cid = newChannelId.trim();
    const cname = newChannelName.trim();
    const gid = newGuildId.trim();
    const gname = newGuildName.trim();
    const wh = newWebhookUrl.trim();

    if (!isDiscordSnowflake(cid)) {
      setTargetFormError("Enter a valid numeric channel id (Discord snowflake).");
      return;
    }
    if (!cname) {
      setTargetFormError("Channel name is required.");
      return;
    }
    if (ctype === "bot") {
      if (!isDiscordSnowflake(gid)) {
        setTargetFormError("Bot targets require a valid server (guild) id.");
        return;
      }
      if (!gname) {
        setTargetFormError("Server name is required for bot targets.");
        return;
      }
    } else {
      let whOk = false;
      try {
        const u = new URL(wh);
        const h = u.hostname.toLowerCase();
        whOk =
          u.protocol === "https:" &&
          (h === "discord.com" || h === "discordapp.com" || h === "canary.discord.com") &&
          u.pathname.includes("/webhooks/");
      } catch {
        whOk = false;
      }
      if (!whOk) {
        setTargetFormError("Paste a full https Discord webhook URL for this channel.");
        return;
      }
    }

    const row =
      ctype === "bot"
        ? { guildId: gid, guildName: gname, channelId: cid, channelName: cname, connectionType: "bot" }
        : {
            guildId: gid && isDiscordSnowflake(gid) ? gid : "",
            guildName: gname || "Discord server",
            channelId: cid,
            channelName: cname,
            connectionType: "webhook",
            webhookUrl: wh,
          };

    const nextTargets = [...targets, row];
    setTargetSaving(true);
    try {
      await putDiscordTargets(nextTargets);
      await refreshConnectedAccounts();
      setNewGuildId("");
      setNewGuildName("");
      setNewChannelId("");
      setNewChannelName("");
      setNewWebhookUrl("");
      const addedRow =
        ctype === "bot"
          ? { guildId: gid, guildName: gname, channelId: cid, channelName: cname, connectionType: "bot" }
          : {
              guildId: gid && isDiscordSnowflake(gid) ? gid : "",
              guildName: gname || "Discord server",
              channelId: cid,
              channelName: cname,
              connectionType: "webhook",
            };
      setTargetKey(discordTargetRowKey(addedRow));
      setToast({ message: "Discord target saved." });
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
      if (mediaType === "IMAGE" && file) {
        mediaUrlFinal = await uploadSocialPublicMediaFile(file);
        if (!mediaUrlFinal) throw new Error("Upload did not return a URL.");
      }
      if (!selectedTarget) throw new Error("Select a Discord target.");
      const gidSubmit = String(selectedTarget.guildId || "").trim();
      const cidSubmit = String(selectedTarget.channelId || "").trim();
      await postToDiscord({
        guildId: gidSubmit,
        channelId: cidSubmit,
        message: trimmedMessage,
        mediaType,
        mediaUrl: mediaType === "IMAGE" ? mediaUrlFinal : trimmedMediaUrl,
        linkUrl: trimmedLink,
        embedTitle: trimmedEmbedTitle,
        embedDescription: trimmedEmbedDesc,
        embedUrl: trimmedEmbedUrl,
      });
      setToast({ message: "Post published successfully on Discord." });
      onPublishSuccess?.();
      setMessage("");
      setMediaUrlInput("");
      setLinkUrl("");
      setEmbedTitle("");
      setEmbedDescription("");
      setEmbedUrl("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      setErrors({});
      onClose();
    } catch (err) {
      setSubmitError(err?.message || "Could not publish to Discord.");
    } finally {
      setPosting(false);
    }
  };

  const imagePreviewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <h2 className="text-base font-semibold text-white">Create Discord post</h2>
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
            <label className="block text-xs font-medium text-slate-400">Discord target (server → channel)</label>
            <select
              value={targetKey}
              onChange={(ev) => setTargetKey(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              disabled={!targets.length}
            >
              {!targets.length ? <option value="">No targets saved yet</option> : null}
              {targets.map((t) => (
                <option key={discordTargetRowKey(t)} value={discordTargetRowKey(t)}>
                  {t.guildName || "Server"} → #{t.channelName || t.channelId}{" "}
                  ({String(t.connectionType).toLowerCase() === "webhook" ? "webhook" : "bot"})
                </option>
              ))}
            </select>
            {errors.target ? <p className="mt-1 text-xs text-rose-400">{errors.target}</p> : null}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <p className="text-xs font-medium text-slate-300">Save server / channel target</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Bot: add your bot to the server with Send Messages (and Embed Links for embeds). Webhook: paste the channel webhook URL; secrets stay on the
              server only.
            </p>
            <div className="mt-2 grid gap-2">
              <select
                value={newConnType}
                onChange={(ev) => setNewConnType(ev.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              >
                <option value="bot">Bot (DISCORD_BOT_TOKEN on server)</option>
                <option value="webhook">Incoming webhook</option>
              </select>
              {newConnType === "bot" ? (
                <>
                  <input
                    value={newGuildId}
                    onChange={(ev) => setNewGuildId(ev.target.value)}
                    placeholder="Server (guild) id"
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                  <input
                    value={newGuildName}
                    onChange={(ev) => setNewGuildName(ev.target.value)}
                    placeholder="Server display name"
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                </>
              ) : (
                <>
                  <input
                    value={newGuildId}
                    onChange={(ev) => setNewGuildId(ev.target.value)}
                    placeholder="Server id (optional, for your notes)"
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                  <input
                    value={newGuildName}
                    onChange={(ev) => setNewGuildName(ev.target.value)}
                    placeholder="Server name (optional)"
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                  <input
                    value={newWebhookUrl}
                    onChange={(ev) => setNewWebhookUrl(ev.target.value)}
                    placeholder="https://discord.com/api/webhooks/…"
                    className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                </>
              )}
              <input
                value={newChannelId}
                onChange={(ev) => setNewChannelId(ev.target.value)}
                placeholder="Channel id"
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                value={newChannelName}
                onChange={(ev) => setNewChannelName(ev.target.value)}
                placeholder="Channel display name"
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
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
              <option value="EMBED">EMBED</option>
              <option value="LINK">LINK</option>
            </select>
            {errors.mediaType ? <p className="mt-1 text-xs text-rose-400">{errors.mediaType}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400">Message</label>
            <textarea
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
              rows={4}
              placeholder="Post text (optional for some embed/image/link posts)"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            {errors.message ? <p className="mt-1 text-xs text-rose-400">{errors.message}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400">Embed title (optional)</label>
              <input
                value={embedTitle}
                onChange={(ev) => setEmbedTitle(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.embedTitle ? <p className="mt-1 text-xs text-rose-400">{errors.embedTitle}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400">Embed description (optional)</label>
              <textarea
                value={embedDescription}
                onChange={(ev) => setEmbedDescription(ev.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.embedDescription ? <p className="mt-1 text-xs text-rose-400">{errors.embedDescription}</p> : null}
              {errors.embed ? <p className="mt-1 text-xs text-rose-400">{errors.embed}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400">Embed URL (optional)</label>
              <input
                value={embedUrl}
                onChange={(ev) => setEmbedUrl(ev.target.value)}
                type="url"
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.embedUrl ? <p className="mt-1 text-xs text-rose-400">{errors.embedUrl}</p> : null}
            </div>
          </div>

          {(mediaType === "IMAGE" || mediaType === "TEXT" || mediaType === "EMBED") && (
            <div>
              <label className="block text-xs font-medium text-slate-400">
                {mediaType === "IMAGE" ? "Image URL (or upload below)" : "Image / media URL (optional)"}
              </label>
              <input
                value={mediaUrlInput}
                onChange={(ev) => setMediaUrlInput(ev.target.value)}
                type="url"
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {errors.mediaUrl ? <p className="mt-1 text-xs text-rose-400">{errors.mediaUrl}</p> : null}
            </div>
          )}

          {mediaType === "IMAGE" && (
            <div>
              <label className="block text-xs font-medium text-slate-400">Upload image (optional)</label>
              <input
                key={fileInputKey}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(ev) => setFile(ev.target.files?.[0] || null)}
                className="mt-1 w-full text-xs text-slate-300"
              />
            </div>
          )}

          {(mediaType === "TEXT" || mediaType === "LINK") && (
            <div>
              <label className="block text-xs font-medium text-slate-400">
                {mediaType === "LINK" ? "Link URL (required)" : "Link URL (optional)"}
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

          {errors.content ? <p className="text-xs text-rose-400">{errors.content}</p> : null}

          {imagePreviewUrl ? (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-2">
              <p className="mb-2 text-xs text-slate-400">Preview</p>
              <img src={imagePreviewUrl} alt="" className="max-h-48 w-full rounded object-contain" />
            </div>
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
