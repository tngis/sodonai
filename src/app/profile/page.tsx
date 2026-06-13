"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, Mail, Pencil, Check, X, Loader2, Heart, Settings, Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";
import { getProfile, updateProfileName, type Profile } from "@/app/actions/profile";
import { getWalletBalance } from "@/app/actions/wallet";
import { formatMnt } from "@/lib/wallet";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { FavoritePresets } from "@/components/profile/favorite-presets";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ProfilePage() {
  const { t } = useLang();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => { setProfile(p); setLoading(false); })
      .catch(() => router.push("/auth"));
    getWalletBalance().then(setWalletBalance).catch(() => {});
  }, [router]);

  const startEdit = () => {
    setNameDraft(profile?.name ?? "");
    setEditingName(true);
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await updateProfileName(nameDraft);
      setProfile((p) => (p ? { ...p, name: nameDraft.trim() } : p));
      setEditingName(false);
      toast.success(t("profileUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">{t("profile")}</h1>
          <Link
            href="/settings"
            aria-label={t("settings")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-(--shadow-card) transition-all hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed)"
          >
            <Settings size={18} />
          </Link>
        </div>

        {/* ── Wallet ── */}
        <Link
          href="/wallet"
          className="mb-8 flex items-center gap-4 rounded-2xl bg-linear-to-br from-primary/15 to-primary/5 p-5 shadow-(--shadow-card) ring-1 ring-primary/20 transition-all hover:ring-primary/40 active:translate-y-px active:shadow-(--shadow-pressed)"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Wallet size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("wallet")}</p>
            {walletBalance === null ? (
              <Skeleton className="mt-1 h-7 w-28" />
            ) : (
              <p className="text-2xl font-black text-primary">{formatMnt(walletBalance)}</p>
            )}
          </div>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
        </Link>

        {/* ── Profile picture ── */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <User size={12} /> {t("profilePicture")}
          </div>
          {loading || !profile ? (
            <div className="flex items-center gap-6">
              <Skeleton className="h-28 w-28 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <AvatarUploader
              initialUrl={profile.avatarUrl}
              onChange={(url) => setProfile((p) => (p ? { ...p, avatarUrl: url } : p))}
            />
          )}
        </section>

        {/* ── Personal information ── */}
        <section className="mb-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("personalInfo")}
          </div>

          <div className="flex flex-col gap-2">
            {/* Name (editable) */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-(--shadow-recessed)">
              <User size={16} className="shrink-0 text-muted-foreground" />
              {loading || !profile ? (
                <Skeleton className="h-4 w-32" />
              ) : editingName ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    autoFocus
                    value={nameDraft}
                    maxLength={80}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    placeholder={t("namePlaceholder")}
                    className="h-9"
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    aria-label={t("saveChanges")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[4px_4px_8px_rgba(166,50,60,0.45),-4px_-4px_8px_rgba(255,107,117,0.45)] transition-all hover:brightness-110 active:translate-y-px active:shadow-[inset_4px_4px_8px_rgba(166,50,60,0.55),inset_-4px_-4px_8px_rgba(255,107,117,0.4)] disabled:opacity-60"
                  >
                    {savingName ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                    aria-label={t("cancelBtn")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-(--shadow-card) transition-all hover:text-foreground active:shadow-(--shadow-pressed)"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <span className={profile.name ? "flex-1 font-medium" : "flex-1 text-muted-foreground"}>
                    {profile.name || t("nameNotSet")}
                  </span>
                  <button
                    onClick={startEdit}
                    aria-label={t("editProfile")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-(--shadow-card) transition-all hover:text-foreground active:shadow-(--shadow-pressed)"
                  >
                    <Pencil size={15} />
                  </button>
                </>
              )}
            </div>

            {/* Phone (read-only) */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-(--shadow-recessed)">
              <Phone size={16} className="shrink-0 text-muted-foreground" />
              {loading || !profile ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <span className={profile.phone ? "font-medium" : "text-muted-foreground"}>
                  {profile.phone ? `+976 ${profile.phone}` : "—"}
                </span>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-(--shadow-recessed)">
              <Mail size={16} className="shrink-0 text-muted-foreground" />
              {loading || !profile ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                <span className={profile.email ? "truncate font-medium" : "text-muted-foreground"}>
                  {profile.email || "—"}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Favorite presets ── */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Heart size={12} /> {t("favoritePresets")}
          </div>
          <FavoritePresets />
        </section>
      </div>
    </div>
  );
}
