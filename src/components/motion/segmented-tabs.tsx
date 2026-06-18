"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedTab<T extends string> {
  key: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shared layoutId so multiple instances don't collide. */
  layoutId?: string;
  className?: string;
}

// Pill tab bar with an animated sliding indicator (motion layoutId).
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId = "segmented-indicator",
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div className={cn("flex gap-1 rounded-xl bg-muted p-1", className)}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-background border border-border"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
