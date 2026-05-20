export default function ConnectButton({
  isConnected,
  isProcessing,
  onConnect,
  onReconnect,
  onAddAccount,
  connectLabel = "Connect",
  connectDisabled = false,
}) {
  const blocked = connectDisabled || isProcessing;

  if (!isConnected) {
    return (
      <button
        onClick={onConnect}
        disabled={blocked}
        className="rounded-lg bg-buffer-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProcessing ? "Connecting..." : connectLabel}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {typeof onAddAccount === "function" ? (
        <button
          type="button"
          onClick={onAddAccount}
          disabled={blocked}
          className="rounded-lg bg-buffer-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-buffer-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProcessing ? "Connecting..." : "Add account"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onReconnect}
        disabled={blocked}
        className="rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isProcessing ? "Processing..." : "Reconnect"}
      </button>
    </div>
  );
}
