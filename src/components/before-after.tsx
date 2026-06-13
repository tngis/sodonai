"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { ChevronsLeftRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeAfterProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Glyph shown if an image fails to load. */
  fallback?: ReactNode;
  className?: string;
}

// Draggable before/after comparison. Pointer + touch friendly; the divider
// follows drag and also responds to keyboard (←/→) for accessibility.
export function BeforeAfter({
  before,
  after,
  beforeLabel = "Өмнө",
  afterLabel = "Дараа",
  fallback = <ImageOff className="size-12 text-muted-foreground" />,
  className,
}: BeforeAfterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [beforeErr, setBeforeErr] = useState(false);
  const [afterErr, setAfterErr] = useState(false);

  const move = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative touch-pan-y select-none overflow-hidden bg-muted", className)}
      onPointerDown={(e) => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (dragging) move(e.clientX); }}
      onPointerUp={(e) => { setDragging(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
      role="slider"
      aria-label="Өмнө / дараа харьцуулалт"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
        if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
      }}
    >
      {/* After (full, underneath) */}
      {afterErr || !after ? (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" onError={() => setAfterErr(true)} draggable={false} />
      )}
      <span className="absolute right-2 top-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">{afterLabel}</span>

      {/* Before (full-size, clipped from the right via clip-path — no ref math) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {beforeErr || !before ? (
          <div className="flex h-full w-full items-center justify-center">{fallback}</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={before} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" onError={() => setBeforeErr(true)} draggable={false} />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">{beforeLabel}</span>
      </div>

      {/* Divider handle */}
      <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.4)]" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-md">
          <ChevronsLeftRight size={14} />
        </div>
      </div>
    </div>
  );
}
