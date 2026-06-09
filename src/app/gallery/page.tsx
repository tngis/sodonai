"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import { Download, Share2, Frame, AlertTriangle, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useUserGenerations } from "@/lib/use-generations";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Placeholder card shown while a generation is still running. Ticks an elapsed
// counter; it's replaced by the real image once the generation finishes.
function GeneratingCard({ createdAt }: { createdAt: string }) {
  const { t, lang } = useLang();
  const elapsedOf = () => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const [elapsed, setElapsed] = useState(elapsedOf);
  useEffect(() => {
    const id = setInterval(() => setElapsed(elapsedOf()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt]);
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl bg-muted ring-1 ring-foreground/10">
      <Loader2 size={22} className="animate-spin text-primary" />
      <p className="px-2 text-center text-xs font-medium text-muted-foreground">
        {t("generating")} · {elapsed}{lang === "mn" ? "с" : "s"}
      </p>
    </div>
  );
}

interface GalleryItem {
  id: string;
  generation_id: string | null;
  storage_path: string;
  signedUrl: string;
  created_at: string;
}

export default function GalleryPage() {
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // In-progress generations (polled). When one finishes, its asset is auto-saved
  // server-side, so we reload the gallery to swap the placeholder for the image.
  const { active } = useUserGenerations();
  const prevActive = useRef(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: assets } = await supabase
      .from("assets")
      .select("id, generation_id, storage_path, created_at")
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

  // When the number of running generations drops, a new result is ready — refresh.
  useEffect(() => {
    if (active.length < prevActive.current) load();
    prevActive.current = active.length;
  }, [active.length, load]);

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
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3 }}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
                onClick={() => img.generation_id && router.push(`/output?id=${img.generation_id}`)}
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
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/print?asset=${encodeURIComponent(img.storage_path)}`); }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-black hover:brightness-110"
                    aria-label={t("orderPrint")}
                  >
                    <Frame size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="text-5xl opacity-30">🖼️</div>
            <p className="text-muted-foreground">{t("noImages")}</p>
            <Button render={<Link href="/generate" />} size="sm" className="rounded-full">
              {t("startGenerating")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
