import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getPostHistory } from "../../services/socialApi";
import { SOCIAL_PLATFORM_CONFIGS } from "../../data/socialPlatforms";
import PostHistoryCard from "./PostHistoryCard";
import PostHistoryFilters from "./PostHistoryFilters";

function platformLabel(key) {
  return SOCIAL_PLATFORM_CONFIGS.find((p) => p.key === key)?.label || key;
}

/**
 * @param {{ platformKey: string, targetId?: string, refreshKey?: number }} props
 */
export default function PostHistoryPanel({ platformKey, targetId = "", refreshKey = 0 }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchPage = useCallback(
    async (page) => {
      setLoading(true);
      setLoadError(false);
      try {
        const { records: rows, pagination: pg } = await getPostHistory({
          platform: platformKey,
          targetId: targetId || undefined,
          mediaType: mediaType || undefined,
          search: searchApplied || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit: 10,
        });
        setRecords(rows);
        setPagination(pg);
      } catch {
        setLoadError(true);
        setRecords([]);
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
      } finally {
        setLoading(false);
      }
    },
    [platformKey, targetId, mediaType, searchApplied, startDate, endDate]
  );

  useEffect(() => {
    const t = setTimeout(() => setSearchApplied(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage, refreshKey]);

  const page = pagination.page || 1;
  const totalPages = pagination.totalPages || 0;
  const label = platformLabel(platformKey);

  return (
    <div className="channel-history-panel space-y-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Published post history</h2>
        <p className="mt-1 text-sm text-slate-500">Successfully published posts from this app for {label}.</p>
      </header>

      <PostHistoryFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        mediaType={mediaType}
        onMediaTypeChange={setMediaType}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="animate-spin" size={20} aria-hidden />
          Loading history…
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Unable to load post history. Please try again.
        </div>
      ) : null}

      {!loading && !loadError && !records.length ? (
        <p className="py-12 text-center text-sm text-slate-500">No published posts yet.</p>
      ) : null}

      {!loading && !loadError && records.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {records.map((record) => (
            <li key={record._id}>
              <PostHistoryCard record={record} platformLabel={label} />
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !loadError && totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700">
          <p>
            Page {page} of {totalPages} · {pagination.total ?? 0} posts
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchPage(page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => fetchPage(page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
