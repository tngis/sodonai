"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, ArrowRight, Clock, Ratio, Images, AlertTriangle,
  ShieldCheck, Check, Camera, Upload, CreditCard, Sparkles, ZoomIn, X, ChevronRight,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getPreset, type Category, type Preset } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/category-icon";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

// One result-preview image with a graceful fallback chain (result → category
// preview → clean placeholder) and a click-to-zoom lightbox.
function ResultPreview({
  candidates, alt, label, note, soonText, fallbackIcon,
}: {
  candidates: string[];
  alt: string;
  label: string;
  note: string;
  soonText: string;
  fallbackIcon: string;
}) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = candidates[idx];

  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-muted ring-1 ring-foreground/10 glow-brand-sm">
        {src ? (
          <button type="button" onClick={() => setZoom(true)} className="group block h-full w-full" aria-label={alt}>
            {/* Keep a shimmer in place until the image actually loads, then fade it in. */}
            {!loaded && <Skeleton className="absolute inset-0 rounded-2xl" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className={cn(
                "h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03]",
                loaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setLoaded(true)}
              onError={() => { setLoaded(false); setIdx((i) => i + 1); }}
            />
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <ZoomIn size={14} />
            </span>
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="text-5xl opacity-60">{fallbackIcon}</span>
            <span className="text-xs">{soonText}</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          {label}
        </span>
      </div>
      <figcaption className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">{note}</figcaption>

      <AnimatePresence>
        {zoom && src && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(false)}
          >
            <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Хаах">
              <X size={18} />
            </button>
            <motion.img
              src={src}
              alt={alt}
              className="max-h-[88vh] max-w-full rounded-xl object-contain"
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </figure>
  );
}

export default function PresetDetailPage({ params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = use(params);
  const { t, lang } = useLang();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    let active = true;
    getPreset(presetId)
      .then((result) => {
        if (!active) return;
        if (!result) { router.replace("/generate"); return; }
        setPreset(result.preset);
        setCategory(result.category);
        setLoading(false);
      })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [presetId, router]);

  // Error → don't get stuck on the skeleton; show a recoverable empty state.
  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">
          {lang === "mn" ? "Пресетийг ачаалахад алдаа гарлаа." : "Failed to load this preset."}
        </p>
        <Button render={<Link href="/generate" />} size="sm" className="rounded-full">{t("back")}</Button>
      </div>
    );
  }

  if (loading || !preset || !category) {
    return <DetailSkeleton />;
  }

  const name = lang === "mn" ? preset.name_mn : preset.name_en;
  const desc = lang === "mn" ? preset.description_mn : preset.description_en;
  const catName = lang === "mn" ? category.name_mn : category.name_en;
  const photosLabel = preset.required_min === preset.required_max
    ? `${preset.required_min}`
    : `${preset.required_min}–${preset.required_max}`;

  // Result preview: result image → category preview image → clean placeholder.
  const imageCandidates = [preset.example_output, category.image_url ?? ""].filter(Boolean) as string[];

  // "Юу гарах вэ?" / "Шаардлагатай зураг" — admin-set (in options) or sensible defaults.
  const benefits = preset.options?.benefits?.length
    ? preset.options.benefits
    : lang === "mn"
      ? [
          preset.output_ratio !== "Original" ? `${preset.output_ratio} харьцаатай зураг` : "Тохирох харьцаатай зураг",
          "AI-ээр боловсруулсан өндөр чанартай үр дүн",
          "Промпт бичих шаардлагагүй, амархан",
        ]
      : [
          preset.output_ratio !== "Original" ? `${preset.output_ratio} aspect ratio` : "Suitable aspect ratio",
          "High-quality, AI-processed result",
          "No prompt writing — just upload",
        ];

  const imageReqs = preset.options?.imageRequirements?.length
    ? preset.options.imageRequirements
    : lang === "mn"
      ? ["Царай тод, гэрэлтүүлэг сайтай зураг оруулна уу.", "Хэт бүдэг, харанхуй зургаас зайлсхийнэ үү."]
      : ["Use clear, well-lit photos of the face.", "Avoid blurry or very dark images."];

  const flowSteps = [
    { icon: Upload, title: t("flowUploadTitle"), desc: t("flowUploadDesc") },
    { icon: CreditCard, title: t("flowPayTitle"), desc: t("flowPayDesc") },
    { icon: Sparkles, title: t("flowResultTitle"), desc: t("flowResultDesc") },
  ];

  // Single primary action → enters the 3-step generate flow.
  const startCta = (
    <Button
      render={<Link href={`/generate/${preset.id}`} />}
      variant="shadow"
      size="lg"
      className="w-full justify-center rounded-full border-2 border-[#737373] bg-primary text-base font-black text-primary-foreground"
    >
      {t("startWithPreset")} <ArrowRight size={18} className="ml-1.5" />
    </Button>
  );

  return (
    <div className="px-4 pt-6 pb-28 md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        {/* Back (browser history) + breadcrumb. Category navigation lives in the
            breadcrumb so the back button stays a simple "previous page". */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/generate"))}
            aria-label={t("back")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <ArrowLeft size={15} />
          </button>
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <Link href="/generate" className="shrink-0 hover:text-foreground">{t("generate")}</Link>
            <ChevronRight size={13} className="shrink-0 opacity-40" />
            <Link href={`/category/${category.id}`} className="shrink-0 hover:text-foreground">{catName}</Link>
            <ChevronRight size={13} className="shrink-0 opacity-40" />
            <span aria-current="page" className="truncate font-medium text-foreground">{name}</span>
          </nav>
        </div>

        {/* ── Hero: image + key info side-by-side (image first on mobile) ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center md:gap-10">
          <motion.div
            className="order-1 md:order-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResultPreview
              candidates={imageCandidates}
              alt={name}
              label={t("presetSample")}
              note={t("sampleNote")}
              soonText={t("sampleSoon")}
              fallbackIcon={category.icon}
            />
          </motion.div>

          <motion.div
            className="order-2 flex flex-col md:order-1"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-primary text-sm">
                <CategoryIcon category={category} />
              </span>
              <span>{catName}</span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-black leading-tight tracking-tight md:text-4xl">{name}</h1>

            {desc && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>}

            <p className="mt-4 text-3xl font-black text-primary">₮{preset.price_mnt.toLocaleString()}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1 text-xs"><Clock size={11} /> {preset.eta_min} {t("min")}</Badge>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs"><Ratio size={11} /> {preset.output_ratio}</Badge>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs"><Images size={11} /> {t("photosNeeded")}: {photosLabel}</Badge>
            </div>

            {/* Desktop CTA (mobile uses the sticky bar below) */}
            <div className="mt-7 hidden md:block">
              {startCta}
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck size={12} /> {lang === "mn" ? "Хувийн, аюулгүй" : "Private & secure"}
              </p>
            </div>
          </motion.div>
        </div>

        {/* ── Юу гарах вэ? ── */}
        <Reveal className="mt-10">
          <h2 className="mb-3 text-lg font-bold">{t("whatYouGet")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-card/40 p-3 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* ── Шаардлагатай зураг ── */}
        <Reveal className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{t("photosNeeded")}</h2>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Images size={15} className="text-primary" />
              {photosLabel} {lang === "mn" ? "зураг шаардлагатай" : "photo(s) needed"}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {imageReqs.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Camera size={15} className="mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* ── Анхааруулга ── */}
        {preset.warnings_mn.length > 0 && (
          <Reveal className="mt-8">
            <h2 className="mb-3 text-lg font-bold">{t("warnings")}</h2>
            <ul className="flex flex-col gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-50/50 p-4 dark:bg-yellow-900/10">
              {preset.warnings_mn.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-yellow-800 dark:text-yellow-200/90">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{w}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {/* ── Хэрхэн ажилладаг вэ? (Upload → Pay → Result) ── */}
        <Reveal className="mt-10">
          <h2 className="mb-4 text-lg font-bold">{t("howItWorks")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {flowSteps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-card/40 p-4 sm:flex-col sm:gap-3">
                <div className="glow-brand-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <s.icon size={18} />
                </div>
                <div>
                  <p className="font-bold leading-tight">{i + 1}. {s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ── Mobile sticky CTA — sits flush above the bottom nav, never covers it ── */}
      <div
        className="fixed inset-x-0 z-40 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        {startCta}
      </div>
    </div>
  );
}

// Skeleton that mirrors the real layout (same wrappers/order/rounding) so the
// transition to content has minimal shift. Responsive like the page itself.
function DetailSkeleton() {
  return (
    <div className="px-4 pt-6 pb-28 md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        {/* Back */}
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Hero */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center md:gap-10">
          {/* Image (first on mobile, right on desktop) */}
          <div className="order-1 md:order-2">
            <Skeleton className="mx-auto aspect-[4/5] w-full max-w-sm rounded-2xl" />
            <Skeleton className="mx-auto mt-2 h-3 w-2/3 max-w-sm" />
          </div>

          {/* Text */}
          <div className="order-2 flex flex-col md:order-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-2 h-9 w-3/4 md:h-11" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-5/6" />
            <Skeleton className="mt-4 h-8 w-28" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            {/* Desktop CTA (mobile uses the sticky bar) */}
            <div className="mt-7 hidden md:block">
              <Skeleton className="h-12 w-full rounded-full" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          </div>
        </div>

        {/* Юу гарах вэ? */}
        <div className="mt-10">
          <Skeleton className="mb-3 h-6 w-32" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        </div>

        {/* Шаардлагатай зураг */}
        <div className="mt-8">
          <Skeleton className="mb-3 h-6 w-36" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>

        {/* Анхааруулга */}
        <div className="mt-8">
          <Skeleton className="mb-3 h-6 w-28" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        {/* Хэрхэн ажилладаг вэ? */}
        <div className="mt-10">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA skeleton */}
      <div
        className="fixed inset-x-0 z-40 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
