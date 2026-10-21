// Spring presets, in Apple's terms: `bounce` ≈ 1 − damping ratio, `visualDuration` ≈ response.
// Default to no bounce. Only add bounce when the user's own gesture carried momentum (a flick, a drag release).
import type { Transition } from "motion/react";

/** Default for anything that moves or appears: critically damped, no overshoot. */
export const SPRING: Transition = { type: "spring", bounce: 0, visualDuration: 0.35 };
/** Quick state changes (nav highlight, toggles). */
export const SPRING_FAST: Transition = { type: "spring", bounce: 0, visualDuration: 0.25 };
/** Sheets and drawers after a drag — Apple ships damping 0.8, response 0.3. */
export const SPRING_SHEET: Transition = { type: "spring", bounce: 0.2, visualDuration: 0.3 };

/** Where a flick will come to rest — Apple's projection from "Designing Fluid Interfaces". */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
