import * as React from "react";

import { cn } from "@/lib/utils";

// Recessed corner screw — a tiny indentation machined into the chassis.
// Highlight (top-left) + shadow (bottom-right) come from the theme-aware
// --neu-* pair, so it never uses raw white in dark mode.
function CardScrews() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {[
        "left-3 top-3",
        "right-3 top-3",
        "left-3 bottom-3",
        "right-3 bottom-3",
      ].map((pos) => (
        <span
          key={pos}
          className={cn(
            "absolute size-1.5 rounded-full bg-background shadow-[inset_1px_1px_1.5px_var(--neu-dark),inset_-1px_-1px_1.5px_var(--neu-light)]",
            pos,
          )}
        />
      ))}
    </span>
  );
}

// Ventilation slots — three recessed pills, top-right (offset left of the
// corner screw so they don't collide).
function CardVents() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-8 top-3 z-0 flex gap-1"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-5 w-1 rounded-full bg-muted shadow-[inset_1px_1px_2px_var(--neu-dark)]"
        />
      ))}
    </span>
  );
}

function Card({
  className,
  size = "default",
  detail = false,
  interactive = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  /** Render the signature manufacturing details (corner screws + vent slots). */
  detail?: boolean;
  /** Lift toward the light on hover (use for clickable cards). */
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        // bg-card: a distinct elevated surface (--card) so image cards (presets,
        // categories, featured) lift off the white/dark page body instead of
        // blending into it. Border + --shadow-card add the edge.
        "group/card relative flex flex-col overflow-hidden rounded-xl border bg-card text-sm text-card-foreground shadow-(--shadow-card) has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        // Keep real content above the decorative screw/vent layer (z-0).
        detail &&
          "[&>*:not([aria-hidden])]:relative [&>*:not([aria-hidden])]:z-10",
        interactive && "cursor-pointer",
        className,
      )}
      {...props}
    >
      {detail && <CardScrews />}
      {detail && <CardVents />}
      {children}
    </div>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
