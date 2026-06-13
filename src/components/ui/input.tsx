import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Recessed "data slot" machined into the chassis: no border, depth from
        // the inset shadow. Focus lights an orange LED ring behind the well.
        "h-12 w-full min-w-0 rounded-md border-0 bg-muted px-4 py-1 text-base text-foreground shadow-(--shadow-recessed) transition-shadow outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 focus-visible:shadow-[var(--shadow-recessed),0_0_0_2px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[var(--shadow-recessed),0_0_0_2px_var(--destructive)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
