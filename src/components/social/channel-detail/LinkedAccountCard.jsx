import { AlertTriangle, CheckCircle2, PenLine } from "lucide-react";
import PlatformBrandIcon from "../../channels/PlatformBrandIcon";

export default function LinkedAccountCard({
  entity,
  platformKey,
  fallbackImage,
  entityIcon: EntityIcon,
  onDisconnect,
  disconnecting = false,
}) {
  const name = entity.accountName || entity.name || entity.username || "Untitled";
  const typeLabel = (entity.entityType || "account").replace(/_/g, " ");
  const connected = entity.isConnected !== false;
  const image = entity.profileImage || fallbackImage;

  return (
    <li className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <img
            src={image}
            alt=""
            className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-600"
          />
          <span className="absolute -bottom-1 -right-1">
            <PlatformBrandIcon platformKey={platformKey} size="sm" className="ring-2 ring-white dark:ring-slate-900" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {EntityIcon ? <EntityIcon size={12} className="shrink-0 text-slate-400" /> : null}
            {name}
          </p>
          <p className="mt-0.5 truncate text-xs capitalize text-slate-500">{typeLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:bg-slate-900">
              <PenLine size={10} className="text-buffer-600" aria-hidden />
              Posting
            </span>
            {connected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} aria-hidden />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle size={12} aria-hidden />
                Attention
              </span>
            )}
            {typeof onDisconnect === "function" ? (
              <button
                type="button"
                disabled={disconnecting}
                onClick={onDisconnect}
                className="inline-flex items-center rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
