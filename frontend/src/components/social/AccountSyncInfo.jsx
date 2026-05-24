function fromNow(value) {
  if (!value) return "Never synced";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
  if (hours < 24) return `Last synced ${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  return `Last synced ${days} day${days > 1 ? "s" : ""} ago`;
}

export default function AccountSyncInfo({ account }) {
  return (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      {fromNow(account?.lastSyncedAt)} {account?.isConnected ? "• Active for posting and analytics" : ""}
    </p>
  );
}
