import { PenSquare } from "lucide-react";
import PostingTargetCard from "./PostingTargetCard";
import ChannelProfileSection from "./ChannelProfileSection";

export default function ChannelCreatePanel({
  postingTargets,
  showPrimaryCta,
  onPrimaryCreate,
  onTargetCreate,
  TargetBadge,
  label,
  onOpenComposer,
}) {
  if (!postingTargets) {
    return (
      <ChannelProfileSection
        title="Create post"
        description={`Publishing shortcuts for ${label} are not configured in this view yet.`}
        className="!border-0 !bg-transparent"
      >
        <button
          type="button"
          onClick={onOpenComposer}
          className="channel-profile-btn channel-profile-btn--primary"
        >
          <PenSquare size={16} aria-hidden />
          Open composer
        </button>
      </ChannelProfileSection>
    );
  }

  return (
    <div className="channel-create-panel space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{postingTargets.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{postingTargets.description}</p>
        </div>
        {showPrimaryCta ? (
          <button
            type="button"
            onClick={onPrimaryCreate}
            className="channel-profile-btn channel-profile-btn--primary shrink-0"
          >
            <PenSquare size={16} aria-hidden />
            {postingTargets.primaryCtaLabel || "Create post"}
          </button>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {postingTargets.cards.map((card) => (
          <PostingTargetCard
            key={card.key}
            card={card}
            badge={TargetBadge}
            onClick={() => onTargetCreate(card)}
          />
        ))}
      </div>

      {postingTargets.emptyBanner ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            postingTargets.emptyBanner.tone === "amber"
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
          }`}
        >
          {postingTargets.emptyBanner.text}
        </div>
      ) : null}
    </div>
  );
}
