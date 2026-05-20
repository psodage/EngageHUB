import { ArrowRight } from "lucide-react";

export default function PostingTargetCard({ card, badge: Badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white text-left shadow-card transition hover:border-buffer-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-buffer-500/40"
    >
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <img
          src={card.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-600"
        />
        <div className="min-w-0 flex-1">
          {Badge ? <Badge badge={card.badge} /> : null}
          <p className="mt-2 truncate text-base font-semibold text-slate-900 dark:text-white">{card.title}</p>
          <p className="mt-1 text-sm text-slate-500">{card.sublabel}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-buffer-700 transition-colors group-hover:bg-buffer-50/80 dark:border-slate-700 dark:bg-slate-800/50 dark:text-buffer-300 dark:group-hover:bg-buffer-500/10 sm:px-5">
        <span>Create post as this target</span>
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </button>
  );
}
