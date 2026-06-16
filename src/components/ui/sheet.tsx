"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Bottom-anchored mobile sheet (drawer) built on Base UI's Dialog. Reuses the
// dialog's modal behaviour (focus trap, scroll lock, backdrop/Esc dismiss) but
// slides up from the bottom edge — the native pattern for phones / Capacitor.
// Safe-area-aware bottom padding is baked into SheetContent so any consumer
// (account menu, future login gates, payment sheets) clears the home indicator.
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

function SheetBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        // duration-300 + fill-mode-forwards on the exit keep the backdrop fading
        // in lockstep with the 300ms popup (which gates unmount). Without it the
        // backdrop's default .15s fade-out finishes early and — with fill-mode:none
        // — snaps back to full opacity for the remaining 150ms (the close "flash").
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm duration-300 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:fill-mode-forwards",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <SheetPortal>
      <SheetBackdrop />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          // chassis-surface: portaled/opaque layer, so it carries its own copy of
          // the page grain (can't show the fixed body::after through it). The
          // safe-area bottom padding keeps content above the iOS home indicator.
          "chassis-surface fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-border px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-(--shadow-floating) duration-300 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        {/* Grab handle — signals the panel is dismissible. */}
        <div
          aria-hidden
          className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border"
        />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            aria-label="Хаах"
            className="absolute top-3.5 right-4 flex size-8 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-(--shadow-card) outline-none transition-all hover:text-foreground active:translate-y-px active:shadow-(--shadow-pressed) focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
          >
            <XIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 px-1 pb-2", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-bold tracking-tight", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetBackdrop,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}
