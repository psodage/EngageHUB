import { motion } from "framer-motion";

export default function GitHubStatCard({ label, value, icon: Icon, accent = "from-violet-500/20 to-indigo-500/10" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border border-slate-700/60 bg-gradient-to-br ${accent} p-4 backdrop-blur-sm`}
    >
      <motion.div
        className="flex items-center justify-between gap-2"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value ?? "—"}</p>
        </div>
        {Icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/80 text-violet-300">
            <Icon size={18} aria-hidden />
          </span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
