"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Bell, User, Settings, LogOut, HelpCircle, ShoppingBag } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground">
            AI
          </span>
          <span className="hidden font-display text-sm font-bold tracking-tight sm:block">aistudio.mn</span>
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Language toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs font-semibold"
            onClick={() => setLang(lang === "mn" ? "en" : "mn")}
            aria-label={lang === "mn" ? "Switch to English" : "Монгол хэл рүү шилжих"}
          >
            {lang === "mn" ? "EN" : "МН"}
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={cycleTheme}
            aria-label="Загвар солих"
          >
            {themeIcon}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Мэдэгдэл">
            <Bell size={18} />
          </Button>

          {/* Avatar menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
              aria-label="Хэрэглэгчийн цэс"
            >
              <User size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem>
                <Link href="/gallery" className="flex w-full items-center gap-2">
                  <User size={14} /> {t("myGallery")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/orders" className="flex w-full items-center gap-2">
                  <ShoppingBag size={14} /> {t("myOrders")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/settings" className="flex w-full items-center gap-2">
                  <Settings size={14} /> {t("settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/settings" className="flex w-full items-center gap-2">
                  <HelpCircle size={14} /> {t("helpFaq")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut size={14} /> {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
