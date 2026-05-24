import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Flame, GitFork, RefreshCw, Star, Users, FolderGit2, UserPlus } from "lucide-react";
import GitHubStatCard from "./GitHubStatCard";
import GitHubReposGrid from "./GitHubReposGrid";
import GitHubActivityFeed from "./GitHubActivityFeed";
import GitHubActivityCardComposer from "./GitHubActivityCardComposer";
import { getGitHubActivity, getGitHubAnalytics, getGitHubRepos, syncGitHubAccount } from "../../services/githubApi";

export default function GitHubDashboard({ account, setToast, onSyncComplete }) {
  const [analytics, setAnalytics] = useState(null);
  const [repos, setRepos] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);

  const meta = account?.metadata || analytics?.profile?.metadata || {};
  const profileUrl = meta.profileUrl || (account?.username ? `https://github.com/${account.username}` : "");

  const loadData = useCallback(async () => {
    setLoading(true);
    setActivityLoading(true);
    try {
      const [analyticsRes, reposRes, activityRes] = await Promise.all([
        getGitHubAnalytics(),
        getGitHubRepos({ perPage: 30 }),
        getGitHubActivity({ perPage: 25 }),
      ]);
      setAnalytics(analyticsRes);
      setRepos(reposRes?.repos || []);
      setActivity(activityRes?.activity || []);
    } catch (err) {
      setToast?.({ message: err.message || "Failed to load GitHub data.", error: true });
    } finally {
      setLoading(false);
      setActivityLoading(false);
    }
  }, [setToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await syncGitHubAccount();
      setAnalytics(data);
      setRepos(data?.repos || []);
      onSyncComplete?.();
      setToast?.({ message: "GitHub profile and repositories synced." });
    } catch (err) {
      setToast?.({ message: err.message || "Sync failed.", error: true });
    } finally {
      setSyncing(false);
    }
  };

  const stats = analytics?.stats || {
    repositoriesCount: meta.repositoriesCount ?? 0,
    followers: meta.followers ?? 0,
    following: meta.following ?? 0,
    totalStars: meta.totalStars ?? 0,
    totalForks: meta.totalForks ?? 0,
    contributionStreak: meta.contributionStreak,
  };

  const topRepos = analytics?.topRepositories || meta.topRepositories || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-lg font-semibold text-white">GitHub analytics</h3>
          <p className="text-sm text-slate-400">
            {account?.username ? `@${account.username}` : "Developer profile"} · repositories & activity
          </p>
        </motion.div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-500/40 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <GitHubStatCard label="Repositories" value={stats.repositoriesCount} icon={FolderGit2} />
        <GitHubStatCard label="Followers" value={stats.followers} icon={Users} accent="from-blue-500/15 to-cyan-500/10" />
        <GitHubStatCard label="Following" value={stats.following} icon={UserPlus} accent="from-emerald-500/15 to-teal-500/10" />
        <GitHubStatCard label="Total stars" value={stats.totalStars} icon={Star} accent="from-amber-500/15 to-orange-500/10" />
        <GitHubStatCard label="Total forks" value={stats.totalForks} icon={GitFork} accent="from-pink-500/15 to-rose-500/10" />
        <GitHubStatCard
          label="Contribution streak"
          value={stats.contributionStreak != null ? stats.contributionStreak : "—"}
          icon={Flame}
          accent="from-orange-500/20 to-red-500/10"
        />
      </section>

      {topRepos.length > 0 ? (
        <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen size={16} className="text-violet-300" />
            Top repositories
          </h4>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topRepos.map((repo) => (
              <motion.li
                key={repo.fullName || repo.name}
                whileHover={{ y: -2 }}
                className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2"
              >
                <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-200 hover:text-white">
                  {repo.name}
                </a>
                <p className="mt-1 text-xs text-slate-500">
                  ★ {repo.stars} · ⑂ {repo.forks}
                  {repo.language ? ` · ${repo.language}` : ""}
                </p>
              </motion.li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h4 className="mb-3 text-sm font-semibold text-white">Repositories</h4>
        <GitHubReposGrid repos={repos} loading={loading} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <motion.div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4">
          <h4 className="mb-4 text-sm font-semibold text-white">Activity timeline</h4>
          <GitHubActivityFeed activity={activity} loading={activityLoading} />
        </motion.div>
        <GitHubActivityCardComposer
          defaultLinkUrl={profileUrl}
          setToast={setToast}
          onSuccess={() => {
            onSyncComplete?.();
            loadData();
          }}
        />
      </section>
    </div>
  );
}
