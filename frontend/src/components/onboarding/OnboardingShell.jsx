import { motion } from "framer-motion";

export default function OnboardingShell({ children }) {
  return (
    <motion.div
      className="flex min-h-dvh flex-col overflow-hidden bg-[#e4ebe8] px-4 py-6 sm:px-6 sm:py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col">{children}</div>
    </motion.div>
  );
}
