import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Recessed data slot — matches Input (depth via inset shadow, LED focus).
        "flex min-h-20 w-full rounded-md border-0 bg-muted px-4 py-3 text-base text-foreground shadow-(--shadow-recessed) transition-shadow outline-none placeholder:text-muted-foreground/60 focus-visible:shadow-[var(--shadow-recessed),0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[var(--shadow-recessed),0_0_0_2px_var(--destructive)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
