"use client";

import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, Image, ShoppingBag, Settings } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  icon: typeof Home;
  key: "home" | "gallery" | "generate" | "orders" | "settings";
  center?: boolean;
  also?: string[];
};

const navItems: Item[] = [
  { href: "/",         icon: Home,        key: "home" },
  { href: "/gallery",  icon: Image,       key: "gallery" },
  { href: "/generate", icon: Home,        key: "generate", center: true, also: ["/category"] }, // icon unused (center renders image)
  { href: "/orders",   icon: ShoppingBag, key: "orders" },
  { href: "/settings", icon: Settings,    key: "settings" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLang();

  const isActiveFor = (item: Item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname.startsWith(item.href) || (item.also ?? []).some((p) => pathname.startsWith(p));

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 pb-safe backdrop-blur-lg md:hidden"
    >
      <div className="flex h-16 items-stretch">
        {navItems.map((item) => {
          const { href, icon: Icon, key, center } = item;
          const isActive = isActiveFor(item);

          // ── Center: elevated "Create"-style action button ──
          if (center) {
            return (
              <Link
                key={key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-1 flex-col items-center justify-end gap-1 pb-4"
              >
                <motion.span
                  className={cn(
                    "flex min-h-10 w-14 -translate-y-2 items-center justify-center overflow-hidden rounded-xl bg-primary font-bold text-primary-foreground transition-all duration-200 active:translate-y-[-3px] active:shadow-none",
                    isActive
                      ? "shadow-[0_6px_0_0_#8aa800,0_0_24px_-2px_var(--brand)]"
                      : "shadow-[0_6px_0_0_#8aa800]"
                  )}
                >
                  <NextImage src="/spark-icon.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
                </motion.span>
                <span className={cn("text-[10px] font-semibold leading-none", isActive ? "text-primary" : "text-muted-foreground")}>
                  {t(key)}
                </span>
              </Link>
            );
          }

          // ── Standard tab: filled icon + colored label when active ──
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-end gap-1 pb-4 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.4 : 1.8}
                className={isActive ? "drop-shadow-[0_0_6px_rgba(209,254,24,0.55)]" : undefined}
              />
              <span className="leading-none">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
