"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

// Safety-orange forward confetti — brand accent + warm amber + light chassis flecks.
const COLORS = ["#ff4757", "#ff6b75", "#ffa502", "#e0e5ec", "#ffffff"];

// Deterministic pseudo-random in [0,1) from a seed — keeps render pure
// (no Math.random during render) while still looking scattered.
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// One-shot confetti burst from top-center. Render conditionally when a
// generation completes; it animates once and is cheap (pure transforms).
export function Celebrate({ count = 28 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        x: (rand(i) - 0.5) * 320,
        y: 120 + rand(i + 1) * 260,
        rotate: rand(i + 2) * 540,
        color: COLORS[i % COLORS.length],
        size: 6 + rand(i + 3) * 6,
        delay: rand(i + 4) * 0.15,
        duration: 1.4 + rand(i + 5) * 0.6,
      })),
    [count]
  );

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 rounded-xs"
          style={{ width: p.size, height: p.size * 1.4, background: p.color }}
          initial={{ opacity: 1, x: 0, y: -20, rotate: 0 }}
          animate={{ opacity: [1, 1, 0], x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
