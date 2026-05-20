import { SOCIAL_PLATFORM_CONFIGS, isHiddenConnectPlatform } from "../data/socialPlatforms";

/** @param {import("../data/socialPlatforms").SocialAccount | Record<string, unknown>} account */
export function getChannelDisplayInfo(account) {
  const platformKey = account?.platform;
  const platformConfig = SOCIAL_PLATFORM_CONFIGS.find((p) => p.key === platformKey);
  const platformLabel = platformConfig?.label || platformKey || "Channel";
  const displayName =
    account?.accountName?.trim() ||
    account?.username?.trim()?.replace(/^@/, "") ||
    platformLabel;
  const rawUsername = account?.username?.trim();
  const handle = rawUsername ? `@${rawUsername.replace(/^@/, "")}` : null;
  const profileImage =
    account?.profileImage ||
    `https://placehold.co/80x80/e2e8f0/64748b?text=${encodeURIComponent((displayName[0] || "?").toUpperCase())}`;

  return {
    platformKey,
    platformLabel,
    platformConfig,
    displayName,
    handle,
    profileImage,
    sortKey: displayName.toLowerCase(),
  };
}

/** @param {Array<Record<string, unknown>>} accounts */
export function mapConnectedChannelsForSidebar(accounts) {
  return accounts
    .filter((account) => account.isConnected && !isHiddenConnectPlatform(account.platform))
    .map((account) => {
      const info = getChannelDisplayInfo(account);
      return {
        account,
        key: info.platformKey,
        path: `/channels/${info.platformKey}`,
        ...info,
      };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
