import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import DashboardPageShell from "../components/layout/DashboardPageShell";
import PlatformBrandIcon from "../components/channels/PlatformBrandIcon";
import { useApp } from "../context/AppContext";
import { deleteScheduledPost, getScheduledPost } from "../services/scheduleApi";
import { buildScheduledPostChannelRows } from "../utils/scheduledPostChannels";

const overallStatusClass = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  publishing: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  published: "bg-buffer-50 text-buffer-800 dark:bg-buffer-500/15 dark:text-buffer-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  partially_published: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
};

const channelToneClass = {
  published: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
  publishing: "text-amber-600 dark:text-amber-400",
  scheduled: "text-blue-600 dark:text-blue-400",
  pending: "text-slate-500 dark:text-slate-400",
};

const channelToneIcon = {
  published: CheckCircle2,
  failed: XCircle,
  publishing: Loader2,
  scheduled: Clock,
  pending: Circle,
};

function formatScheduledAt(iso, timezone) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone === "UTC" ? "UTC" : undefined,
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function formatPublishedAt(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export default function ScheduledPostDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setToast } = useApp();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const row = await getScheduledPost(id);
      setPost(row);
    } catch (err) {
      setError(err?.message || "Could not load scheduled post.");
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const channelRows = post ? buildScheduledPostChannelRows(post) : [];
  const publishedCount = channelRows.filter((r) => r.tone === "published").length;
  const failedCount = channelRows.filter((r) => r.tone === "failed").length;

  const handleDelete = async () => {
    if (!post || post.status !== "scheduled" || deleting) return;
    setDeleting(true);
    try {
      await deleteScheduledPost(post._id);
      setToast({ message: "Scheduled post removed from queue." });
      navigate("/schedule");
    } catch (err) {
      setToast({ message: err?.message || "Delete failed.", error: true });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardPageShell
      title="Scheduled post"
      description="Publish status for each channel on this scheduled post."
      actions={
        <Link
          to="/schedule"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          <ArrowLeft size={14} />
          Back to schedule
        </Link>
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Loading post…
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {!loading && !error && post ? (
        <div className="space-y-6">
          <article className="buffer-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {post.title || post.caption?.slice(0, 80) || "Untitled"}
                </h3>
                {post.caption ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{post.caption}</p>
                ) : null}
                <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                  <CalendarClock size={16} />
                  Scheduled for {formatScheduledAt(post.scheduledAt, post.timezone)}
                  {post.timezone && post.timezone !== "UTC" ? ` (${post.timezone})` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    overallStatusClass[post.status] || overallStatusClass.scheduled
                  }`}
                >
                  {(post.status || "scheduled").replace(/_/g, " ")}
                </span>
                <p className="text-xs text-slate-500">
                  {publishedCount} published · {failedCount} not published
                </p>
              </div>
            </div>

            {post.mediaUrl ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                {/\.(mp4|mov|webm)(\?|#|$)/i.test(post.mediaUrl) ? (
                  <video src={post.mediaUrl} controls className="max-h-64 w-full bg-black" />
                ) : (
                  <img src={post.mediaUrl} alt="" className="max-h-64 w-full object-cover" />
                )}
              </div>
            ) : null}

            {post.lastError ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {post.lastError}
              </p>
            ) : null}
          </article>

          <article className="buffer-card overflow-hidden">
            <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Channel publish status</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Whether each selected channel published successfully when this post ran.
              </p>
            </header>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {channelRows.map((row) => {
                const StatusIcon = channelToneIcon[row.tone] || Circle;
                const iconClass = channelToneClass[row.tone] || channelToneClass.pending;
                const publishedLabel = formatPublishedAt(row.publishedAt);

                return (
                  <li key={row.channelKey} className="flex items-start gap-4 px-5 py-4">
                    <PlatformBrandIcon platformKey={row.platformKey} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">{row.label}</p>
                      <p className={`mt-0.5 flex items-center gap-1.5 text-sm font-medium ${iconClass}`}>
                        <StatusIcon
                          size={16}
                          className={row.tone === "publishing" ? "animate-spin" : undefined}
                        />
                        {row.statusLabel}
                      </p>
                      {row.error ? (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{row.error}</p>
                      ) : null}
                      {publishedLabel ? (
                        <p className="mt-1 text-xs text-slate-500">Published at {publishedLabel}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>

          {post.status === "scheduled" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
              >
                {deleting ? "Removing…" : "Remove from queue"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </DashboardPageShell>
  );
}
