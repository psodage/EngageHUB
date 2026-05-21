import { ArrowLeft, X } from "lucide-react";
import PostIdeasPanel from "./PostIdeasPanel";
import { WORKSPACE_PREVIEW_SCROLL } from "./workspaceLayout";

export default function PreviewIdeasBoard({
  focus = "both",
  caption,
  onApplyCaption,
  selectedPlatform,
  topic,
  onTopicChange,
  onClose,
  onApplied,
}) {
  const handleApply = (text) => {
    onApplyCaption?.(text);
    onApplied?.();
  };

  const title =
    focus === "templates" ? "Templates" : focus === "ai" ? "AI Assistant" : "Ideas & AI";

  return (
    <aside className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`${WORKSPACE_PREVIEW_SCROLL} flex min-h-0 flex-1 flex-col`}>
        <div className="sticky top-0 z-10 -mx-1 mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-1 pb-3 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={16} />
            Post previews
          </button>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <PostIdeasPanel
          embedded
          section={focus}
          caption={caption}
          onApplyCaption={handleApply}
          selectedPlatform={selectedPlatform}
          topic={topic}
          onTopicChange={onTopicChange}
        />
      </div>
    </aside>
  );
}
