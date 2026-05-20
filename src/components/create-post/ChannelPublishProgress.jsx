import { CheckCircle2, Circle, Loader2, XCircle, Clock, SkipForward } from "lucide-react";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import { CHANNEL_PUBLISH_STATUS } from "../../utils/multiChannelPublish";

const STATUS_META = {
  [CHANNEL_PUBLISH_STATUS.pending]: { label: "Waiting", icon: Circle, className: "text-slate-400" },
  [CHANNEL_PUBLISH_STATUS.uploading]: { label: "Uploading media", icon: Loader2, className: "text-amber-600 animate-spin" },
  [CHANNEL_PUBLISH_STATUS.publishing]: { label: "Publishing", icon: Loader2, className: "text-buffer-600 animate-spin" },
  [CHANNEL_PUBLISH_STATUS.success]: { label: "Published", icon: CheckCircle2, className: "text-emerald-600" },
  [CHANNEL_PUBLISH_STATUS.failed]: { label: "Failed", icon: XCircle, className: "text-red-600" },
  [CHANNEL_PUBLISH_STATUS.skipped]: { label: "Skipped", icon: SkipForward, className: "text-slate-400" },
  [CHANNEL_PUBLISH_STATUS.scheduled]: { label: "Scheduled", icon: Clock, className: "text-blue-600" },
};

export default function ChannelPublishProgress({ selectedChannelKeys, channelStatuses = {}, errors = {} }) {
  if (!selectedChannelKeys.length) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Posting progress</h3>
      <ul className="mt-3 space-y-2">
        {selectedChannelKeys.map((key) => {
          const config = SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === key);
          const Icon = config?.icon;
          const status = channelStatuses[key] || CHANNEL_PUBLISH_STATUS.pending;
          const meta = STATUS_META[status] || STATUS_META.pending;
          const StatusIcon = meta.icon;
          const err = errors[key];

          return (
            <li
              key={key}
              className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                {Icon ? <Icon size={18} className="text-slate-600 dark:text-slate-300" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{config?.label || key}</p>
                <p className={`flex items-center gap-1 text-xs ${meta.className}`}>
                  <StatusIcon size={14} />
                  {meta.label}
                </p>
                {err ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
