export default function DisconnectConfirmationDialog({
  open,
  platformLabel,
  singleAccount = false,
  loading,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">
          {singleAccount ? `Disconnect this ${platformLabel} account?` : `Disconnect ${platformLabel}?`}
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          {singleAccount
            ? "This removes only the selected login. Other accounts on the same platform stay connected."
            : "This will remove access tokens from EngageHub and pause posting + analytics for this channel."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}
