import { cn } from "@/lib/utils"

// LED status indicator — a solid-fill dot with a coloured glow bloom and an
// optional monospace caption ("SYSTEM ONLINE", "PWR"). The pulse mimics a
// breathing status light. NOTE: the label renders in mono (Latin-only) — pass
// Latin/numeric captions, never Mongolian copy.
const COLORS = {
  online: "34, 197, 94", // green
  accent: "255, 71, 87", // safety orange (brand)
  warning: "234, 179, 8", // amber
  alert: "239, 68, 68", // red
} as const

function Led({
  color = "online",
  pulse = true,
  label,
  className,
}: {
  color?: keyof typeof COLORS
  pulse?: boolean
  label?: string
  className?: string
}) {
  const rgb = COLORS[color]
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", pulse && "animate-pulse")}
        style={{
          background: `rgb(${rgb})`,
          boxShadow: `0 0 8px 1px rgba(${rgb}, 0.85)`,
        }}
      />
      {label && (
        <span className="label-stamp text-[10px] leading-none text-muted-foreground">
          {label}
        </span>
      )}
    </span>
  )
}

export { Led }
