import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, PenSquare, Radio, ArrowRight, Clock3, CheckCircle2, Loader2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { listScheduledPosts } from "../services/scheduleApi";

const statusStyles = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  publishing: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  published: "bg-buffer-50 text-buffer-800 dark:bg-buffer-500/15 dark:text-buffer-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  partially_published: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
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

function channelLabels(keys) {
  return (keys || [])
    .map((k) => SOCIAL_PLATFORM_CONFIGS.find((c) => c.key === k)?.label || k)
    .join(", ");
}

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function computeDashboardStats(posts) {
  const { start: weekStart, end: weekEnd } = getWeekBounds();

  let scheduledThisWeek = 0;
  let publishedCount = 0;
  let inQueue = 0;

  for (const post of posts) {
    const status = post.status || "scheduled";
    const at = post.scheduledAt ? new Date(post.scheduledAt).getTime() : NaN;

    if (status === "published" || status === "partially_published") {
      publishedCount += 1;
    }

    if (status === "scheduled") {
      inQueue += 1;
      if (!Number.isNaN(at) && at >= weekStart.getTime() && at < weekEnd.getTime()) {
        scheduledThisWeek += 1;
      }
    }
  }

  return { scheduledThisWeek, publishedCount, inQueue };
}

function buildQueuePreview(posts) {
  return posts
    .filter((p) => (p.status || "scheduled") === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 3)
    .map((post) => ({
      id: String(post._id),
      title: post.title || post.caption?.slice(0, 60) || "Untitled",
      channels: channelLabels(post.channelKeys),
      time: formatScheduledAt(post.scheduledAt, post.timezone),
      status: post.status || "scheduled",
    }));
}

export default function BusinessDashboard() {
  const { connectedAccounts, user } = useApp();
  const connectedCount = connectedAccounts.filter((a) => a.isConnected).length;
  const firstName = (user.name || "there").split(" ")[0];

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await listScheduledPosts();
      setPosts(rows);
    } catch (error) {
      setLoadError(error?.message || "Unable to load scheduled posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = useMemo(() => computeDashboardStats(posts), [posts]);
  const queuePreview = useMemo(() => buildQueuePreview(posts), [posts]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const cards = [
    {
      key: "scheduled",
      label: "Posts Scheduled This Week",
      value: loading ? "…" : stats.scheduledThisWeek,
      icon: CalendarDays,
    },
    {
      key: "published",
      label: "Published Posts",
      value: loading ? "…" : stats.publishedCount,
      icon: CheckCircle2,
    },
    {
      key: "in-queue",
      label: "Posts in Queue",
      value: loading ? "…" : stats.inQueue,
      icon: Clock3,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Good to see you, {firstName}!
        </h1>
        <p className="text-sm text-slate-600">
          Welcome to your business dashboard. Manage your schedule and see your latest activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700">
                  <Icon size={20} />
                </div>
                <span className="text-2xl font-bold text-slate-900">{card.value}</span>
              </div>
              <p className="text-sm text-slate-600">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700">
              <Radio size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Next in Queue
              </p>
              <p className="text-xs text-slate-500">
                {connectedCount} {connectedCount === 1 ? "channel" : "channels"} connected
              </p>
            </div>
          </div>
          <Link
            to="/schedule"
            className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-600"
          >
            View Schedule
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
              <Loader2 size={24} className="animate-spin text-slate-500" />
              <p className="text-sm text-slate-500">Loading your posts…</p>
            </div>
          ) : loadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
              <p className="text-sm text-red-600">{loadError}</p>
              <button
                type="button"
                onClick={loadPosts}
                className="text-sm font-semibold text-brand-700 hover:text-brand-600"
              >
                Retry
              </button>
            </div>
          ) : queuePreview.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-12">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                <PenSquare size={32} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900">
                  No posts scheduled yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first post to get started.
                </p>
              </div>
              <Link
                to="/create"
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
              >
                Create Post
              </Link>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Upcoming Posts
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {queuePreview.map((post, idx) => (
                  <div
                    key={post.id}
                    className={`flex items-center justify-between gap-4 px-5 py-4 ${
                      idx !== queuePreview.length - 1 ? "border-b border-slate-200" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {post.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {post.channels}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{post.time}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[post.status]}`}
                      >
                        {post.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 px-5 py-3">
                <Link
                  to="/schedule"
                  className="flex items-center justify-between text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>View full schedule</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
