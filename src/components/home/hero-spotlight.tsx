"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";

// Diameter of the glow disc in px. Half is subtracted so the glow centers on the pointer.
const SIZE = 480;

// Cursor-following spotlight for the hero. It attaches to its positioned parent
// (the hero <section>) and drifts a soft brand-colored glow toward the pointer,
// reinforcing the existing glow aesthetic. Pointer-events-none so it never blocks
// the CTA. Desktop-only ((pointer: fine)) and disabled under prefers-reduced-motion.
export function HeroSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 25, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 150, damping: 25, mass: 0.4 });
  const sOpacity = useSpring(opacity, { stiffness: 120, damping: 20 });

  useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current?.parentElement;
    if (!el) return;

    setEnabled(true);
    let first = true;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = e.clientX - rect.left - SIZE / 2;
      const ny = e.clientY - rect.top - SIZE / 2;
      x.set(nx);
      y.set(ny);
      // Teleport on the very first move so the glow doesn't streak in from (0,0).
      if (first) {
        sx.jump(nx);
        sy.jump(ny);
        first = false;
      }
      opacity.set(1);
    };
    const onLeave = () => opacity.set(0);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce, x, y, sx, sy, opacity]);

  if (reduce) return null;

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ opacity: enabled ? sOpacity : 0 }}
    >
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          x: sx,
          y: sy,
          width: SIZE,
          height: SIZE,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand) 28%, transparent) 0%, transparent 70%)",
        }}
      />
    </motion.div>
  );
}
