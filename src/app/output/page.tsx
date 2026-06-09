"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Download, Frame, Share2, RefreshCw, Flag, X, ZoomIn, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { reportGeneration } from "@/app/actions/generation";
import { Button } from "@/components/ui/button";
import { Celebrate } from "@/components/motion/celebrate";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn, saveImageToDevice } from "@/lib/utils";

const OUTPUTS_BUCKET = "outputs";

interface GenerationResult {
  id: string;
  status: string;
  result_urls: string[] | null;
  error: string | null;
}

function OutputContent() {
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const generationId = searchParams.get("id");

  const [gen, setGen] = useState<GenerationResult | null>(null);
  const [signedImageUrls, setSignedImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const load = useCallback(async () => {
    if (!generationId) { setLoading(false); return; }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("generations")
      .select("id, status, result_urls, error")
      .eq("id", generationId)
      .single();

    if (error || !data) { setLoading(false); return; }
    // Cast needed because @supabase/supabase-js type inference breaks with TS 5.9+
    const typed = data as unknown as GenerationResult;
    setGen(typed);

    // Convert storage paths to signed URLs so <Image> can load private files.
    // Storage paths start without "http"; public URLs (legacy mock) pass through.
    if (typed.result_urls?.length) {
      const storagePaths = typed.result_urls.filter((u) => !u.startsWith("http"));
      const publicUrls = typed.result_urls.filter((u) => u.startsWith("http"));

      if (storagePaths.length > 0) {
        const { data: signedData } = await supabase.storage
          .from(OUTPUTS_BUCKET)
          .createSignedUrls(storagePaths, 3600);
        const resolved = (signedData ?? []).map((d) => d.signedUrl ?? "").filter(Boolean);
        setSignedImageUrls([...publicUrls, ...resolved]);
      } else {
        setSignedImageUrls(publicUrls);
      }
    }

    setLoading(false);
  }, [generationId]);

  useEffect(() => { load(); }, [load]);

  // Fire the celebration once, when results first appear
  useEffect(() => {
    if (gen?.status === "done" && signedImageUrls.length > 0) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 2200);
      return () => clearTimeout(id);
    }
  }, [gen?.status, signedImageUrls.length]);

  // Lightbox keyboard nav: Esc to close, ←/→ to move between results
  useEffect(() => {
    if (previewIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewIdx(null);
      if (e.key === "ArrowRight") setPreviewIdx((i) => (i === null ? i : (i + 1) % signedImageUrls.length));
      if (e.key === "ArrowLeft") setPreviewIdx((i) => (i === null ? i : (i - 1 + signedImageUrls.length) % signedImageUrls.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIdx, signedImageUrls.length]);

  const handleDownload = async (url: string, index: number) => {
    try {
      await saveImageToDevice(url, `aistudio_${index + 1}`);
    } catch {
      toast.error("Татахад алдаа гарлаа.");
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < signedImageUrls.length; i++) {
      await handleDownload(signedImageUrls[i], i);
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

  const handleReport = async () => {
    if (!generationId) return;
    await reportGeneration(generationId);
    toast.info(t("report") + " — баярлалаа.");
  };

  const handleRegenerate = () => {
    router.push("/generate");
  };

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  // ── No ID ─────────────────────────────────────────────────
  if (!generationId || !gen) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle size={40} className="text-destructive" />
        <p className="font-bold">Зургийн мэдээлэл олдсонгүй.</p>
        <Button render={<Link href="/generate" />} className="rounded-full">
          Шинэ зураг үүсгэх
        </Button>
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────
  if (gen.status === "failed") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle size={28} className="text-destructive" />
        </div>
        <h1 className="text-xl font-black">Боловсруулалт амжилтгүй боллоо</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {gen.error ?? "Техникийн алдаа гарлаа."}
        </p>
        <p className="text-xs text-muted-foreground">
          Төлбөр буцаах асуудлаар тусламж хэсгээс холбогдоно уу.
        </p>
        <Button onClick={handleRegenerate} className="rounded-full font-bold">
          Дахин оролдох
        </Button>
      </div>
    );
  }

  // ── Still processing (direct URL hit before done) ─────────
  if (gen.status !== "done" || !signedImageUrls.length) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-muted-foreground">Зургийг боловсруулж байна...</p>
        <Button variant="outline" onClick={() => router.push(`/progress?id=${generationId}`)} className="rounded-full">
          Явцыг харах
        </Button>
      </div>
    );
  }

  const images = signedImageUrls;

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      {celebrate && <Celebrate />}
      <div className="mx-auto max-w-4xl">

        {/* Success banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="glow-brand-sm mb-6 flex items-center gap-3 rounded-xl p-4"
          style={{ background: "#D1FE1815", border: "1px solid #D1FE1840" }}
        >
          <motion.div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#D1FE18" }}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
          >
            <span className="text-sm font-black text-black">✓</span>
          </motion.div>
          <p className="text-sm font-medium">{t("outputTitle")}</p>
        </motion.div>

        {/* Image left · actions right on desktop; stacked full-width on mobile */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          {/* Images — natural aspect ratio (not cropped to a square) */}
          <div className={cn("grid flex-1 gap-4 grid-cols-1", images.length > 1 && "sm:grid-cols-2")}>
            {images.map((url, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group relative overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10"
              >
                <Image
                  src={url}
                  alt={`Generated image ${i + 1}`}
                  width={0}
                  height={0}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  unoptimized
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <button
                    onClick={() => setPreviewIdx(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
                    aria-label="Томруулах"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(url, i)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black hover:bg-white"
                    aria-label={t("download")}
                  >
                    <Download size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Actions — full-width stack; fixed right column on desktop */}
          <div className="flex w-full flex-col gap-3 lg:w-80 lg:shrink-0">
            <Button onClick={handleDownloadAll} className="w-full justify-center rounded-full font-bold">
              <Download size={16} className="mr-2" /> {t("download")}
            </Button>
            <Button
              render={<Link href={`/print?gen=${generationId}`} />}
              className="w-full justify-center rounded-full bg-primary font-bold text-black"
              variant="shadow"
            >
              <Frame size={16} className="mr-2" /> {t("orderPrint")}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center rounded-full"
              onClick={() => images[0] && handleShare(images[0])}
            >
              <Share2 size={16} className="mr-2" /> {t("share")}
            </Button>
            <Button variant="ghost" className="w-full justify-center rounded-full text-muted-foreground" onClick={handleRegenerate}>
              <RefreshCw size={16} className="mr-2" /> {t("regenerate")}
            </Button>
            <button
              onClick={handleReport}
              className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Flag size={12} /> {t("report")}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox — arrows + drag-swipe between results */}
      <AnimatePresence>
        {previewIdx !== null && images[previewIdx] && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Зургийн томруулсан харагдац"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setPreviewIdx(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewIdx}
                  className="relative h-[72vh] touch-pan-y overflow-hidden rounded-2xl"
                  drag={images.length > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -80) setPreviewIdx((i) => (i === null ? i : (i + 1) % images.length));
                    else if (info.offset.x > 80) setPreviewIdx((i) => (i === null ? i : (i - 1 + images.length) % images.length));
                  }}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                >
                  <Image src={images[previewIdx]} alt={`Result ${previewIdx + 1}`} fill className="object-contain" sizes="100vw" unoptimized draggable={false} />
                </motion.div>
              </AnimatePresence>

              <button
                onClick={() => setPreviewIdx(null)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Хаах"
              >
                <X size={16} />
              </button>

              {/* Prev / Next */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setPreviewIdx((i) => (i === null ? i : (i - 1 + images.length) % images.length))}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Өмнөх"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPreviewIdx((i) => (i === null ? i : (i + 1) % images.length))}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Дараах"
                  >
                    <ChevronRight size={18} />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {images.map((_, i) => (
                      <span key={i} className={cn("h-1.5 rounded-full transition-all", i === previewIdx ? "w-5 bg-primary" : "w-1.5 bg-white/40")} />
                    ))}
                  </div>
                </>
              )}

              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                <Button size="sm" className="rounded-full" onClick={() => handleDownload(images[previewIdx], previewIdx)}>
                  <Download size={14} className="mr-1" /> {t("download")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full border-white/20 bg-black/40 text-white hover:bg-black/60"
                  onClick={() => handleShare(images[previewIdx])}
                >
                  <Share2 size={14} className="mr-1" /> {t("share")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OutputPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    }>
      <OutputContent />
    </Suspense>
  );
}
