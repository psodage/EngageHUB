import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Filter, LayoutGrid, List, Loader2 } from "lucide-react";
import DashboardPageShell from "../components/layout/DashboardPageShell";
import { SOCIAL_PLATFORM_CONFIGS } from "../data/socialPlatforms";
import { deleteScheduledPost, listScheduledPosts } from "../services/scheduleApi";

const statusClass = {
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

export default function SchedulePage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listScheduledPosts();
      setPosts(rows);
    } catch (err) {
      setError(err?.message || "Could not load queue.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    try {
      await deleteScheduledPost(id);
      setPosts((prev) => prev.filter((p) => String(p._id) !== String(id)));
    } catch (err) {
      setError(err?.message || "Delete failed.");
    }
  };

  return (
    <DashboardPageShell
      description="Your queued and scheduled content across all connected channels."
      actions={
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <Filter size={14} />
            All channels
          </button>
          <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600">
            <button type="button" className="rounded-md bg-slate-100 p-2 dark:bg-slate-800" aria-label="List view">
              <List size={14} />
            </button>
            <button type="button" className="rounded-md p-2 text-slate-400" aria-label="Calendar view">
              <LayoutGrid size={14} />
            </button>
          </div>
          <Link
            to="/schedule/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-buffer-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-buffer-700"
          >
            <CalendarClock size={16} />
            Schedule post
          </Link>
        </>
      }
    >
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <article className="buffer-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                <th className="p-5 font-semibold">Post</th>
                <th className="p-5 font-semibold">Channels</th>
                <th className="p-5 font-semibold">Scheduled</th>
                <th className="p-5 font-semibold">Status</th>
                <th className="p-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
                    Loading scheduled posts…
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    No scheduled posts yet.{" "}
                    <Link to="/schedule/new" className="font-semibold text-buffer-700 dark:text-buffer-400">
                      Schedule a post
                    </Link>
                  </td>
                </tr>
              ) : (
                posts.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/30"
                  >
                    <td className="p-5 font-medium text-slate-900 dark:text-white">
                      {row.title || row.caption?.slice(0, 60) || "Untitled"}
                    </td>
                    <td className="p-5 text-slate-600 dark:text-slate-300">{channelLabels(row.channelKeys)}</td>
                    <td className="p-5 text-slate-500">{formatScheduledAt(row.scheduledAt, row.timezone)}</td>
                    <td className="p-5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          statusClass[row.status] || statusClass.scheduled
                        }`}
                      >
                        {(row.status || "scheduled").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      {row.status === "scheduled" ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(row._id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </DashboardPageShell>
  );
}
