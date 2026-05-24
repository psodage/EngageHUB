import PlatformBrandIcon from "../channels/PlatformBrandIcon";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import { getPlatformKeyFromCreatePostChannelKey } from "../../utils/createPostChannels";

const PLATFORM_AVATAR_RING = {
  instagram: "ring-pink-500",
  threads: "ring-slate-900 dark:ring-slate-300",
  linkedin: "ring-[#0a66c2]",
  facebook: "ring-[#1877f2]",
  x: "ring-slate-900 dark:ring-slate-200",
  youtube: "ring-red-600",
  pinterest: "ring-red-700",
  tiktok: "ring-slate-900 dark:ring-slate-200",
};

function ChannelAvatar({ channelKey, account, isActive }) {
  const platformKey = getPlatformKeyFromCreatePostChannelKey(channelKey);
  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === platformKey);
  const displayName = account?.accountName || account?.username || platformConfig?.label || "?";
  const profileImage =
    account?.profileImage ||
    `https://placehold.co/80x80/1e293b/94a3b8?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;
  const ringClass = PLATFORM_AVATAR_RING[platformKey] || "ring-buffer-500";

  return (
    <span
      title={`${displayName} · ${platformConfig?.label || platformKey}`}
      className={`relative shrink-0 rounded-xl transition ${
        isActive ? "ring-2 ring-buffer-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""
      }`}
    >
      <img
        src={profileImage}
        alt=""
        className={`h-11 w-11 rounded-xl object-cover ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${ringClass}`}
      />
      <span className="absolute -bottom-0.5 -right-0.5">
        <PlatformBrandIcon
          platformKey={platformKey}
          size="sm"
          className="!h-5 !w-5 !rounded-full [&_svg]:!h-2.5 [&_svg]:!w-2.5 ring-2 ring-white dark:ring-slate-900"
        />
      </span>
    </span>
  );
}

export default function SelectedChannelsRow({
  selectedChannelKeys,
  connectedByPlatform,
  variant = "default",
  activeChannelKey,
  onSelectChannel,
}) {
  if (!selectedChannelKeys.length) return null;

  const isHeader = variant === "header";
  const canSelect = Boolean(onSelectChannel);

  return (
    <div
      className={
        isHeader
          ? "flex flex-wrap items-center gap-3 px-5 py-3"
          : "flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800"
      }
    >
      {selectedChannelKeys.map((key) => {
        const isActive = activeChannelKey === key;
        const avatar = (
          <ChannelAvatar
            channelKey={key}
            account={connectedByPlatform[key]}
            isActive={canSelect && isActive}
          />
        );

        if (!canSelect) {
          return <span key={key}>{avatar}</span>;
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectChannel(key)}
            className={`rounded-xl transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-buffer-500 ${
              isActive ? "" : "opacity-75 hover:opacity-100"
            }`}
            aria-label={`Preview ${connectedByPlatform[key]?.accountName || SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === getPlatformKeyFromCreatePostChannelKey(key))?.label || key}`}
            aria-pressed={isActive}
          >
            {avatar}
          </button>
        );
      })}
    </div>
  );
}
