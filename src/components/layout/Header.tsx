"use client";

import Link from "next/link";
import NextImage from "next/image";
import {
  Bell,
  User,
  Settings,
  LogOut,
  LogIn,
  HelpCircle,
  ShoppingBag,
  Globe,
  Image as ImageIcon,
  Wallet,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUserGenerations } from "@/lib/use-generations";
import { getLastSeen, markSeenNow } from "@/lib/notif-seen";
import { getNotificationThumbs } from "@/app/actions/storage";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import { useEscapeRegister } from "@/hooks/use-overlay-escape";
import { isStaffRole, roleHome } from "@/lib/roles";

export function Header() {
  const { t, lang, setLang } = useLang();
  const { isAuthed, loading, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Auth + profile come from shared context (one local session read per page
  // load), not a per-component getUser()/getProfile() round-trip on each mount.
  const avatarUrl = profile?.avatarUrl ?? null;
  const profileName = profile?.name ?? null;
  const staffRole = isStaffRole(profile?.role) ? profile.role : null;

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
  const unread = finished.filter(
    (g) => new Date(g.updated_at).getTime() > lastSeen,
  ).length;
  // Snapshot of lastSeen taken when the dropdown opens, so items stay highlighted
  // while viewing even though opening marks them seen (clearing the badge).
  const [panelSeen, setPanelSeen] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [panelThumbs, setPanelThumbs] = useState<Record<string, string>>({});
  const [panelThumbsLoading, setPanelThumbsLoading] = useState(false);

  // Mobile-only account drawer (desktop uses the avatar dropdown). Handles both
  // states: signed-in account menu, signed-out login prompt.
  const [accountOpen, setAccountOpen] = useState(false);
  const closeAccountDrawer = useCallback(() => setAccountOpen(false), []);
  useEscapeRegister(accountOpen, closeAccountDrawer);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  // Neumorphic chassis key: raised by default, depresses into the surface on press.
  const iconBtn =
    "flex size-10 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-(--shadow-card) transition-all hover:text-foreground active:translate-y-px active:shadow-(--shadow-pressed)";

  // Profile lives in the menu's avatar header (tap it to open /profile), so it's
  // not repeated as a list item.
  const menuLinks = [
    { href: "/wallet", icon: Wallet, label: t("wallet") },
    { href: "/gallery", icon: ImageIcon, label: t("myGallery") },
    { href: "/orders", icon: ShoppingBag, label: t("myOrders") },
    { href: "/settings", icon: Settings, label: t("settings") },
    { href: "/help", icon: HelpCircle, label: t("helpFaq") },
    ...(staffRole
      ? [{ href: roleHome(staffRole), icon: ShieldCheck, label: "Админ" }]
      : []),
  ];
  // Only the first link matching the current path is "active".
  const activeMenuIndex = menuLinks.findIndex(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );
  const profileActive =
    pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <NextImage
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          {/*<div className="size-10  border-white rounded-full  border shadow-(--shadow-floating) flex items-center justify-center">
            <Zap size="20" color="red" />
          </div>*/}

          <span className="font-display text-2xl font-bold tracking-tight text-embossed">
            Sodon AI
          </span>
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Language toggle — desktop only (mobile uses bottom nav + settings) */}
          <button
            onClick={() => setLang(lang === "mn" ? "en" : "mn")}
            aria-label={
              lang === "mn" ? "Switch to English" : "Монгол хэл рүү шилжих"
            }
            className="hidden h-10 items-center gap-1.5 rounded-xl bg-background px-3.5 text-sm font-bold text-foreground shadow-(--shadow-card) transition-all hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed) md:flex"
          >
            <Globe size={15} className="text-muted-foreground" />
            {lang === "mn" ? "МН" : "EN"}
          </button>

          {/* Theme toggle — physical rocker, desktop only */}
          <ThemeToggle className="hidden md:inline-flex" />

          {/* Logged out → direct Login CTA (funnel), all breakpoints. */}
          {!isAuthed && !loading && (
            <Button
              render={<Link href="/auth" />}
              variant="shadow"
              size="sm"
              className="gap-1.5 rounded-xl"
            >
              {t("signIn")}
              <LogIn size={16} />
            </Button>
          )}

          {/* Notifications — logged in only. Mobile → page; desktop → dropdown. */}
          {isAuthed && (
            <>
              <Link
                href="/notifications"
                aria-label={t("notifications")}
                className={cn(iconBtn, "relative md:hidden")}
              >
                <Bell size={19} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              <DropdownMenu
                open={notifOpen}
                onOpenChange={(open) => {
                  setNotifOpen(open);
                  if (open) {
                    setPanelSeen(getLastSeen());
                    markSeenNow();
                    const doneIds = finished
                      .filter((g) => g.status === "done")
                      .map((g) => g.id);
                    if (doneIds.length) {
                      setPanelThumbsLoading(true);
                      getNotificationThumbs(doneIds).then((result) => {
                        setPanelThumbs(result);
                        setPanelThumbsLoading(false);
                      });
                    }
                  }
                }}
              >
                <DropdownMenuTrigger
                  aria-label={t("notifications")}
                  className={cn(iconBtn, "relative hidden md:flex")}
                >
                  <Bell size={19} />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-80 rounded-2xl p-2"
                >
                  <div className="px-2 pb-1.5 pt-1 text-sm font-semibold">
                    {t("notifications")}
                  </div>
                  <div className="max-h-104 overflow-y-auto">
                    <NotificationsPanel
                      items={finished}
                      loading={notifLoading}
                      lastSeen={panelSeen}
                      thumbs={panelThumbs}
                      thumbsLoading={panelThumbsLoading}
                      onNavigate={() => setNotifOpen(false)}
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {/* Avatar menu — logged in, desktop only (mobile uses bottom nav) */}
          {isAuthed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden size-10 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-primary/5 text-foreground ring-1 ring-border transition-all hover:ring-primary/60 active:scale-95 md:flex"
                aria-label="Хэрэглэгчийн цэс"
              >
                {avatarUrl ? (
                  <NextImage
                    src={avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <User size={18} />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-64 space-y-1 rounded-2xl p-2"
              >
                {/* Profile header — doubles as the link to /profile (so there's
                    no separate "Profile" list item). Chevron + hover signal it's
                    tappable. */}
                <DropdownMenuItem
                  className={cn(
                    "rounded-xl px-2.5 py-2.5",
                    profileActive
                      ? "bg-primary/10 hover:bg-primary/15 focus-visible:bg-primary/15"
                      : "bg-muted/50 hover:bg-foreground/10 focus-visible:bg-foreground/10",
                  )}
                >
                  <Link
                    href="/profile"
                    className="flex w-full items-center gap-3"
                  >
                    <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-primary/5 ring-1 ring-border">
                      {avatarUrl ? (
                        <NextImage
                          src={avatarUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <User size={18} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          profileActive && "text-primary",
                        )}
                      >
                        {profileName || t("welcomeBack")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t("viewProfile")}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                  </Link>
                </DropdownMenuItem>

                {menuLinks.map((m, i) => {
                  const active = i === activeMenuIndex;
                  return (
                    <DropdownMenuItem
                      key={i}
                      className={cn(
                        "rounded-xl px-2 py-2",
                        // Hover tint is theme-agnostic (base --accent == --popover
                        // in dark mode, so invisible there).
                        active
                          ? "bg-primary/10 hover:bg-primary/15 focus-visible:bg-primary/15"
                          : "hover:bg-foreground/10 focus-visible:bg-foreground/10",
                      )}
                    >
                      <Link
                        href={m.href}
                        className="flex w-full items-center gap-3"
                      >
                        <span
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          <m.icon size={16} />
                        </span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            active && "text-primary",
                          )}
                        >
                          {m.label}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}

                <DropdownMenuSeparator className="my-1.5" />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer rounded-xl px-2 py-2 text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 hover:text-destructive focus-visible:text-destructive"
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

          {/* Mobile account button → account drawer (desktop uses the avatar
              dropdown above). Signed-in only; signed-out uses the CTA above. */}
          {isAuthed && (
            <button
              onClick={() => setAccountOpen(true)}
              aria-label={t("accountMenu")}
              className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-primary/5 text-foreground ring-1 ring-border transition-all active:scale-95 md:hidden"
            >
              {avatarUrl ? (
                <NextImage
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <User size={18} />
              )}
            </button>
          )}

          {/* Neutral skeleton during the auth loading window — prevents the
              wrong-state flash (signed-out CTA or nothing) before the session
              cookie is read. Matches the avatar button's footprint. */}
          {loading && (
            <div className="size-10 animate-pulse rounded-full bg-muted" />
          )}
        </div>
      </div>

      {/* Mobile account drawer — signed-in account surface only. The signed-out
          login prompt (<LoginPrompt>) is reserved for commit-time gates. */}
      {isAuthed && (
        <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
          <SheetContent showCloseButton={false} className="md:hidden">
            <SheetTitle className="sr-only">{t("accountMenu")}</SheetTitle>
            <div className="flex flex-col gap-1">
              {/* Profile header — tap to open /profile (no separate list item). */}
              <Link
                href="/profile"
                onClick={() => setAccountOpen(false)}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-xl px-3 py-3",
                  profileActive
                    ? "bg-primary/10"
                    : "bg-muted/50 active:bg-foreground/5",
                )}
              >
                <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-primary/5 ring-1 ring-border">
                  {avatarUrl ? (
                    <NextImage
                      src={avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <User size={20} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate font-semibold",
                      profileActive && "text-primary",
                    )}
                  >
                    {profileName || t("welcomeBack")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("viewProfile")}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-muted-foreground"
                />
              </Link>

              {menuLinks.map((m, i) => {
                const active = i === activeMenuIndex;
                return (
                  <Link
                    key={i}
                    href={m.href}
                    onClick={() => setAccountOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2 py-2.5",
                      active ? "bg-primary/10" : "active:bg-foreground/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      <m.icon size={17} />
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        active && "text-primary",
                      )}
                    >
                      {m.label}
                    </span>
                  </Link>
                );
              })}

              <div className="my-1.5 h-px bg-border" />

              <button
                onClick={() => {
                  setAccountOpen(false);
                  handleSignOut();
                }}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-destructive active:bg-destructive/10"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <LogOut size={17} />
                </span>
                <span className="text-sm font-medium">{t("signOut")}</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}
