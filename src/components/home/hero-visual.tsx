"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import Image from "next/image";

type Bp = "base" | "sm" | "lg";

type CardCfg = {
  src: string;
  label: string;
  rotate: number;
  x: Record<Bp, number>;
  y: number;
  delay: number;
  /** Parallax depth: closer cards (higher) shift/tilt more toward the cursor. */
  depth: number;
};

// Floating photo cards cluster — the hero centerpiece.
// Real sample results drift gently and lean toward the cursor (desktop pointer
// only). x is responsive: cards spread wider as the cards themselves grow.
const cards: CardCfg[] = [
  { src: "/wedding.jpeg",   label: "Хурим",     rotate: -8, x: { base: -72, sm: -108, lg: -148 }, y: 8,   delay: 0,   depth: 0.9 },
  { src: "/pregnancy.jpeg", label: "Жирэмсний", rotate: 6,  x: { base: 72,  sm: 108,  lg: 148 },  y: -16, delay: 0.4, depth: 0.75 },
  { src: "/family.png",     label: "Гэр бүл",   rotate: -3, x: { base: 0,   sm: 0,    lg: 0 },    y: 36,  delay: 0.8, depth: 1.15 },
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
  const ref = useRef<HTMLDivElement>(null);

  // Pointer position over the hero, normalized to [-0.5, 0.5] on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 120, damping: 20, mass: 0.4 });
  const spy = useSpring(py, { stiffness: 120, damping: 20, mass: 0.4 });

  useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    // React to the whole hero, not just the small card cluster.
    const el = ref.current?.closest("section") ?? ref.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width - 0.5);
      py.set((e.clientY - r.top) / r.height - 0.5);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce, px, py]);

  return (
    <div
      ref={ref}
      className="relative mx-auto mt-12 flex h-64 w-full max-w-md items-center justify-center sm:h-72 lg:h-80"
    >
      {/* Glow core */}
      <div
        aria-hidden
        className="absolute h-44 w-44 md:h-64 md:w-80 rounded-full blur-3xl"
        style={{ background: "var(--brand)", opacity: 0.25, animation: reduce ? undefined : "pulse-glow 4s ease-in-out infinite" }}
      />
      {cards.map((c, i) => (
        <FloatingCard key={i} card={c} index={i} bp={bp} reduce={!!reduce} mx={spx} my={spy} />
      ))}
    </div>
  );
}

function FloatingCard({
  card,
  index,
  bp,
  reduce,
  mx,
  my,
}: {
  card: CardCfg;
  index: number;
  bp: Bp;
  reduce: boolean;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const x = card.x[bp];

  // Cursor-driven parallax: translate + a subtle 3D lean, scaled by depth.
  const tx = useTransform(mx, (v) => v * 40 * card.depth);
  const ty = useTransform(my, (v) => v * 26 * card.depth);
  const rotateY = useTransform(mx, (v) => v * 12);
  const rotateX = useTransform(my, (v) => v * -10);

  return (
    <motion.div
      className="absolute"
      style={{ x, y: card.y, rotate: card.rotate }}
      initial={{ opacity: 0, scale: 0.8, y: card.y + 30 }}
      animate={
        reduce
          ? { opacity: 1, scale: 1 }
          : { opacity: 1, scale: 1, y: [card.y, card.y - 6, card.y] }
      }
      transition={
        reduce
          ? { duration: 0.4 }
          : {
              opacity: { duration: 0.5, delay: card.delay },
              scale: { duration: 0.5, delay: card.delay },
              y: { duration: 4 + index, repeat: Infinity, ease: "easeInOut", delay: card.delay },
            }
      }
    >
      <motion.div
        className="relative h-44 w-32 overflow-hidden rounded-2xl shadow-xl ring-1 ring-foreground/10 sm:h-52 sm:w-36 lg:h-64 lg:w-44"
        style={reduce ? undefined : { x: tx, y: ty, rotateX, rotateY, transformPerspective: 700 }}
      >
        <Image
          src={card.src}
          alt={card.label}
          fill
          sizes="(max-width: 640px) 35vw, (max-width: 1024px) 144px, 176px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2">
          <span className="text-[11px] font-semibold text-white">{card.label}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
