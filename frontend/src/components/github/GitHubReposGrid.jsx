import { motion } from "framer-motion";
import { ExternalLink, GitFork, Star } from "lucide-react";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function GitHubReposGrid({ repos = [], loading = false }) {
  if (loading) {
    return (
      <motion.div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <motion.div key={i} className="h-28 animate-pulse rounded-xl border border-slate-700/50 bg-slate-800/40" />
        ))}
      </motion.div>
    );
  }

  if (!repos.length) {
    return <p className="text-sm text-slate-400">No repositories found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/60">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 font-semibold">Repository</th>
            <th className="px-4 py-3 font-semibold">Language</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Visibility</th>
            <th className="px-4 py-3 font-semibold">Stars</th>
            <th className="px-4 py-3 font-semibold">Forks</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Updated</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {repos.map((repo) => (
            <tr key={repo.id || repo.fullName} className="bg-slate-900/40 transition hover:bg-slate-800/50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-100">{repo.name}</p>
                {repo.description ? <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{repo.description}</p> : null}
              </td>
              <td className="px-4 py-3 text-slate-300">{repo.language || "—"}</td>
              <td className="hidden px-4 py-3 capitalize text-slate-400 sm:table-cell">{repo.visibility}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-amber-300/90">
                  <Star size={14} aria-hidden />
                  {repo.stars ?? 0}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <GitFork size={14} aria-hidden />
                  {repo.forks ?? 0}
                </span>
              </td>
              <td className="hidden px-4 py-3 text-slate-400 md:table-cell">{formatDate(repo.updatedAt)}</td>
              <td className="px-4 py-3">
                {repo.htmlUrl ? (
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-violet-300 hover:text-violet-200"
                    aria-label={`Open ${repo.name} on GitHub`}
                  >
                    <ExternalLink size={16} />
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
