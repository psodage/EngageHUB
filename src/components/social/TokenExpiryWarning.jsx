export default function TokenExpiryWarning({ account }) {
  if (!account?.isConnected) return null;
  if (account?.isTokenExpired) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        Token expired — reconnect this channel from Connect channels.
      </p>
    );
  }
  if (!account?.expiresAt) {
    return <p className="text-xs text-slate-500">No token expiry reported by the provider.</p>;
  }
  const expiry = new Date(account.expiresAt).toLocaleString();
  return (
    <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
      Token valid until {expiry}
    </p>
  );
}
