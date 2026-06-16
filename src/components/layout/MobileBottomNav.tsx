"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, Image, ShoppingBag, Sparkles, User } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { LoginGate } from "@/components/auth/login-gate";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  icon: typeof Home;
  key: "home" | "gallery" | "generate" | "orders" | "profile";
  center?: boolean;
  also?: string[];
  // Requires auth — a signed-out tap opens the login gate instead of navigating.
  protected?: boolean;
};

const navItems: Item[] = [
  { href: "/",         icon: Home,        key: "home" },
  { href: "/gallery",  icon: Image,       key: "gallery",  protected: true },
  { href: "/generate", icon: Sparkles,    key: "generate", center: true, also: ["/category"] },
  { href: "/orders",   icon: ShoppingBag, key: "orders",   protected: true },
  { href: "/profile",  icon: User,        key: "profile",  protected: true },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLang();
  const { isAuthed, loading } = useAuth();

  // Commit-time login gate for protected tabs (UX only — the proxy still guards
  // /gallery + /orders, and /profile keeps its own client redirect).
  const [gateOpen, setGateOpen] = useState(false);
  const [gateNext, setGateNext] = useState<string | undefined>(undefined);

  const isActiveFor = (item: Item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname.startsWith(item.href) || (item.also ?? []).some((p) => pathname.startsWith(p));

  return (
    <>
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
                className="flex flex-1 flex-col items-center justify-end gap-1 pb-2"
              >
                <motion.span
                  className={cn(
                    "flex min-h-10 w-14 -translate-y-2 items-center justify-center overflow-hidden rounded-xl bg-primary font-bold text-primary-foreground transition-all duration-200 active:translate-y-0 active:shadow-(--shadow-key-bevel-pressed)",
                    // Raised safety-orange key: a darker-orange base bevel reads as
                    // the moulded key edge (matches button.tsx accent), + orange LED
                    // bloom when active. No raw grey — it tracks the brand. Tokens
                    // (--shadow-key-bevel/--shadow-glow) so the flat variant nulls them.
                    isActive
                      ? "shadow-[var(--shadow-key-bevel),var(--shadow-glow)]"
                      : "shadow-(--shadow-key-bevel)"
                  )}
                >
                  <Icon size={24} strokeWidth={2.5} />
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
              onClick={(e) => {
                // Divert a signed-out tap on a protected tab to the login gate
                // instead of letting it bounce to /auth. Authed users (and the
                // brief auth-loading window) navigate normally.
                if (item.protected && !isAuthed && !loading) {
                  e.preventDefault();
                  setGateNext(href);
                  setGateOpen(true);
                }
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-end gap-1 pb-2 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.4 : 1.8}
                className={isActive ? "drop-shadow-[0_0_6px_rgba(255,71,87,0.55)]" : undefined}
              />
              <span className="leading-none">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>

    <LoginGate open={gateOpen} onOpenChange={setGateOpen} next={gateNext} />
    </>
  );
}
