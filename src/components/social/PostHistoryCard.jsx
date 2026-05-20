import { ExternalLink, ImageIcon, Link2 } from "lucide-react";

function isLikelyVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url.trim());
}

/**
 * @param {{ record: object, platformLabel: string }} props
 */
export default function PostHistoryCard({ record, platformLabel }) {
  const mediaUrl = record.mediaUrl || "";
  const linkUrl = record.linkUrl || "";
  const targetLine = [record.targetType, record.targetName || record.targetId].filter(Boolean).join(" · ");

  return (
    <article className="buffer-card overflow-hidden">
      <div className="border-b border-slate-200/90 bg-slate-50/50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{platformLabel}</p>
            <p className="mt-0.5 text-xs text-slate-500">{record.platformAccountName || record.platformAccountId || "Connected account"}</p>
            {targetLine ? <p className="mt-1 text-[11px] text-slate-400">{targetLine}</p> : null}
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
            {record.status || "Published"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <ImageIcon size={12} aria-hidden />
            {record.mediaType || "TEXT"}
          </span>
          {record.externalPostId ? (
            <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 dark:border-slate-700">ID {record.externalPostId}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {mediaUrl ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50">
            {isLikelyVideoUrl(mediaUrl) ? (
              <video src={mediaUrl} controls className="max-h-56 w-full object-contain" preload="metadata" />
            ) : (
              <img src={mediaUrl} alt="" className="max-h-56 w-full object-contain" loading="lazy" />
            )}
          </div>
        ) : null}

        {linkUrl ? (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-buffer-700 hover:border-buffer-300 dark:border-slate-600 dark:bg-slate-800 dark:text-buffer-300"
          >
            <Link2 size={14} className="shrink-0" aria-hidden />
            {linkUrl}
          </a>
        ) : null}

        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{record.content?.trim() ? record.content : "—"}</p>

        <p className="text-[11px] text-slate-500">
          Published{" "}
          {record.publishedAt
            ? new Date(record.publishedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
        </p>

        {record.externalPostUrl ? (
          <a
            href={record.externalPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-buffer-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-buffer-700"
          >
            View on platform
            <ExternalLink size={14} aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}
