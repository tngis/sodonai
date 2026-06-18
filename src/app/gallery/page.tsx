"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import {
  Download,
  Share2,
  Frame,
  AlertTriangle,
  Loader2,
  UserRound,
  Eye,
  ImageOff,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { getOutputUrlPairs } from "@/app/actions/storage";
import { setAvatarFromGallery } from "@/app/actions/profile";
import { useUserGenerations } from "@/lib/use-generations";
import { saveImageToDevice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Placeholder card shown while a generation is still running. Ticks an elapsed
// counter; it's replaced by the real image once the generation finishes.
function GeneratingCard({ createdAt }: { createdAt: string }) {
  const { t, lang } = useLang();
  const elapsedOf = () =>
    Math.max(
      0,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000),
    );
  const [elapsed, setElapsed] = useState(elapsedOf);
  useEffect(() => {
    const id = setInterval(() => setElapsed(elapsedOf()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt]);
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl shadow-(--shadow-recessed)">
      <Loader2 size={22} className="animate-spin text-primary" />
      <p className="px-2 text-center text-xs font-medium text-muted-foreground">
        {t("generating")} · {elapsed}
        {lang === "mn" ? "с" : "s"}
      </p>
    </div>
  );
}

interface GalleryItem {
  id: string;
  generation_id: string | null;
  storage_path: string;
  thumb_path: string | null;
  is_private: boolean;
  signedUrl: string;
  thumbSignedUrl: string | null;
  created_at: string;
}

export default function GalleryPage() {
  const { t } = useLang();
  const { refreshProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // In-progress generations (polled). When one finishes, its asset is auto-saved
  // server-side, so we reload the gallery to swap the placeholder for the image.
  const { active } = useUserGenerations();
  const prevActive = useRef(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    // getSession reads the local session (no network round-trip); the assets
    // query below is RLS-scoped, so ownership is still enforced server-side.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: assets } = await supabase
      .from("assets")
      .select(
        "id, generation_id, storage_path, thumb_path, is_private, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (assets && assets.length > 0) {
      const pairs = await getOutputUrlPairs(
        assets.map((a) => ({
          path: a.storage_path,
          thumbPath: a.thumb_path ?? null,
        })),
      );
      setGallery(
        assets.map((a, i) => ({
          ...a,
          signedUrl: pairs[i].url,
          thumbSignedUrl: pairs[i].thumbUrl,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // When the number of running generations drops, a new result is ready — refresh.
  useEffect(() => {
    if (active.length < prevActive.current) load();
    prevActive.current = active.length;
  }, [active.length, load]);

  const handleDownload = async (url: string, index: number) => {
    try {
      await saveImageToDevice(url, `aistudio_${index + 1}`);
    } catch {
      toast.error("Татахад алдаа гарлаа.");
    }
  };

  const handleShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "aistudio.mn — AI зураг" });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Линк хуулагдлаа.");
    }
  };

  const [settingAvatar, setSettingAvatar] = useState(false);
  const handleSetProfile = async (storagePath: string) => {
    if (settingAvatar) return;
    setSettingAvatar(true);
    try {
      await setAvatarFromGallery(storagePath);
      refreshProfile();
      toast.success(t("avatarUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setSettingAvatar(false);
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">
          {t("myGallery")}
        </h1>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : active.length > 0 || gallery.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {active.map((g) => (
              <GeneratingCard key={g.id} createdAt={g.created_at} />
            ))}
            {gallery.map((img, i) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.35,
                  delay: Math.min(i * 0.04, 0.4),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
                onClick={() =>
                  img.generation_id &&
                  router.push(`/output?id=${img.generation_id}`)
                }
              >
                {img.signedUrl ? (
                  <Image
                    src={img.thumbSignedUrl ?? img.signedUrl}
                    alt={`Gallery image ${i + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <AlertTriangle
                      size={20}
                      className="text-muted-foreground"
                    />
                  </div>
                )}
                {/* Public-showcase indicator — only on shared images. */}
                {!img.is_private && (
                  <span
                    title={t("sharedBadge")}
                    className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-primary shadow-(--shadow-floating) backdrop-blur-sm"
                  >
                    <Eye size={11} /> {t("sharedBadge")}
                  </span>
                )}
                {/*<div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(img.signedUrl, i);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-(--shadow-floating) backdrop-blur-sm transition-all hover:text-primary active:shadow-(--shadow-pressed)"
                    aria-label="Татах"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(img.signedUrl);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-(--shadow-floating) backdrop-blur-sm transition-all hover:text-primary active:shadow-(--shadow-pressed)"
                    aria-label="Хуваалцах"
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetProfile(img.storage_path);
                    }}
                    disabled={settingAvatar}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-(--shadow-floating) backdrop-blur-sm transition-all hover:text-primary active:shadow-(--shadow-pressed) disabled:opacity-60"
                    aria-label={t("setAsProfilePicture")}
                  >
                    <UserRound size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/print?asset=${encodeURIComponent(img.storage_path)}`,
                      );
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-(--shadow-key) transition-all hover:brightness-110 active:shadow-(--shadow-key-pressed)"
                    aria-label={t("orderPrint")}
                  >
                    <Frame size={14} />
                  </button>
                </div>*/}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ImageOff
              size={40}
              className="text-muted-foreground/50"
              strokeWidth={1.5}
            />
            <p className="text-muted-foreground">{t("noImages")}</p>
            <Button
              render={<Link href="/generate" />}
              size="sm"
              className="rounded-full"
            >
              {t("startGenerating")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
