"use client";

import { Layers, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";
import { useUiStyle } from "@/lib/use-ui-style";

// Physical two-position rocker (twin of ThemeToggle) for the flat/neumorphic
// axis. Recessed slot + sliding safety-orange switch carrying the active icon;
// the inactive icon is engraved on the empty side. Layers = neumorphic (relief),
// Square = flat. Gated on mount to avoid a hydration mismatch. In flat mode the
// track's own relief tokens resolve to none, so the control flattens with the UI.
export function StyleToggle({ className }: { className?: string }) {
  const { t } = useLang();
  const { flat, setFlat, mounted } = useUiStyle();
  const isFlat = mounted && flat;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isFlat}
      aria-label={t("uiStyle")}
      onClick={() => setFlat(!isFlat)}
      className={cn(
        "relative inline-flex h-10 w-18 shrink-0 items-center rounded-full bg-muted p-1 shadow-(--shadow-recessed) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* Engraved track icons */}
      <Layers
        aria-hidden
        size={14}
        className="absolute left-2.5 text-muted-foreground"
      />
      <Square
        aria-hidden
        size={14}
        className="absolute right-2.5 text-muted-foreground"
      />
      {/* Sliding switch */}
      <span
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-floating),var(--shadow-glow)] transition-transform duration-300",
          isFlat ? "translate-x-9" : "translate-x-0",
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        {isFlat ? <Square size={15} /> : <Layers size={15} />}
      </span>
    </button>
  );
}
