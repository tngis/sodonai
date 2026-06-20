"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { type Capability, type StaffRole, roleHasCapability } from "@/lib/roles";

const TABS: { href: string; label: string; cap: Capability }[] = [
  { href: "/admin", label: "Хяналт", cap: "dashboard" },
  { href: "/admin/orders", label: "Захиалга", cap: "orders" },
  { href: "/admin/categories", label: "Ангилал", cap: "catalog" },
  { href: "/admin/presets", label: "Пресет", cap: "catalog" },
  { href: "/admin/users", label: "Хэрэглэгчид", cap: "users" },
];

export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => roleHasCapability(role, tab.cap));
  const activeRef = useRef<HTMLAnchorElement>(null);

  // On mobile the tabs scroll horizontally; bring the active one into view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 shadow-[inset_2px_2px_4px_var(--neu-dark),inset_-2px_-2px_4px_var(--neu-light)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            ref={active ? activeRef : undefined}
            href={tab.href}
            // min-w-fit keeps each tab at its label width so the row scrolls on
            // mobile instead of squashing; flex-1 still fills the width on desktop.
            className={cn(
              "min-w-fit flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors",
              active ? "bg-background text-foreground shadow-[2px_2px_4px_var(--neu-dark),-2px_-2px_4px_var(--neu-light)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
