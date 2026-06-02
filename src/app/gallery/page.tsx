"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Download, Share2, AlertTriangle } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GalleryItem {
  id: string;
  storage_path: string;
  signedUrl: string;
  created_at: string;
}

export default function GalleryPage() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: assets } = await supabase
      .from("assets")
      .select("id, storage_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (assets && assets.length > 0) {
      const paths = assets.map((a) => a.storage_path);
      const { data: signed } = await supabase.storage.from("outputs").createSignedUrls(paths, 3600);
      const urlMap = Object.fromEntries((signed ?? []).map((s, i) => [paths[i], s.signedUrl ?? ""]));
      setGallery(assets.map((a) => ({ ...a, signedUrl: urlMap[a.storage_path] ?? "" })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const handleDownload = async (url: string, index: number) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `aistudio_${index + 1}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Татахад алдаа гарлаа.");
    }
  };

  const handleShare = async (url: string) => {
    if (navigator.share) {
      try { await navigator.share({ url, title: "aistudio.mn — AI зураг" }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Линк хуулагдлаа.");
    }
  };

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-black tracking-tight md:text-3xl">{t("myGallery")}</h1>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
          </div>
        ) : gallery.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {gallery.map((img, i) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3 }}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
                onClick={() => setPreview(img.signedUrl)}
              >
                {img.signedUrl ? (
                  <Image
                    src={img.signedUrl}
                    alt={`Gallery image ${i + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <AlertTriangle size={20} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(img.signedUrl, i); }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
                    aria-label="Татах"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(img.signedUrl); }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
                    aria-label="Хуваалцах"
                  >
                    <Share2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="text-5xl opacity-30">🖼️</div>
            <p className="text-muted-foreground">{t("noImages")}</p>
            <Link href="/generate" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
              {t("startGenerating")}
            </Link>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {preview && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Зургийн томруулсан харагдац"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setPreview(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="relative w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl">
                <Image src={preview} alt="Preview" fill className="object-contain" sizes="100vw" unoptimized />
              </div>
              <button
                onClick={() => setPreview(null)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Хаах"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
