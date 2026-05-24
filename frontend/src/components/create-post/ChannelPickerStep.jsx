import { Check } from "lucide-react";
import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { getPlatformKeyFromCreatePostChannelKey } from "../../utils/createPostChannels";

function profilePlaceholder(displayName, platformName) {
  const initial = (displayName?.[0] || platformName?.[0] || "?").toUpperCase();
  return `https://placehold.co/96x96/e2e8f0/64748b?text=${encodeURIComponent(initial)}`;
}

function ChannelPickerCard({ option, isSelected, onToggle }) {
  const platformKey = option.platformKey || getPlatformKeyFromCreatePostChannelKey(option.key);
  const platformName = option.platformName || option.label;
  const username = option.username || option.accountDisplayName || option.label || "";
  const accountTypeLabel = option.accountTypeLabel || "";
  const disabled = Boolean(option.publishDisabled);
  const disabledReason = option.publishDisabledReason || "";
  const profileSrc =
    option.profileImage || profilePlaceholder(option.accountDisplayName || username, platformName);

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => !disabled && onToggle(option.key)}
      className={`buffer-card flex w-full items-center gap-3 p-4 text-left transition ring-2 ${
        disabled
          ? "cursor-not-allowed opacity-60 ring-transparent"
          : isSelected
            ? "border-buffer-400 ring-buffer-200 dark:border-buffer-500/50 dark:ring-buffer-500/30"
            : "ring-transparent hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      <span className="relative shrink-0">
        <img src={profileSrc} alt="" className="h-12 w-12 rounded-xl object-cover" />
        <span className="absolute -bottom-0.5 -right-0.5">
          <PlatformBrandIcon
            platformKey={platformKey}
            size="sm"
            className="!h-[18px] !w-[18px] !rounded-md [&_svg]:!h-2.5 [&_svg]:!w-2.5 ring-2 ring-white dark:ring-slate-900"
          />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900 dark:text-white">{username}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{platformName}</p>
        {accountTypeLabel ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{accountTypeLabel}</p>
        ) : null}
        {disabled && disabledReason ? (
          <p className="mt-1 text-[11px] leading-snug text-amber-800 dark:text-amber-200/90">{disabledReason}</p>
        ) : null}
      </span>

      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          isSelected ? "border-buffer-600 bg-buffer-600 text-white" : "border-slate-300 dark:border-slate-600"
        }`}
        aria-hidden
      >
        {isSelected ? <Check size={14} /> : null}
      </span>
    </button>
  );
}

export default function ChannelPickerStep({
  title = "Create post",
  subtitle = "Select channels and compose content to publish now.",
  maxWidthClass,
  continueLabel = "Continue",
  connectedPlatformConfigs,
  selectedKeys,
  onToggle,
  onSelectAll,
  onClearAll,
  onContinue,
}) {
  const canContinue = selectedKeys.length > 0;
  const allSelected = connectedPlatformConfigs.length > 0 && selectedKeys.length === connectedPlatformConfigs.length;
  const widthClass = maxWidthClass || "max-w-4xl";

  return (
    <section className={`mx-auto space-y-6 ${widthClass}`}>
      <header>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className="text-xs font-semibold text-buffer-700 hover:text-buffer-800 disabled:opacity-50 dark:text-buffer-400"
          >
            Select all
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={onClearAll}
            disabled={!selectedKeys.length}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </header>

      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          {connectedPlatformConfigs.map((option) => (
            <ChannelPickerCard
              key={option.key}
              option={option}
              isSelected={selectedKeys.includes(option.key)}
              onToggle={onToggle}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="rounded-lg bg-buffer-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {continueLabel} ({selectedKeys.length} channel{selectedKeys.length === 1 ? "" : "s"})
          </button>
        </div>
      </div>
    </section>
  );
}
