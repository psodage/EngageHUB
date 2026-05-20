import { motion } from "framer-motion";

export default function ProgressTracker({ processedCount, totalCount, percent }) {
  const label = totalCount ? `${processedCount} of ${totalCount}` : "0 of 0";

  return (
    <div className="w-full shrink-0 sm:w-[168px]">
      <motion.div
        className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <motion.div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Progress</span>
          <span className="tabular-nums text-slate-700">{label}</span>
        </motion.div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full rounded-full bg-brand-500"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <p className="mt-1.5 text-right text-[10px] font-medium tabular-nums text-slate-400">{percent}%</p>
      </motion.div>
    </div>
  );
}
