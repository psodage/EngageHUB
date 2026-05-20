import { memo, useMemo } from "react";
import { getCreatePostChannelLabel, getPlatformKeyFromCreatePostChannelKey } from "../../utils/createPostChannels";
import { useObjectUrl } from "../../utils/useObjectUrl";
import { buildDraftFromShared } from "../../utils/sharedPostSync";
import PlatformPostPreview from "./PlatformPostPreview";

function buildPreviewDraft(platformKey, sharedCaption, sharedFile, channelDraft = {}) {
  const built = buildDraftFromShared(platformKey, {
    caption: sharedCaption || channelDraft.caption || "",
    file: sharedFile || channelDraft.file || null,
    mediaUrl: channelDraft.mediaUrl || "",
  });
  return {
    ...built,
    postType: channelDraft.postType ?? built.postType,
    linkUrl: channelDraft.linkUrl ?? built.linkUrl,
    youtubeTitle: channelDraft.youtubeTitle ?? built.youtubeTitle,
    firstComment: channelDraft.firstComment ?? built.firstComment,
  };
}

function draftOverrideKey(drafts, keys) {
  return keys
    .map(
      (k) =>
        `${k}:${drafts[k]?.postType ?? ""}:${drafts[k]?.linkUrl ?? ""}:${drafts[k]?.youtubeTitle ?? ""}:${drafts[k]?.firstComment ?? ""}:${drafts[k]?.mediaUrl ?? ""}`
    )
    .join("|");
}

const PreviewCell = memo(function PreviewCell({
  channelKey,
  draft,
  account,
  mediaPreviewUrl,
  previewSize,
  compact,
}) {
  const platformKey = getPlatformKeyFromCreatePostChannelKey(channelKey);
  return (
    <PlatformPostPreview
      platformKey={platformKey}
      account={account}
      draft={draft}
      mediaPreviewUrl={mediaPreviewUrl}
      size={previewSize}
      compact={compact}
    />
  );
});

export default function MultiChannelPreviewGrid({
  selectedChannelKeys,
  connectedByPlatform,
  sharedCaption = "",
  sharedFile = null,
  drafts = {},
  channelStatuses = {},
  variant = "picker",
  compact = false,
}) {
  const isWorkspace = variant === "workspace";
  const sharedMediaUrl = useObjectUrl(sharedFile);
  const channelKeysKey = selectedChannelKeys.join(",");
  const draftOverridesKey = draftOverrideKey(drafts, selectedChannelKeys);

  const previews = useMemo(
    () =>
      selectedChannelKeys.map((key) => ({
        key,
        draft: buildPreviewDraft(key, sharedCaption, sharedFile, drafts[key]),
      })),
    [channelKeysKey, sharedCaption, sharedFile, draftOverridesKey]
  );

  const previewSize = isWorkspace ? "workspace" : "default";
  const showCompact = !isWorkspace && compact;

  if (!previews.length) return null;

  return (
    <section className={isWorkspace ? "flex w-full flex-col" : "space-y-3"}>
      {!isWorkspace ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          All channels ({previews.length})
        </p>
      ) : null}

      <div
        className={
          isWorkspace
            ? "flex w-full flex-col items-center gap-6"
            : `grid gap-4 ${showCompact ? "max-h-[520px] overflow-y-auto pr-1 grid-cols-1" : previews.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`
        }
      >
        {previews.map(({ key, draft }) => {
          const status = channelStatuses[key];
          const label = getCreatePostChannelLabel(key);

          return (
            <article
              key={key}
              id={`channel-preview-${key}`}
              className="relative w-full max-w-[340px] scroll-mt-3"
            >
              {status ? (
                <span
                  className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    status === "published" || status === "success"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                      : status === "failed"
                        ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200"
                        : status === "publishing" || status === "uploading"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                          : status === "scheduled"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
                            : status === "skipped"
                              ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {status}
                </span>
              ) : null}
              <PreviewCell
                channelKey={key}
                draft={draft}
                account={connectedByPlatform[key]}
                mediaPreviewUrl={sharedMediaUrl}
                previewSize={previewSize}
                compact={!isWorkspace}
              />
              {!isWorkspace && !showCompact ? (
                <p className="mt-1 text-center text-[10px] font-medium text-slate-500">{label}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
