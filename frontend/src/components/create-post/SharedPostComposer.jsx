import { useRef } from "react";
import { useObjectUrl } from "../../utils/useObjectUrl";
import { useUrlMediaSuggestions } from "../../hooks/useUrlMediaSuggestions";
import { ChevronDown, Hash, ImagePlus, Plus, Smile } from "lucide-react";
import SuggestedMediaStrip from "./SuggestedMediaStrip";

export default function SharedPostComposer({
  caption,
  file,
  mediaUrl = "",
  captionLimit,
  linkedInMediaImporting = false,
  onCaptionChange,
  onFileChange,
  onSuggestedImageSelect,
  onClearSuggestedMedia,
}) {
  const fileInputRef = useRef(null);
  const previewUrl = useObjectUrl(file);
  const { images, loading, error, visible, dismiss } = useUrlMediaSuggestions(caption);

  const showSuggestions = visible && !file;
  const suggestedPreviewUrl = !file && mediaUrl ? mediaUrl : null;

  const handleRemoveMedia = () => {
    onFileChange(null);
    if (suggestedPreviewUrl) onClearSuggestedMedia?.();
  };

  return (
    <article className="bg-white dark:bg-slate-900">
      <div className="p-4">
        <textarea
          rows={8}
          maxLength={captionLimit}
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Start writing or get inspired with Templates"
          className="w-full resize-none border-0 bg-transparent px-0 py-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
        />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className="flex h-[88px] w-[88px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/80 text-center transition hover:border-buffer-400 hover:bg-buffer-50/50 dark:border-slate-600 dark:bg-slate-950/50"
          >
            {previewUrl && file ? (
              file.type?.startsWith("video/") ? (
                <video src={previewUrl} className="h-full w-full rounded-md object-cover" muted />
              ) : (
                <img src={previewUrl} alt="" className="h-full w-full rounded-md object-cover" />
              )
            ) : suggestedPreviewUrl ? (
              <img src={suggestedPreviewUrl} alt="" className="h-full w-full rounded-md object-cover" />
            ) : (
              <>
                <ImagePlus size={22} className="text-slate-400" />
                <p className="mt-1 px-1 text-[10px] leading-tight text-slate-500">Drag & drop or select a file</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {file || suggestedPreviewUrl ? (
            <button
              type="button"
              onClick={handleRemoveMedia}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Remove media
            </button>
          ) : null}
        </div>

        {linkedInMediaImporting ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
          >
            Importing image for posting…
          </p>
        ) : null}

        {showSuggestions ? (
          <SuggestedMediaStrip
            images={images}
            loading={loading}
            error={error}
            selectedUrl={mediaUrl}
            onSelect={onSuggestedImageSelect}
            onDismiss={dismiss}
          />
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1 text-slate-400">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Add media"
            >
              <Plus size={18} />
            </button>
            <button type="button" className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="More options">
              <ChevronDown size={18} />
            </button>
            <button type="button" className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Add emoji">
              <Smile size={18} />
            </button>
            <button type="button" className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Hashtag">
              <Hash size={18} />
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {caption.length} / {captionLimit}
          </span>
        </div>
      </div>
    </article>
  );
}
