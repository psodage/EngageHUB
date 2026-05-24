import { motion } from "framer-motion";

const panelMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
};

export default function GlassPanel({ children, className = "", as: Tag = "article", ...props }) {
  const Component = motion[Tag] || motion.article;

  return (
    <Component
      {...panelMotion}
      className={`overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
