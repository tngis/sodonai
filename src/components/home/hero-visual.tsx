"use client";

import { motion, useReducedMotion } from "motion/react";
import { Sparkles, Wand2, ImageIcon } from "lucide-react";

// Floating glassy "photo cards" cluster — the hero centerpiece.
// Pure CSS/SVG + motion (mobile-safe, no 3D/WebGL). Cards drift gently and
// parallax-tilt is intentionally omitted on touch for performance.
export function HeroVisual() {
  const reduce = useReducedMotion();

  const cards = [
    { icon: <ImageIcon size={20} />, label: "Family", rotate: -8, x: -64, y: 8,  delay: 0,    emoji: "👨‍👩‍👧" },
    { icon: <Wand2 size={20} />,     label: "Restore", rotate: 6,  x: 64,  y: -16, delay: 0.4, emoji: "🖼️" },
    { icon: <Sparkles size={20} />,  label: "Portrait", rotate: -3, x: 0,  y: 40,  delay: 0.8, emoji: "✨" },
  ];

  return (
    <div className="relative mx-auto mt-12 flex h-56 w-full max-w-md items-center justify-center sm:h-64">
      {/* Glow core */}
      <div
        aria-hidden
        className="absolute h-40 w-40 rounded-full blur-3xl"
        style={{ background: "var(--brand)", opacity: 0.25, animation: reduce ? undefined : "pulse-glow 4s ease-in-out infinite" }}
      />
      {cards.map((c, i) => (
        <motion.div
          key={i}
          className="glass-strong absolute flex h-32 w-24 flex-col items-center justify-center gap-2 rounded-2xl sm:h-36 sm:w-28"
          style={{ x: c.x, y: c.y, rotate: c.rotate }}
          initial={{ opacity: 0, scale: 0.8, y: c.y + 30 }}
          animate={
            reduce
              ? { opacity: 1, scale: 1 }
              : { opacity: 1, scale: 1, y: [c.y, c.y - 12, c.y] }
          }
          transition={
            reduce
              ? { duration: 0.4 }
              : { opacity: { duration: 0.5, delay: c.delay }, scale: { duration: 0.5, delay: c.delay }, y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: c.delay } }
          }
        >
          <span className="text-3xl">{c.emoji}</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {c.icon}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{c.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
