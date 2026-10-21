"use client";
import { AnimatePresence, motion } from "motion/react";

/** A short status message. Slides in from the edge it sits on and leaves the same way. */
export function Toast({ show, edge = "top", className = "toast", children }: { show: boolean; edge?: "top" | "bottom"; className?: string; children: React.ReactNode }) {
  const off = edge === "top" ? -16 : 16;
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="toast" className={className} role="status" initial={{ opacity: 0, y: off, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: off, scale: 0.96 }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
