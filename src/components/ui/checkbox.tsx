"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-sm border-0 bg-muted shadow-[inset_1px_1px_2px_var(--neu-dark),inset_-1px_-1px_2px_var(--neu-light)] transition-[box-shadow,background-color] outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:shadow-[inset_1px_1px_2px_var(--neu-dark),inset_-1px_-1px_2px_var(--neu-light),0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[inset_1px_1px_2px_var(--neu-dark),inset_-1px_-1px_2px_var(--neu-light),0_0_0_2px_var(--destructive)] data-checked:bg-primary data-checked:text-primary-foreground data-checked:shadow-none",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
