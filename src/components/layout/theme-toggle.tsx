"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

// Physical two-position rocker. A recessed slot houses a sliding safety-orange
// switch (with a soft LED glow) that carries the active icon; the inactive icon
// is engraved on the empty side of the track. Driven by next-themes; gated on
// mount to avoid a hydration mismatch.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Загвар солих"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-10 w-18 shrink-0 items-center rounded-full bg-muted p-1 shadow-(--shadow-recessed) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* Engraved track icons */}
      <Sun
        aria-hidden
        size={14}
        className="absolute left-2.5 text-muted-foreground"
      />
      <Moon
        aria-hidden
        size={14}
        className="absolute right-2.5 text-muted-foreground"
      />
      {/* Sliding switch */}
      <span
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-floating),var(--shadow-glow)] transition-transform duration-300",
          isDark ? "translate-x-9" : "translate-x-0",
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        {isDark ? <Moon size={15} /> : <Sun size={15} />}
      </span>
    </button>
  );
}
