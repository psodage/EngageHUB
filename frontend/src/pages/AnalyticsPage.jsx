import { useState } from "react";
import { BarChart3, TrendingUp, Users, Target, ArrowUpRight, ArrowDownRight, RefreshCw, Filter, Calendar } from "lucide-react";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);

  const stats = [
    { label: "Total Followers", value: "48.2k", change: "+8.4%", trend: "up", desc: "Across 4 platforms" },
    { label: "Avg. Engagement Rate", value: "4.8%", change: "+1.2%", trend: "up", desc: "Industry avg: 3.2%" },
    { label: "Impressions", value: "1.2M", change: "+12.3%", trend: "up", desc: "Past 30 days" },
    { label: "Link Clicks", value: "14,820", change: "-2.1%", trend: "down", desc: "From link in bio" },
  ];

  const platformPerformance = [
    { platform: "Instagram", followers: "24.5k", engagement: "5.4%", reach: "620k" },
    { platform: "Facebook", followers: "12.8k", engagement: "3.2%", reach: "380k" },
    { platform: "Google Business", followers: "1,204", engagement: "8.1%", reach: "45k" },
    { platform: "X (Twitter)", followers: "9.7k", engagement: "2.5%", reach: "155k" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200">
      {/* Page Title & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Detailed performance tracking and engagement metrics for EngageHub.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Calendar size={16} className="text-slate-400" />
            <span>Last 30 Days</span>
          </div>
          <button 
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 800); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <RefreshCw size={16} className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                stat.trend === "up" 
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              }`}>
                {stat.trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.change}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-400">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* Performance Split */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Table representation */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Platform Performance Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 font-semibold">Platform</th>
                  <th className="pb-3 font-semibold text-right">Followers</th>
                  <th className="pb-3 font-semibold text-right">Engagement</th>
                  <th className="pb-3 font-semibold text-right">Reach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {platformPerformance.map((row) => (
                  <tr key={row.platform} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3.5 font-semibold text-slate-900 dark:text-white">{row.platform}</td>
                    <td className="py-3.5 text-right font-medium">{row.followers}</td>
                    <td className="py-3.5 text-right text-purple-600 dark:text-purple-400 font-semibold">{row.engagement}</td>
                    <td className="py-3.5 text-right text-slate-500">{row.reach}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mini insights card */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">AI Growth Insights</h3>
            <div className="space-y-4">
              <div className="rounded-xl bg-purple-50/50 p-4 border border-purple-100/50 dark:bg-purple-950/20 dark:border-purple-900/30">
                <p className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">Best time to post</p>
                <p className="text-sm font-semibold text-slate-800 mt-1 dark:text-slate-200">Tuesdays & Thursdays, 2:00 PM</p>
                <p className="text-xs text-slate-500 mt-1">Based on engagement rates in the past 14 days.</p>
              </div>
              <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100/50 dark:bg-blue-950/20 dark:border-blue-900/30">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">Top Content Type</p>
                <p className="text-sm font-semibold text-slate-800 mt-1 dark:text-slate-200">Short Videos & Reels</p>
                <p className="text-xs text-slate-500 mt-1">Videos drove 43% more clicks than image carousels.</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-400">Full recommendations update every 24h.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
