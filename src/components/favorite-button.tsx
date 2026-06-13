"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/contexts/LanguageContext";
import { isFavorite as checkFavorite, toggleFavorite } from "@/app/actions/favorites";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  presetId: string;
  /** Seed the state to skip the initial fetch (e.g. profile list — all favorited). */
  initialFavorited?: boolean;
  /** "pill" = bordered button with optional label; "overlay" = circular for image/card overlays. */
  variant?: "pill" | "overlay";
  showLabel?: boolean;
  className?: string;
  /** Notified after a successful toggle — lets parents drop an unfavorited item. */
  onChange?: (favorited: boolean) => void;
}

// Heart toggle for favoriting a preset. Self-contained: fetches its own state
// when `initialFavorited` is omitted, and routes unauthenticated users to /auth.
export function FavoriteButton({
  presetId,
  initialFavorited,
  variant = "pill",
  showLabel = false,
  className,
  onChange,
}: FavoriteButtonProps) {
  const { t } = useLang();
  const router = useRouter();
  const [favorited, setFavorited] = useState(!!initialFavorited);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialFavorited !== undefined) return;
    let active = true;
    checkFavorite(presetId)
      .then((v) => { if (active) setFavorited(v); })
      .catch(() => {}); // not signed in → leave as not-favorited
    return () => { active = false; };
  }, [presetId, initialFavorited]);

  // Adopt the flag when a parent bulk-loads favorites after the cards render
  // (e.g. a grid that fetches all favorite ids once, not per-card). Only fires
  // on an actual prop change, so it never clobbers an optimistic toggle.
  useEffect(() => {
    if (initialFavorited !== undefined) setFavorited(initialFavorited);
  }, [initialFavorited]);

  const handleClick = (e: React.MouseEvent) => {
    // Guard against parent <Link>/card navigation when used as an overlay.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !favorited;
    setFavorited(next); // optimistic
    startTransition(async () => {
      try {
        const result = await toggleFavorite(presetId);
        setFavorited(result);
        onChange?.(result);
        toast.success(result ? t("addedToFavorites") : t("removedFromFavorites"));
      } catch (err) {
        setFavorited(!next); // revert
        const msg = err instanceof Error ? err.message : "Алдаа гарлаа.";
        if (msg.includes("Нэвтэрч")) { router.push("/auth"); return; }
        toast.error(msg);
      }
    });
  };

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={favorited}
        aria-label={t("favoritePresets")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 active:scale-95",
          className
        )}
      >
        <Heart size={16} className={cn("transition-colors", favorited && "fill-primary text-primary")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={t("favorite")}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold transition-all",
        showLabel ? "h-9 px-4" : "h-9 w-9",
        favorited
          ? "bg-primary/10 text-primary shadow-(--shadow-pressed) glow-brand-sm"
          : "bg-background text-muted-foreground shadow-(--shadow-card) hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed)",
        className
      )}
    >
      <Heart size={16} className={cn(favorited && "fill-primary")} />
      {showLabel && <span>{t("favorite")}</span>}
    </button>
  );
}
