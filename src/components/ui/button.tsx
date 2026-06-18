import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Industrial Skeuomorphism — buttons are tactile 3D "physical keys". They sit
// proud of the chassis (neumorphic dual shadow) and depress on press: the key
// moves down 1–2px and the shadow inverts to an inset (shadow-pressed), giving
// immediate mechanical feedback. Accent keys use red-tinted neumorphic shadows;
// chassis keys use the grey --shadow-card pair. Focus = orange LED ring.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-bold tracking-wide whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Accent key — safety orange with red-tinted neumorphic relief.
        default:
          "bg-primary text-primary-foreground uppercase shadow-(--shadow-key) hover:brightness-110 active:translate-y-px active:shadow-(--shadow-key-pressed)",
        // Chassis key — raised grey panel that depresses into the surface.
        secondary:
          "bg-background text-foreground shadow-(--shadow-card) hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed)",
        outline:
          "bg-background text-muted-foreground shadow-(--shadow-card) hover:text-foreground aria-expanded:text-foreground active:translate-y-px active:shadow-(--shadow-pressed)",
        // Alias kept for existing call sites — same accent key as default.
        shadow:
          "bg-primary text-primary-foreground uppercase shadow-(--shadow-key) hover:brightness-110 active:translate-y-px active:shadow-(--shadow-key-pressed)",
        // Flat label that sinks into a recessed well on hover/press.
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground active:shadow-(--shadow-pressed)",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/40 active:translate-y-px dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-md px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-xs":
          "size-7 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 rounded-md in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      render={render}
      // When rendering as a non-button element (e.g. a Link/<a>), opt out of
      // native button semantics so Base UI doesn't warn. Explicit prop wins.
      nativeButton={nativeButton ?? render === undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
