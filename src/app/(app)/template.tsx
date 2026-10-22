"use client";
import { motion } from "motion/react";

/**
 * Runs on every page change inside the app. The top bar, sidebar and tab bar stay put (they live in the layout);
 * only the page underneath fades in, so switching tabs feels like one app rather than a reload.
 * Opacity only: a moving page would knock the floating bars (search, Reply, toasts) out of place mid-fade.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
