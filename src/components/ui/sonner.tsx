"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset={16}
      className="toaster group"
      icons={{
        // Icon colour is driven by the per-type status rail in globals.css
        // (`[data-icon] svg { color: var(--toast-rail) }`) so it always tracks
        // the toast type — keep these structural only.
        success: <CircleCheckIcon className="size-4.5" />,
        info: <InfoIcon className="size-4.5" />,
        warning: <TriangleAlertIcon className="size-4.5" />,
        error: <OctagonXIcon className="size-4.5" />,
        loading: <Loader2Icon className="size-4.5 animate-spin" />,
      }}
      style={
        {
          // Fallbacks for sonner's own vars; the full neumorphic skin lives in
          // globals.css (.cn-toast) because sonner's runtime CSS is unlayered
          // and outranks Tailwind's @layer utilities.
          "--normal-bg": "color-mix(in oklab, var(--popover) 86%, transparent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "color-mix(in oklab, var(--foreground) 10%, transparent)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
