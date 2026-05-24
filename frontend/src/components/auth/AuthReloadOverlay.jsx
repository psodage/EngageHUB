export default function AuthReloadOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#e4ebe8]"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-600">Loading…</p>
      </div>
    </div>
  );
}
