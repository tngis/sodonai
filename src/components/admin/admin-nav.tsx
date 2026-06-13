"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Хяналт" },
  { href: "/admin/orders", label: "Захиалга" },
  { href: "/admin/categories", label: "Ангилал" },
  { href: "/admin/presets", label: "Пресет" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-xl bg-muted p-1 shadow-[inset_2px_2px_4px_var(--neu-dark),inset_-2px_-2px_4px_var(--neu-light)]">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors",
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
