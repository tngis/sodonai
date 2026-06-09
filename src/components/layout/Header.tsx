"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Bell, User, Settings, LogOut, LogIn, HelpCircle, ShoppingBag, Globe, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserGenerations } from "@/lib/use-generations";
import { getLastSeen, markSeenNow } from "@/lib/notif-seen";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";

export function Header() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  // Track auth so the header can swap user controls for a Login button.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setIsAuthed(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Notifications derived from generation state (no separate table).
  const { finished, loading: notifLoading } = useUserGenerations();
  const [lastSeen, setLastSeen] = useState(0);
  useEffect(() => {
    // Baseline existing history as seen the first time, so old generations
    // don't all show up as unread.
    if (getLastSeen() === 0) markSeenNow();
    const sync = () => setLastSeen(getLastSeen());
    sync();
    window.addEventListener("notif-seen", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("notif-seen", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const unread = finished.filter((g) => new Date(g.updated_at).getTime() > lastSeen).length;
  // Snapshot of lastSeen taken when the dropdown opens, so items stay highlighted
  // while viewing even though opening marks them seen (clearing the badge).
  const [panelSeen, setPanelSeen] = useState(0);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  const themeIcon = !mounted
    ? <Monitor size={18} />
    : theme === "dark" ? <Sun size={18} /> : theme === "light" ? <Moon size={18} /> : <Monitor size={18} />;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const iconBtn =
    "flex size-10 items-center justify-center rounded-xl border border-border/80 bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95";

  const menuLinks = [
    { href: "/gallery",  icon: ImageIcon, label: t("myGallery") },
    { href: "/orders",   icon: ShoppingBag, label: t("myOrders") },
    { href: "/settings", icon: Settings, label: t("settings") },
    { href: "/settings", icon: HelpCircle, label: t("helpFaq") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <NextImage src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" priority />
          <span className="font-display text-lg font-bold tracking-tight">Sodon AI</span>
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Language toggle — desktop only (mobile uses bottom nav + settings) */}
          <button
            onClick={() => setLang(lang === "mn" ? "en" : "mn")}
            aria-label={lang === "mn" ? "Switch to English" : "Монгол хэл рүү шилжих"}
            className="hidden h-10 items-center gap-1.5 rounded-xl border border-border/80 bg-card/50 px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted active:scale-95 md:flex"
          >
            <Globe size={15} className="text-muted-foreground" />
            {lang === "mn" ? "МН" : "EN"}
          </button>

          {/* Theme toggle — desktop only */}
          <button onClick={cycleTheme} aria-label="Загвар солих" className={cn(iconBtn, "hidden md:flex")}>
            {themeIcon}
          </button>

          {/* Logged out → Login button (replaces bell + avatar) */}
          {!isAuthed && (
            <Button
              render={<Link href="/auth" />}
              variant="shadow"
              className="h-8 gap-1.5 rounded-xl border border-[#8aa800] bg-primary px-3 font-bold text-primary-foreground active:scale-95"
            >
               {t("signIn")}<LogIn size={16} />
            </Button>
          )}

          {/* Notifications — logged in only. Mobile → page; desktop → dropdown. */}
          {isAuthed && (
            <>
              <Link href="/notifications" aria-label={t("notifications")} className={cn(iconBtn, "relative md:hidden")}>
                <Bell size={19} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <DropdownMenu onOpenChange={(open) => { if (open) { setPanelSeen(getLastSeen()); markSeenNow(); } }}>
                <DropdownMenuTrigger aria-label={t("notifications")} className={cn(iconBtn, "relative hidden md:flex")}>
                  <Bell size={19} />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="w-80 rounded-2xl p-2">
                  <div className="px-2 pb-1.5 pt-1 text-sm font-semibold">{t("notifications")}</div>
                  <div className="max-h-[26rem] overflow-y-auto">
                    <NotificationsPanel items={finished} loading={notifLoading} lastSeen={panelSeen} />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Avatar menu — logged in, desktop only (mobile uses bottom nav) */}
          {isAuthed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hidden size-10 items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/5 text-foreground ring-1 ring-border transition-all hover:ring-primary/60 active:scale-95 md:flex"
              aria-label="Хэрэглэгчийн цэс"
            >
              <User size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-2xl p-2">
              {/* Profile header */}
              <div className="mb-1 flex items-center gap-3 rounded-xl bg-muted/50 px-2.5 py-2.5">
                <span className="flex size-10 items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/5 ring-1 ring-border">
                  <User size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t("welcomeBack")}</p>
                  <p className="truncate text-xs text-muted-foreground">Sodon AI</p>
                </div>
              </div>

              {menuLinks.map((m, i) => (
                <DropdownMenuItem key={i} className="rounded-xl px-2 py-2">
                  <Link href={m.href} className="flex w-full items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                      <m.icon size={16} />
                    </span>
                    <span className="text-sm font-medium">{m.label}</span>
                  </Link>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="my-1.5" />

              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer rounded-xl px-2 py-2 text-destructive focus:text-destructive"
              >
                <span className="flex w-full items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <LogOut size={16} />
                  </span>
                  <span className="text-sm font-medium">{t("signOut")}</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
