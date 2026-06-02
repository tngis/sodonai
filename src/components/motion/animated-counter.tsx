"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useTransform, motion } from "motion/react";

interface AnimatedCounterProps {
  value: number;
  /** Characters before the number, e.g. "₮". */
  prefix?: string;
  /** Characters after the number, e.g. "%". */
  suffix?: string;
  duration?: number;
  /** Use locale grouping (1,900). */
  group?: boolean;
  className?: string;
}

// Counts up to `value` when it scrolls into view (or when value changes).
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1,
  group = false,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    const n = Math.round(latest);
    return `${prefix}${group ? n.toLocaleString() : n}${suffix}`;
  });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [inView, value, count, duration]);

  return <motion.span ref={ref} className={className}>{rounded}</motion.span>;
}
