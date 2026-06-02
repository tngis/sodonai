"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

type Bp = "base" | "sm" | "lg";

// Floating photo cards cluster — the hero centerpiece.
// Real sample results drift gently behind/around the headline (mobile-safe, no 3D).
// x is responsive: cards spread wider as the cards themselves grow on bigger screens.
const cards = [
  { src: "/wedding.jpeg",   label: "Хурим",     rotate: -8, x: { base: -64, sm: -96, lg: -130 }, y: 8,   delay: 0 },
  { src: "/pregnancy.jpeg", label: "Жирэмсний", rotate: 6,  x: { base: 64,  sm: 96,  lg: 130 },  y: -16, delay: 0.4 },
  { src: "/family.png",     label: "Гэр бүл",   rotate: -3, x: { base: 0,   sm: 0,   lg: 0 },    y: 40,  delay: 0.8 },
];

// Tracks the active Tailwind-style breakpoint (sm = 640px, lg = 1024px).
function useBreakpoint(): Bp {
  const [bp, setBp] = useState<Bp>("base");
  useEffect(() => {
    const calc = () =>
      setBp(window.innerWidth >= 1024 ? "lg" : window.innerWidth >= 640 ? "sm" : "base");
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return bp;
}

export function HeroVisual() {
  const reduce = useReducedMotion();
  const bp = useBreakpoint();

  return (
    <div className="relative mx-auto mt-12 flex h-56 w-full max-w-md items-center justify-center sm:h-64">
      {/* Glow core */}
      <div
        aria-hidden
        className="absolute h-40 w-40 rounded-full blur-3xl"
        style={{ background: "var(--brand)", opacity: 0.25, animation: reduce ? undefined : "pulse-glow 4s ease-in-out infinite" }}
      />
      {cards.map((c, i) => {
        const x = c.x[bp];
        return (
          <motion.div
            key={i}
            className="absolute h-40 w-28 overflow-hidden rounded-2xl shadow-xl ring-1 ring-foreground/10 sm:h-44 sm:w-32 lg:h-56 lg:w-40"
            style={{ x, y: c.y, rotate: c.rotate }}
            initial={{ opacity: 0, scale: 0.8, y: c.y + 30 }}
            animate={
              reduce
                ? { opacity: 1, scale: 1 }
                : { opacity: 1, scale: 1, y: [c.y, c.y - 6, c.y] }
            }
            transition={
              reduce
                ? { duration: 0.4 }
                : { opacity: { duration: 0.5, delay: c.delay }, scale: { duration: 0.5, delay: c.delay }, y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: c.delay } }
            }
          >
            <Image
              src={c.src}
              alt={c.label}
              fill
              sizes="(max-width: 640px) 30vw, (max-width: 1024px) 128px, 160px"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2">
              <span className="text-[11px] font-semibold text-white">{c.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
