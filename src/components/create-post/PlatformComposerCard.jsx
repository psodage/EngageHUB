import { useEffect, useMemo, useRef } from "react";
import { Hash, ImagePlus, Smile, X } from "lucide-react";
import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import { getActivePostTypeConfig, getPlatformComposerConfig } from "../../data/platformComposerConfig";

function PlatformBadge({ platformKey }) {
  return (
    <span className="absolute -bottom-0.5 -right-0.5">
      <PlatformBrandIcon
        platformKey={platformKey}
        size="sm"
        className="!h-5 !w-5 !rounded-full [&_svg]:!h-2.5 [&_svg]:!w-2.5 ring-2 ring-white dark:ring-slate-900"
      />
    </span>
  );
}

export default function PlatformComposerCard({
  platformKey,
  account,
  draft,
  isActive,
  onFocus,
  onChange,
  onRemove,
}) {
  const fileInputRef = useRef(null);
  const config = getPlatformComposerConfig(platformKey);
  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey);
  const typeConfig = getActivePostTypeConfig(platformKey, draft.postType);
  const maxChars = config.maxChars ?? 2200;

  const displayName = account?.accountName || account?.username || platformConfig?.label || platformKey;
  const profileImage =
    account?.profileImage ||
    `https://placehold.co/80x80/1e293b/94a3b8?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;

  const mediaPreviewUrl = useMemo(() => (draft.file ? URL.createObjectURL(draft.file) : null), [draft.file]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const accept =
    typeConfig?.accept ||
    config.media?.accept?.join(",") ||
    "image/*,video/*";

  const showDropzone =
    config.showMediaDropzone &&
    typeConfig?.mediaType !== "TEXT" &&
    draft.postType !== "text" &&
    draft.postType !== "link" &&
    !typeConfig?.disabled;

  const showLinkField = draft.postType === "link" || typeConfig?.mediaType === "LINK";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={(e) => e.key === "Enter" && onFocus()}
      className={`buffer-card overflow-hidden transition ring-2 ${
        isActive ? "ring-buffer-300 dark:ring-buffer-500/40" : "ring-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={profileImage} alt="" className="h-10 w-10 rounded-full border border-slate-200 object-cover dark:border-slate-700" />
            <PlatformBadge platformKey={platformKey} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
            <p className="text-xs text-slate-500">{platformConfig?.label}</p>
          </div>
          </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label={`Remove ${platformConfig?.label}`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {config.postTypes?.length > 1 ? (
          <div className="flex flex-wrap items-center gap-4">
            {config.postTypes.map((pt) => (
              <label
                key={pt.id}
                className={`flex cursor-pointer items-center gap-2 text-sm ${
                  pt.disabled ? "cursor-not-allowed opacity-50" : "text-slate-700 dark:text-slate-200"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="radio"
                  name={`post-type-${platformKey}`}
                  checked={draft.postType === pt.id}
                  disabled={pt.disabled}
                  onChange={() => onChange({ postType: pt.id, file: null, mediaUrl: "", linkUrl: "" })}
                  className="accent-buffer-600"
                />
                <span>{pt.label}</span>
              </label>
            ))}
          </div>
        ) : null}
        {typeConfig?.disabled && typeConfig.hint ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{typeConfig.hint}</p>
        ) : null}

        <textarea
          rows={5}
          maxLength={maxChars}
          disabled={typeConfig?.disabled}
          value={draft.caption}
          onChange={(e) => onChange({ caption: e.target.value, error: "" })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Start writing or get inspired with Templates"
          className="w-full resize-none rounded-lg border-0 bg-transparent px-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
        />

        {showDropzone && !typeConfig?.disabled ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80 py-8 text-center transition hover:border-buffer-400 hover:bg-buffer-50/50 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-buffer-500/50"
          >
            {mediaPreviewUrl && draft.file ? (
              draft.file.type?.startsWith("video/") ? (
                <video src={mediaPreviewUrl} className="max-h-40 w-full rounded-md object-contain" controls muted />
              ) : (
                <img src={mediaPreviewUrl} alt="" className="max-h-40 w-full rounded-md object-contain" />
              )
            ) : (
              <>
                <ImagePlus size={28} className="text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Drag & drop or select a file</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => onChange({ file: e.target.files?.[0] ?? null, error: "" })}
            />
          </div>
        ) : null}

        {config.showPublicMediaUrl && draft.postType !== "text" ? (
          <input
            type="url"
            value={draft.mediaUrl}
            disabled={Boolean(draft.file)}
            onChange={(e) => onChange({ mediaUrl: e.target.value, error: "" })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Public media URL (optional if uploading)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        ) : null}

        {showLinkField ? (
          <input
            type="url"
            value={draft.linkUrl}
            onChange={(e) => onChange({ linkUrl: e.target.value, error: "" })}
            onClick={(e) => e.stopPropagation()}
            placeholder="https://your-link.com"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        ) : null}

        {config.showYoutubeFields ? (
          <input
            type="text"
            value={draft.youtubeTitle}
            maxLength={100}
            onChange={(e) => onChange({ youtubeTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Video title (required for YouTube)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <button type="button" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Add emoji">
              <Smile size={18} />
            </button>
            <button type="button" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Hashtag">
              <Hash size={18} />
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {(draft.caption || "").length} / {maxChars}
          </span>
        </div>

        {config.showFirstComment ? (
          <label className="block" onClick={(e) => e.stopPropagation()}>
            <span className="mb-1 block text-xs font-medium text-slate-500">First comment</span>
            <input
              type="text"
              value={draft.firstComment}
              onChange={(e) => onChange({ firstComment: e.target.value })}
              placeholder="Your comment"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        ) : null}

        {draft.error ? <p className="text-xs text-rose-600 dark:text-rose-400">{draft.error}</p> : null}
      </div>
    </article>
  );
}
