"use client";

import { useTheme } from "next-themes";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Globe, Lock, Bell, HelpCircle, FileText, ChevronRight, Trash2, Download, LogOut, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { exportUserData, deleteAccount } from "@/app/actions/account";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displaySub, setDisplaySub] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("users").select("name, phone").eq("id", user.id).single();
      setDisplayName(data?.name || user.email?.split("@")[0] || "Хэрэглэгч");
      const sub = data?.phone && data.phone !== "" ? `+976 ${data.phone}` : (user.email ?? "");
      setDisplaySub(sub);
    });
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
    { value: "light",  label: t("themeLight"),  icon: Sun },
    { value: "dark",   label: t("themeDark"),   icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ] as const;

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-2xl font-black tracking-tight md:text-3xl">{t("settings")}</h1>

        {/* Language */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Globe size={12} /> {t("language")}
          </div>
          <div className="flex gap-1 rounded-xl border border-border p-1">
            {(["mn", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "relative flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors",
                  lang === l ? "text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {lang === l && (
                  <motion.span
                    layoutId="settings-lang-pill"
                    className="absolute inset-0 rounded-lg bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{l === "mn" ? "Монгол" : "English"}</span>
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
                  "flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all",
                  theme === value ? "border-primary bg-primary/10 text-primary glow-brand-sm" : "border-border hover:border-primary/30"
                )}
              >
                <Icon size={20} /> {label}
              </motion.button>
            ))}
          </div>
        </section>

        <Separator className="my-6" />

        {/* Account */}
        <section className="mb-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("account")}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              {displayName ? (
                <>
                  <p className="font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displaySub}</p>
                </>
              ) : (
                <>
                  <Skeleton className="mb-1.5 h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Lock size={12} /> {t("privacy")}
          </div>
          <div className="flex flex-col gap-1">
            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                {exporting ? <Loader2 size={16} className="animate-spin text-muted-foreground" /> : <Download size={16} className="text-muted-foreground" />}
                <span className="font-medium">{t("exportData")}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {/* Delete — two-step confirm */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-between rounded-xl border border-destructive/30 px-4 py-3 text-left text-destructive hover:bg-destructive/5"
              >
                <div className="flex items-center gap-2">
                  <Trash2 size={16} />
                  <span className="font-medium">{t("deleteData")}</span>
                </div>
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                <p className="mb-1 font-semibold text-destructive">Бүртгэл бүрмөсөн устгах уу?</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Таны бүх захиалга, зураг, төлбөрийн мэдээлэл устгагдах бөгөөд энэ үйлдлийг буцаах боломжгүй.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full"
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
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
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="font-medium text-muted-foreground">Push мэдэгдэл — удахгүй</span>
          </div>
        </section>

        <Separator className="my-6" />

        {/* Help & Legal */}
        <section className="mb-8">
          <div className="flex flex-col gap-1">
            {[
              { icon: HelpCircle, label: t("helpFaq"),        href: "/settings#help" },
              { icon: FileText,   label: t("termsOfService"), href: "/terms" },
              { icon: FileText,   label: t("privacyPolicy"),  href: "/privacy" },
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 hover:bg-muted"
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
        <button
          onClick={handleSignOut}
          className={cn(buttonVariants({ variant: "destructive" }), "w-full justify-center rounded-full gap-2")}
        >
          <LogOut size={16} /> {t("signOut")}
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">aistudio.mn v1.0.0</p>
      </div>
    </div>
  );
}
