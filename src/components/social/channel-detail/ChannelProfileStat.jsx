import { motion } from "framer-motion";

export default function ChannelProfileStat({ icon: Icon, label, value, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-shadow duration-300 hover:border-white/15 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
    >
      <motion.div
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors group-hover:text-white"
        whileHover={{ scale: 1.05 }}
      >
        {Icon ? <Icon size={16} aria-hidden /> : null}
      </motion.div>
      <motion.p
        className="text-2xl font-bold tracking-tight text-white"
        layout
      >
        {value}
      </motion.p>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </motion.div>
  );
}
