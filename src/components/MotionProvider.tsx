"use client";
import { MotionConfig } from "motion/react";
import { SPRING } from "@/lib/motion";

/** One place for motion defaults. `reducedMotion="user"` swaps movement for fades when the device asks for less motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={SPRING}>{children}</MotionConfig>;
}
