import { Heart, MessageCircle, MoreHorizontal, Repeat2, Send, Share2, ThumbsUp } from "lucide-react";

export function PreviewMedia({
  hasMedia,
  mediaPreviewUrl,
  mediaUrl,
  isVideo,
  aspectClass = "aspect-video",
  emptyLabel = "Add media",
  roundedClass = "",
}) {
  if (!hasMedia) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 ${aspectClass} ${roundedClass}`}
      >
        <p className="px-4 text-center text-sm text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  const mediaClass = `h-full w-full object-cover ${roundedClass}`;
  return (
    <div className={`overflow-hidden bg-slate-100 dark:bg-slate-800 ${aspectClass} ${roundedClass}`}>
      {mediaPreviewUrl && isVideo ? (
        <video src={mediaPreviewUrl} className={mediaClass} muted playsInline controls />
      ) : mediaPreviewUrl ? (
        <img src={mediaPreviewUrl} alt="" className={mediaClass} />
      ) : isVideo ? (
        <video src={mediaUrl} className={mediaClass} muted playsInline controls />
      ) : (
        <img src={mediaUrl} alt="" className={mediaClass} />
      )}
    </div>
  );
}

export function getPreviewMediaAspect(platformKey, draft, { large = false, size = "default" } = {}) {
  const isWorkspace = size === "workspace" || large;
  const cap = isWorkspace ? "max-h-[300px]" : "max-h-[200px]";
  if (platformKey === "instagram") {
    return draft?.postType === "reel"
      ? `aspect-[9/16] w-full ${isWorkspace ? "max-h-[380px]" : "max-h-[300px]"}`
      : `aspect-square w-full ${cap}`;
  }
  if (platformKey === "pinterest") return `aspect-[2/3] w-full ${isWorkspace ? "max-h-[360px]" : "max-h-[260px]"}`;
  if (platformKey === "threads") {
    return draft?.postType === "video"
      ? `aspect-[4/5] w-full ${cap}`
      : `aspect-square w-full ${cap}`;
  }
  if (platformKey === "youtube") return `aspect-video w-full ${cap}`;
  if (platformKey === "facebook") {
    if (draft?.postType === "video") return `aspect-video w-full ${cap}`;
    if (draft?.postType === "image") return `aspect-[4/3] w-full ${cap}`;
    return `aspect-video w-full ${cap}`;
  }
  if (platformKey === "linkedin") {
    if (draft?.postType === "video") return `aspect-video w-full ${cap}`;
    return `aspect-[4/3] w-full ${cap}`;
  }
  if (platformKey === "x") return `aspect-video w-full rounded-xl ${isWorkspace ? "max-h-[280px]" : "max-h-36"}`;
  return `aspect-video w-full ${cap}`;
}

const cardShell =
  "overflow-hidden border border-slate-200/90 bg-white text-[13px] shadow-[0_1px_10px_rgba(15,23,42,0.08)] dark:border-slate-600 dark:bg-slate-900";

export function XPreviewCard(props) {
  const { displayName, username, profileImage, caption, platformKey, draft, composerConfig, previewLarge, ...media } = props;
  const handle = (username || displayName).replace(/^@/, "");

  return (
    <article className={`${cardShell} rounded-2xl`}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <img src={profileImage} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-slate-900 dark:text-white">{displayName}</p>
          <p className="text-sm text-slate-500">@{handle}</p>
          {caption ? (
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900 dark:text-slate-100">
              {caption}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">What&apos;s happening?</p>
          )}
        </div>
        <MoreHorizontal size={18} className="shrink-0 text-slate-500" />
      </div>
      {media.hasMedia ? (
        <div className="mt-3 px-4 pb-3">
          <PreviewMedia {...media} aspectClass={getPreviewMediaAspect("x", draft, { large: previewLarge })} roundedClass="rounded-2xl border border-slate-200 dark:border-slate-700" />
        </div>
      ) : null}
      <div className="flex justify-around border-t border-slate-100 px-6 py-3 text-slate-500 dark:border-slate-800">
        <MessageCircle size={18} />
        <Repeat2 size={18} />
        <Heart size={18} />
        <Share2 size={18} />
      </div>
    </article>
  );
}

export function LinkedInPreviewCard(props) {
  const { displayName, profileImage, caption, platformKey, draft, composerConfig, previewLarge, ...media } = props;

  return (
    <article className={`${cardShell} rounded-lg`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <img src={profileImage} alt="" className="h-12 w-12 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
          <p className="text-xs text-slate-500">Just now · 🌐</p>
        </div>
        <MoreHorizontal size={18} className="text-slate-500" />
      </div>
      {caption ? (
        <p className="whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
          {caption}
        </p>
      ) : (
        <p className="px-4 pb-3 text-sm text-slate-400">Share an update with your network</p>
      )}
      <PreviewMedia {...media} aspectClass={getPreviewMediaAspect("linkedin", draft, { large: previewLarge })} emptyLabel="Add image or video" />
      <div className="flex items-center justify-around border-t border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp size={16} /> Like
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={16} /> Comment
        </span>
        <span className="inline-flex items-center gap-1">
          <Repeat2 size={16} /> Repost
        </span>
        <span className="inline-flex items-center gap-1">
          <Send size={16} /> Send
        </span>
      </div>
    </article>
  );
}

export function ThreadsPreviewCard(props) {
  const { displayName, username, profileImage, caption, draft, previewLarge, ...media } = props;
  const handle = (username || displayName).replace(/^@/, "");

  return (
    <article className={`${cardShell} rounded-xl`}>
      <div className="flex gap-3 px-4 py-3">
        <img src={profileImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{handle}</p>
          {caption ? (
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug text-slate-900 dark:text-slate-100">
              {caption}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Start a thread…</p>
          )}
          <div className="mt-3">
            <PreviewMedia {...media} aspectClass={getPreviewMediaAspect("threads", draft, { large: previewLarge })} roundedClass="rounded-lg" emptyLabel="Add image or video" />
          </div>
          <div className="mt-3 flex gap-4 text-slate-600 dark:text-slate-400">
            <Heart size={20} />
            <MessageCircle size={20} />
            <Repeat2 size={20} />
            <Send size={20} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function FacebookPreviewCard(props) {
  const { displayName, profileImage, caption, draft, composerConfig, previewLarge, ...media } = props;
  const isLink = draft?.postType === "link" || Boolean(draft?.linkUrl?.trim());

  return (
    <article className={`${cardShell} rounded-lg`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <img src={profileImage} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-slate-900 dark:text-white">{displayName}</p>
          <p className="text-xs text-slate-500">Just now · 🌎</p>
        </div>
        <MoreHorizontal size={18} className="text-slate-500" />
      </div>
      {caption ? (
        <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] text-slate-900 dark:text-slate-100">{caption}</p>
      ) : null}
      {isLink && draft?.linkUrl?.trim() ? (
        <div className="mx-4 mb-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
          <div className="aspect-[1.91/1] bg-slate-200 dark:bg-slate-800" />
          <p className="truncate px-3 py-2 text-xs font-medium text-buffer-700">{draft.linkUrl}</p>
        </div>
      ) : (
        <PreviewMedia {...media} aspectClass={getPreviewMediaAspect("facebook", draft, { large: previewLarge })} emptyLabel="Add photo or video" />
      )}
      <div className="mx-4 mb-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-500 dark:border-slate-800">
        <span>Like</span>
        <span>Comment</span>
        <span>Share</span>
      </div>
    </article>
  );
}

export function YouTubePreviewCard(props) {
  const { displayName, profileImage, caption, draft, previewLarge, ...media } = props;
  const title = draft?.youtubeTitle?.trim() || caption.slice(0, 80) || "Video title";

  return (
    <article className={`${cardShell} rounded-xl`}>
      <PreviewMedia {...media} aspectClass={getPreviewMediaAspect("youtube", draft, { large: previewLarge })} emptyLabel="Add video" />
      <div className="flex gap-3 p-3">
        <img src={profileImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{displayName}</p>
          {caption && caption !== title ? (
            <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{caption}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function PinterestPreviewCard(props) {
  const { displayName, profileImage, caption, draft, previewLarge, ...media } = props;
  const pinAspect = getPreviewMediaAspect("pinterest", draft, { large: previewLarge });

  return (
    <article className={`${cardShell} rounded-2xl`}>
      <PreviewMedia {...media} aspectClass={pinAspect} emptyLabel="Add pin image" roundedClass="rounded-t-2xl" />
      <div className="flex items-center gap-2 px-3 py-3">
        <img src={profileImage} alt="" className="h-8 w-8 rounded-full object-cover" />
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
      </div>
      {caption ? <p className="line-clamp-3 px-3 pb-3 text-sm text-slate-700 dark:text-slate-200">{caption}</p> : null}
    </article>
  );
}

export function resolvePreviewCard(platformKey) {
  const map = {
    x: XPreviewCard,
    linkedin: LinkedInPreviewCard,
    threads: ThreadsPreviewCard,
    facebook: FacebookPreviewCard,
    youtube: YouTubePreviewCard,
    pinterest: PinterestPreviewCard,
  };
  return map[platformKey] || null;
}
