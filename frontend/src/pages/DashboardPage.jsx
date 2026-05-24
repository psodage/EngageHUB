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

export default function DashboardPage() {
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
    } catch (err) {
      setLoadError(err?.message || "Could not load your queue.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const { scheduledThisWeek, publishedCount, inQueue } = useMemo(() => computeDashboardStats(posts), [posts]);
  const queuePreview = useMemo(() => buildQueuePreview(posts), [posts]);

  const statValue = (value) => (loading ? "—" : value);

  return (
    <div className="space-y-8">
      <header className="buffer-card p-6 sm:p-8">
        <p className="text-sm font-medium text-buffer-700 dark:text-buffer-400">Welcome back</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Hi {firstName}, plan your week</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Buffer-style home: see your queue, connect channels, and jump into publishing.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/create-post"
            className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-buffer-700"
          >
            <PenSquare size={16} />
            Create
          </Link>
          <Link
            to="/channels"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Radio size={16} />
            {connectedCount > 0 ? "Manage channels" : "Connect channels"}
          </Link>
        </div>
      </header>

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {loadError}{" "}
          <button type="button" onClick={loadPosts} className="font-semibold underline">
            Retry
          </button>
        </p>
      ) : null}

      <section aria-label="Overview stats" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Connected channels", value: connectedCount, icon: Radio, to: "/channels" },
          { label: "Scheduled this week", value: statValue(scheduledThisWeek), icon: CalendarDays, to: "/schedule" },
          { label: "Posts published", value: statValue(publishedCount), icon: CheckCircle2, to: "/schedule" },
          { label: "In queue", value: statValue(inQueue), icon: Clock3, to: "/schedule" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} to={stat.to} className="buffer-card group p-4 transition hover:ring-2 hover:ring-buffer-200 dark:hover:ring-buffer-500/30">
              <div className="flex items-center justify-between">
                <Icon size={18} className="text-slate-400 group-hover:text-buffer-600" />
                <ArrowRight size={14} className="text-slate-300 opacity-0 transition group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
            </Link>
          );
        })}
      </section>

      <section aria-label="Queue and actions" className="grid gap-6 lg:grid-cols-5">
        <article className="buffer-card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Publishing queue</h3>
              <p className="text-xs text-slate-500">Upcoming posts across all channels</p>
            </div>
            <Link to="/schedule" className="text-xs font-semibold text-buffer-700 hover:text-buffer-800 dark:text-buffer-400">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={20} />
              Loading queue…
            </div>
          ) : queuePreview.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No posts in your queue.{" "}
              <Link to="/schedule/new" className="font-semibold text-buffer-700 dark:text-buffer-400">
                Schedule a post
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {queuePreview.map((post) => (
                <li key={post.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{post.title}</p>
                    <p className="text-xs text-slate-500">{post.channels || "No channels"}</p>
                  </div>
                  <span className="text-xs text-slate-500">{post.time}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                      statusStyles[post.status] || statusStyles.scheduled
                    }`}
                  >
                    {(post.status || "scheduled").replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="buffer-card lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Quick actions</h3>
          </div>
          <ul className="p-3 space-y-1">
            {[
              { label: "Create post", desc: "Compose and publish to multiple channels", to: "/create-post", icon: PenSquare },
              { label: "Schedule post", desc: "Queue content for later", to: "/schedule/new", icon: CalendarDays },
              { label: "View scheduled", desc: "Your scheduled queue", to: "/schedule", icon: CalendarDays },
              { label: "Channel settings", desc: "Connections and OAuth", to: "/settings/channels", icon: Radio },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-slate-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      {connectedCount === 0 ? (
        <div className="buffer-card flex flex-col items-start gap-3 border-buffer-200 bg-buffer-50/40 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-buffer-500/20 dark:bg-buffer-500/5">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Connect your first channel</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Link Instagram, LinkedIn, X, and more to start scheduling from one place.
            </p>
          </div>
          <Link
            to="/channels"
            className="inline-flex items-center gap-2 rounded-lg bg-buffer-600 px-4 py-2 text-sm font-semibold text-white hover:bg-buffer-700"
          >
            Connect channels
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
