import { Loader2, X } from "lucide-react";

export default function SuggestedMediaStrip({
  images,
  loading,
  error,
  selectedUrl = "",
  onSelect,
  onDismiss,
}) {
  return (
    <section
      className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-950/60"
      aria-label="Suggested media from link"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Suggested media</h3>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Hide suggested media"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Make sure you have the rights to use the suggested media.
      </p>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" role="status">
          <Loader2 size={16} className="animate-spin text-buffer-600" />
          <span>Loading images from link…</span>
        </div>
      ) : images.length > 0 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {images.map((url) => {
            const selected = selectedUrl === url;
            return (
              <li key={url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(url)}
                  className={`relative block h-20 w-20 overflow-hidden rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-buffer-500 sm:h-24 sm:w-24 ${
                    selected
                      ? "border-buffer-600 ring-2 ring-buffer-200 dark:ring-buffer-500/30"
                      : "border-transparent hover:border-buffer-400"
                  }`}
                  aria-label="Use suggested image"
                  aria-pressed={selected}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400" role="status">
          {error || "No images found for this link."}
        </p>
      )}
    </section>
  );
}

