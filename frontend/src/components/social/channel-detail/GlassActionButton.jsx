import { motion } from "framer-motion";

export default function GlassActionButton({
  children,
  icon: Icon,
  onClick,
  href,
  disabled = false,
  variant = "default",
  className = "",
  type = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45";
  const variants = {
    default:
      "border-white/10 bg-white/5 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-[0_0_24px_rgba(255,255,255,0.06)]",
    primary:
      "border-white/15 bg-gradient-to-br from-white/15 to-white/5 text-white hover:border-white/25 hover:shadow-[0_0_28px_rgba(255,255,255,0.1)]",
    accent:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:shadow-[0_0_24px_rgba(16,185,129,0.2)]",
  };

  const classes = `${base} ${variants[variant] || variants.default} ${className}`;

  const content = (
    <>
      {Icon ? <Icon size={16} className="shrink-0 opacity-90" aria-hidden /> : null}
      {children}
    </>
  );

  if (href && !disabled) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={classes}
        {...props}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={classes}
      {...props}
    >
      {content}
    </motion.button>
  );
}
