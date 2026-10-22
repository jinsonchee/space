"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useIsPresent, useReducedMotion, type PanInfo } from "motion/react";
import { SPRING, project } from "@/lib/motion";

// Remember where the last press landed, so a pop-up grows out of the button that opened it.
let lastPress: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => { lastPress = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
}

const PHONE = "(max-width: 640px)";
export function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  /** CSS width, e.g. "min(820px, 100%)". */
  width?: string;
  /** Set false when the content handles Escape itself (e.g. to ask before discarding). */
  closeOnEscape?: boolean;
  children: React.ReactNode;
};

/**
 * Every pop-up in Space. Desktop: grows out of the button that opened it, shrinks back into it.
 * Phone: a bottom sheet you can flick down to close. Exits animate even when a parent unmounts it
 * inside <AnimatePresence>.
 */
export function Sheet({ open, ...rest }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<AnimatePresence propagate>{open && <Panel key="sheet" {...rest} />}</AnimatePresence>, document.body);
}

function Panel({ onClose, label, width, closeOnEscape = true, children }: Omit<Props, "open">) {
  const phone = useIsPhone();
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const close = useRef(onClose);
  close.current = onClose;

  // Anchor the grow/shrink to the press point (measured unscaled, before the first frame paints).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !lastPress) return;
    const r = el.getBoundingClientRect();
    const left = r.left + r.width / 2 - el.offsetWidth / 2;
    const top = r.top + r.height / 2 - el.offsetHeight / 2;
    el.style.transformOrigin = `${lastPress.x - left}px ${lastPress.y - top}px`;
  }, []);

  // Escape to close, page behind stays put, and focus goes back to the trigger afterwards.
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (closeOnEscape && e.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); html.style.overflow = prev; back?.focus?.({ preventScroll: true }); };
  }, [closeOnEscape]);

  // Flick down to close: project where the throw would land, and close if that's past halfway.
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const h = ref.current?.offsetHeight ?? 400;
    if (info.velocity.y >= 0 && info.offset.y + project(info.velocity.y) > h / 2) close.current();
  };

  const look = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : phone
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
      : { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.92 } };

  return (
    <div className="sheet-root" style={present ? undefined : { pointerEvents: "none" }}>
      <motion.div className="sheet-scrim" onMouseDown={() => close.current()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        ref={ref}
        className="modal sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={width ? { width } : undefined}
        {...look}
        transition={SPRING}
        drag={phone && !reduce ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 40 }}
        onDragEnd={onDragEnd}
      >
        {phone && <div className="sheet-grab" onPointerDown={(e) => drag.start(e)} aria-hidden />}
        {children}
      </motion.div>
    </div>
  );
}
