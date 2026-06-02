"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Re-mounts on every route change → gives each page a fade+slide entrance.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
