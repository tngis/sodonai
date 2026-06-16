"use client";

import { useTheme } from "next-themes";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Lock,
  Bell,
  HelpCircle,
  FileText,
  ChevronRight,
  Trash2,
  Download,
  LogOut,
  Loader2,
  MapPin,
  User,
  Layers,
  Square,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useUiStyle } from "@/lib/use-ui-style";
import { createClient } from "@/lib/supabase/client";
import { exportUserData, deleteAccount } from "@/app/actions/account";
import { AddressManager } from "@/components/settings/address-manager";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const { flat, setFlat, mounted: styleMounted } = useUiStyle();
  const router = useRouter();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displaySub, setDisplaySub] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Local session read (no network); the users query is RLS-scoped to id.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("name, phone")
        .eq("id", user.id)
        .single();
      setDisplayName(data?.name || user.email?.split("@")[0] || "Хэрэглэгч");
      const sub =
        data?.phone && data.phone !== ""
          ? `+976 ${data.phone}`
          : (user.email ?? "");
      setDisplaySub(sub);
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aistudio_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Өгөгдөл татаж авлаа.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Бүртгэл устгагдлаа.");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  const themes = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ] as const;

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">
          {t("settings")}
        </h1>

        {/* Language */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Globe size={12} /> {t("language")}
          </div>
          <div className="flex gap-1 rounded-xl p-1 shadow-(--shadow-recessed)">
            {(["mn", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "relative flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors",
                  lang === l ? "text-primary-foreground" : "cursor-pointer",
                )}
              >
                {lang === l && (
                  <motion.span
                    layoutId="settings-lang-pill"
                    className="absolute inset-0 rounded-lg bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">
                  {l === "mn" ? "Монгол" : "English"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Theme */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Sun size={12} /> {t("theme")}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <motion.button
                key={value}
                whileTap={{ scale: 0.96 }}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl p-3 text-sm font-medium transition-all cursor-pointer",
                  theme === value
                    ? "bg-background text-primary shadow-(--shadow-pressed) glow-brand-sm"
                    : "bg-background text-muted-foreground shadow-(--shadow-card) hover:text-primary active:shadow-(--shadow-pressed)",
                )}
              >
                <Icon size={20} /> {label}
              </motion.button>
            ))}
          </div>
        </section>

        {/* UI style — flat vs neumorphic (orthogonal to light/dark). Active
            state uses a solid fill so it reads in flat mode too, where the
            relief shadow tokens resolve to none. */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Layers size={12} /> {t("uiStyle")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: false, label: t("uiStyleNeu"), icon: Layers },
                { value: true, label: t("uiStyleFlat"), icon: Square },
              ] as const
            ).map(({ value, label, icon: Icon }) => {
              const active = styleMounted && flat === value;
              return (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setFlat(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl p-3 text-sm font-medium transition-all cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground shadow-(--shadow-card) hover:text-primary active:shadow-(--shadow-pressed)",
                  )}
                >
                  <Icon size={20} /> {label}
                </motion.button>
              );
            })}
          </div>
        </section>

        <Separator className="my-6" />

        {/* Account → profile */}
        <section className="mb-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("account")}
          </div>
          <Link
            href="/profile"
            className="flex items-center justify-between rounded-xl px-4 py-3 shadow-(--shadow-card) transition-all hover:shadow-(--shadow-floating)"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/5 ring-1 ring-border">
                <User size={18} />
              </span>
              <div>
                {displayName ? (
                  <>
                    <p className="font-semibold">{displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {displaySub}
                    </p>
                  </>
                ) : (
                  <>
                    <Skeleton className="mb-1.5 h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>
        </section>

        {/* Delivery addresses */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <MapPin size={12} /> {t("deliveryAddresses")}
          </div>
          <AddressManager />
        </section>

        {/* Privacy */}
        <section className="mb-6">
          <div className="mb-3 flex gap-2 items-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Lock size={12} /> {t("privacy")}
          </div>
          <div className="flex flex-col gap-4">
            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-left shadow-(--shadow-card) transition-all hover:shadow-(--shadow-floating) active:shadow-(--shadow-pressed) disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                {exporting ? (
                  <Loader2
                    size={16}
                    className="animate-spin text-muted-foreground"
                  />
                ) : (
                  <Download size={16} className="text-muted-foreground" />
                )}
                <span className="font-medium">{t("exportData")}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {/* Delete — two-step confirm */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-left text-destructive shadow-(--shadow-card) transition-all hover:shadow-(--shadow-floating) active:shadow-(--shadow-pressed)"
              >
                <div className="flex items-center gap-2">
                  <Trash2 size={16} />
                  <span className="font-medium">{t("deleteData")}</span>
                </div>
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="rounded-xl bg-destructive/5 p-4 shadow-(--shadow-card)">
                <p className="mb-1 font-semibold text-destructive">
                  Бүртгэл бүрмөсөн устгах уу?
                </p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Таны бүх захиалга, зураг, төлбөрийн мэдээлэл устгагдах бөгөөд
                  энэ үйлдлийг буцаах боломжгүй.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full"
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : null}
                    Тийм, устга
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Цуцлах
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Bell size={12} /> {t("notifications")}
          </div>
          <div className="flex items-center justify-between rounded-xl px-4 py-3 opacity-60 shadow-(--shadow-recessed)">
            <span className="font-medium text-muted-foreground">
              Push мэдэгдэл — удахгүй
            </span>
          </div>
        </section>

        <Separator className="my-6" />

        {/* Help & Legal */}
        <section className="mb-8">
          <div className="flex flex-col gap-4">
            {[
              { icon: HelpCircle, label: t("helpFaq"), href: "/help" },
              { icon: FileText, label: t("termsOfService"), href: "/terms" },
              { icon: FileText, label: t("privacyPolicy"), href: "/privacy" },
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl px-4 py-3 shadow-(--shadow-card) transition-all hover:shadow-(--shadow-floating)"
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-muted-foreground" />
                  <span className="font-medium">{label}</span>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        {/* Sign out */}
        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full justify-center rounded-full gap-2"
        >
          <LogOut size={16} /> {t("signOut")}
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          aistudio.mn v1.0.0
        </p>
      </div>
    </div>
  );
}
