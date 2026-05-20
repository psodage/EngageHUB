import { motion } from "framer-motion";
import { GitCommit, GitPullRequest, GitBranch, Star, CircleDot, ExternalLink } from "lucide-react";

function activityIcon(type) {
  if (type === "PushEvent") return GitCommit;
  if (type === "PullRequestEvent") return GitPullRequest;
  if (type === "WatchEvent") return Star;
  if (type === "IssuesEvent") return CircleDot;
  return GitBranch;
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function GitHubActivityFeed({ activity = [], loading = false }) {
  if (loading) {
    return (
      <ul className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="h-16 animate-pulse rounded-xl border border-slate-700/50 bg-slate-800/40" />
        ))}
      </ul>
    );
  }

  if (!activity.length) {
    return <p className="text-sm text-slate-400">No recent public activity.</p>;
  }

  return (
    <ul className="relative space-y-0">
      <span className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-500/40 via-slate-600/30 to-transparent" aria-hidden />
      {activity.map((item, index) => {
        const Icon = activityIcon(item.type);
        return (
          <motion.li
            key={item.id || `${item.type}-${index}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="relative flex gap-3 py-3"
          >
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-600/80 bg-slate-900 text-violet-300">
              <Icon size={16} aria-hidden />
            </span>
            <motion.div
              className="min-w-0 flex-1 rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-3 backdrop-blur-sm"
              whileHover={{ borderColor: "rgba(139, 92, 246, 0.35)" }}
            >
              <p className="text-sm font-medium text-slate-100">{item.summary}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {item.repo ? <span>{item.repo}</span> : null}
                {item.createdAt ? <span>{formatWhen(item.createdAt)}</span> : null}
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200"
                >
                  View on GitHub
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </motion.div>
          </motion.li>
        );
      })}
    </ul>
  );
}
