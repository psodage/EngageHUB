import { memo } from "react";
import {
  Bookmark,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
} from "lucide-react";
import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import { getPlatformComposerConfig } from "../../data/platformComposerConfig";
import { useObjectUrl } from "../../utils/useObjectUrl";
import { getPreviewMediaAspect, resolvePreviewCard } from "./platformPreviewCards";
import {
  PREVIEW_CARD_COMPACT_MAX,
  PREVIEW_CARD_MAX,
  PREVIEW_CARD_WORKSPACE,
} from "./workspaceLayout";

function PreviewShell({ compact, platformKey, platformLabel, children, emptyHint }) {
  return (
    <div className={compact ? "flex w-full flex-col" : "flex h-full min-h-0 w-full flex-1 flex-col"}>
      <div
        className={`flex items-center gap-2 font-medium text-slate-600 dark:text-slate-400 ${
          compact ? "mb-2 text-xs" : "mb-3 text-sm"
        }`}
      >
        <PlatformBrandIcon
          platformKey={platformKey}
          size="sm"
          className={`shrink-0 !h-4 !w-4 !rounded-md [&_svg]:!h-2.5 [&_svg]:!w-2.5 ${compact ? "" : ""}`}
        />
        <span>{platformLabel}</span>
      </div>

      {children}

      {emptyHint && !compact ? (
        <p className="mt-5 text-center text-sm text-slate-400">{emptyHint}</p>
      ) : null}
    </div>
  );
}

function InstagramPreviewCard({
  username,
  profileImage,
  caption,
  hasMedia,
  mediaPreviewUrl,
  mediaUrl,
  isVideo,
  draft,
  previewLarge,
}) {
  const handle = username.replace(/^@/, "") || "username";
  const mediaAspect = getPreviewMediaAspect("instagram", draft, { size: previewLarge ? "workspace" : "default" });
  const isReel = draft?.postType === "reel";

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200/90 bg-white text-[13px] shadow-[0_1px_10px_rgba(15,23,42,0.08)] dark:border-slate-600 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={profileImage}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80 dark:ring-slate-700"
          />
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{handle}</p>
        </div>
        <button type="button" className="shrink-0 p-0.5 text-slate-800 dark:text-slate-200" aria-label="More options">
          <MoreHorizontal size={18} strokeWidth={2} />
        </button>
      </div>

      <div className={`relative bg-slate-100 dark:bg-slate-800 ${mediaAspect}`}>
        {hasMedia ? (
          <>
            {mediaPreviewUrl && isVideo ? (
              <video src={mediaPreviewUrl} className="h-full w-full object-cover" muted playsInline />
            ) : mediaPreviewUrl ? (
              <img src={mediaPreviewUrl} alt="" className="h-full w-full object-cover" />
            ) : isVideo ? (
              <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
            )}
            {!isReel ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md dark:bg-slate-900/90 dark:text-slate-200"
                aria-label="Next image"
              >
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900">
            <p className="px-6 text-center text-sm text-slate-400">Add a photo or video</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-3 text-slate-900 dark:text-white">
          <Heart size={22} strokeWidth={1.75} />
          <MessageCircle size={22} strokeWidth={1.75} />
          <Repeat2 size={22} strokeWidth={1.75} />
          <Send size={21} strokeWidth={1.75} className="-rotate-12" />
        </div>
        <div className="flex items-center gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <Bookmark size={22} strokeWidth={1.75} className="text-slate-900 dark:text-white" />
      </div>

      {caption ? (
        <p className="line-clamp-4 px-3 pb-3 text-sm leading-snug text-slate-900 dark:text-slate-100">
          <span className="font-semibold">{handle}</span>{" "}
          <span className="font-normal">{caption}</span>
        </p>
      ) : null}
    </article>
  );
}

function GenericPreviewCard({
  platformKey,
  platformLabel,
  displayName,
  profileImage,
  caption,
  hasMedia,
  mediaPreviewUrl,
  mediaUrl,
  isVideo,
  draft,
  composerConfig,
  theme,
  previewLarge,
}) {
  const cardClass = theme.card || "rounded-xl";
  const mediaAspect =
    getPreviewMediaAspect(platformKey, draft, { size: previewLarge ? "workspace" : "default" }) ||
    theme.media ||
    (previewLarge ? "aspect-video max-h-[300px]" : "aspect-video max-h-[200px]");

  return (
    <article
      className={`overflow-hidden border border-slate-200/90 bg-white text-[13px] shadow-[0_1px_10px_rgba(15,23,42,0.08)] dark:border-slate-600 dark:bg-slate-900 ${cardClass}`}
    >
      <div className={`flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 ${theme.header || ""}`}>
        <img src={profileImage} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
          <p className="text-xs text-slate-500">{platformLabel}</p>
        </div>
        <MoreHorizontal size={20} className="shrink-0 text-slate-500" />
      </div>

      {platformKey === "youtube" && draft?.youtubeTitle?.trim() ? (
        <p className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
          {draft.youtubeTitle}
        </p>
      ) : null}

      {hasMedia ? (
        <div className={`bg-slate-100 dark:bg-slate-800 ${mediaAspect}`}>
          {mediaPreviewUrl && isVideo ? (
            <video src={mediaPreviewUrl} className="h-full w-full object-cover" muted playsInline controls />
          ) : mediaPreviewUrl ? (
            <img src={mediaPreviewUrl} alt="" className="h-full w-full object-cover" />
          ) : isVideo ? (
            <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline controls />
          ) : (
            <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      ) : (
        <div className={`${mediaAspect} flex min-h-[140px] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900`}>
          <p className="text-sm text-slate-400">Media preview</p>
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-3 text-slate-700 dark:border-slate-800 dark:text-slate-300">
        <Heart size={22} strokeWidth={1.75} />
        <MessageCircle size={22} strokeWidth={1.75} />
        <Send size={21} strokeWidth={1.75} />
        <Bookmark size={22} strokeWidth={1.75} className="ml-auto" />
      </div>

      {caption ? (
        <p className={`whitespace-pre-wrap px-4 pb-4 text-slate-800 dark:text-slate-100 ${theme.caption || "text-[15px]"}`}>
          {caption}
        </p>
      ) : (
        <p className="px-4 pb-4 text-sm text-slate-400">Caption will appear here</p>
      )}

      {draft?.linkUrl?.trim() && platformKey === "facebook" ? (
        <div className="mx-3 mb-3 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-buffer-700 dark:border-slate-700 dark:bg-slate-950">
          {draft.linkUrl}
        </div>
      ) : null}

      {draft?.firstComment?.trim() && composerConfig.showFirstComment ? (
        <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500 dark:border-slate-800">
          First comment: {draft.firstComment}
        </p>
      ) : null}
    </article>
  );
}

const PREVIEW_THEMES = {
  x: { card: "rounded-2xl", header: "pb-0", caption: "text-[15px] leading-snug", media: "rounded-none aspect-auto max-h-96" },
  linkedin: { card: "rounded-lg", caption: "text-sm leading-relaxed", media: "aspect-video" },
  youtube: { media: "aspect-video", caption: "text-xs text-slate-500" },
  threads: { card: "rounded-xl", caption: "text-sm", media: "aspect-square" },
  facebook: { media: "aspect-[4/3]" },
};

function PlatformPostPreviewInner({
  platformKey,
  account,
  draft,
  compact = false,
  size = "default",
  mediaPreviewUrl: sharedMediaPreviewUrl,
}) {
  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey);
  const composerConfig = getPlatformComposerConfig(platformKey);
  const theme = PREVIEW_THEMES[platformKey] || {};
  const previewLarge = size === "workspace";

  const localMediaUrl = useObjectUrl(
    sharedMediaPreviewUrl === undefined && draft?.file ? draft.file : null
  );
  const mediaPreviewUrl =
    sharedMediaPreviewUrl !== undefined ? sharedMediaPreviewUrl : localMediaUrl;

  const caption = draft?.caption?.trim() || "";
  const mediaUrl = draft?.mediaUrl?.trim() || "";
  const hasMedia = Boolean(mediaPreviewUrl || mediaUrl);
  const hasContent = Boolean(caption || hasMedia || draft?.youtubeTitle?.trim() || draft?.linkUrl?.trim());
  const isVideo =
    draft?.file?.type?.startsWith("video/") || /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(mediaUrl);

  const displayName = account?.accountName || account?.username || platformConfig?.label || "Channel";
  const username = account?.username || account?.accountName || "username";
  const profileImage =
    account?.profileImage ||
    `https://placehold.co/96x96/1e293b/94a3b8?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;

  const platformLabel = platformConfig?.label || platformKey;

  const mediaProps = {
    hasMedia,
    mediaPreviewUrl,
    mediaUrl,
    isVideo,
  };

  const cardProps = {
    platformKey,
    platformLabel,
    displayName,
    username,
    profileImage,
    caption,
    draft,
    composerConfig,
    theme,
    previewLarge,
    ...mediaProps,
  };

  const PlatformCard = resolvePreviewCard(platformKey);

  const card = PlatformCard ? (
    <PlatformCard {...cardProps} />
  ) : platformKey === "instagram" ? (
    <InstagramPreviewCard
      username={username}
      profileImage={profileImage}
      caption={caption}
      draft={draft}
      previewLarge={previewLarge}
      {...mediaProps}
    />
  ) : (
    <GenericPreviewCard {...cardProps} />
  );

  const cardWidthClass =
    size === "workspace"
      ? PREVIEW_CARD_WORKSPACE
      : compact
        ? PREVIEW_CARD_COMPACT_MAX
        : PREVIEW_CARD_MAX;

  return (
    <PreviewShell
      compact={compact}
      platformKey={platformKey}
      platformLabel={platformLabel}
      emptyHint={!hasContent && !compact ? "Add a caption or media in the composer" : null}
    >
      <div className={cardWidthClass}>{card}</div>
    </PreviewShell>
  );
}

const PlatformPostPreview = memo(PlatformPostPreviewInner);

export default PlatformPostPreview;
