"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Ratio,
  Images,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import {
  getCategories,
  type CategoryWithPresets,
  type Preset,
} from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Max presets shown inline per category row; the rest live behind "See all".
const ROW_LIMIT = 6;

// Every card in the row uses ONE aspect ratio so they're all the same size,
// regardless of each preset's native output ratio. object-cover crops the image
// to fill it (no letterboxing). The true ratio is still shown on the detail page.
const CARD_ASPECT = "4 / 5";

// Result image — the wrapper carries the preset's aspect ratio, so object-cover
// fills edge-to-edge with no letterbox/pillarbox. Falls back to the category emoji.
function PosterImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted/50 text-6xl">
        {fallback}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover object-center"
      onError={() => setError(true)}
    />
  );
}

// Preset card: poster (true aspect ratio) + basic info below. On hover, a details
// panel slides UP from inside the card's bottom edge — clipped by the poster's
// overflow-hidden so it reads as part of the card, not a floating popover.
function PresetCard({
  preset,
  cat,
}: {
  preset: Preset;
  cat: CategoryWithPresets;
}) {
  const { t, lang } = useLang();
  const name = lang === "mn" ? preset.name_mn : preset.name_en;

  return (
    <Link
      href={`/preset/${preset.id}`}
      className="group block w-44 shrink-0 snap-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-52 md:w-[280px]"
    >
      <Card className="overflow-hidden border-border transition-colors duration-200 group-hover:border-primary/55 group-focus-visible:border-primary/55">
        <div
          className="relative w-full overflow-hidden bg-muted"
          style={{ aspectRatio: CARD_ASPECT }}
        >
          <PosterImage
            src={preset.example_output}
            alt={name}
            fallback={cat.icon}
          />

          {/* Details panel — parked just below the poster's bottom edge, then slides
              up into view on hover. The poster's overflow-hidden clips it, so it
              reads as emerging from inside the card. */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0">
            <HoverDetails preset={preset} cat={cat} />
          </div>
        </div>
        <CardContent className="p-3">
          <p className="truncate font-semibold leading-tight">{name}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-sm font-bold text-primary">
              ₮{preset.price_mnt.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} /> {preset.eta_min} {t("min")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Details panel content shown inside the card on hover. Rendered with a span-based
// CTA (not a <Link>) because it lives inside the card's parent <Link> — nesting
// anchors is invalid, and clicking anywhere on the card already opens the preset.
function HoverDetails({
  preset,
  cat,
}: {
  preset: Preset;
  cat: CategoryWithPresets;
}) {
  const { t, lang } = useLang();
  const name = lang === "mn" ? preset.name_mn : preset.name_en;
  const desc = lang === "mn" ? preset.description_mn : preset.description_en;
  const catName = lang === "mn" ? cat.name_mn : cat.name_en;
  const photos =
    preset.required_min === preset.required_max
      ? `${preset.required_min}`
      : `${preset.required_min}–${preset.required_max}`;

  return (
    <div className="flex flex-col gap-2 border-t border-white/12 bg-[#141414]/50 p-4 backdrop-blur-md">
      <span className="self-start rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
        {catName}
      </span>
      <p className="font-bold leading-tight text-white">{name}</p>
      {desc && (
        <p className="line-clamp-2 text-xs leading-relaxed text-white/70">
          {desc}
        </p>
      )}
      <p className="text-lg font-black text-white">
        ₮{preset.price_mnt.toLocaleString()}
      </p>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-white/65">
        <span className="flex items-center gap-1">
          <Clock size={11} /> {preset.eta_min} {t("min")}
        </span>
        <span className="flex items-center gap-1">
          <Ratio size={11} /> {preset.output_ratio}
        </span>
        <span className="flex items-center gap-1">
          <Images size={11} /> {photos}
        </span>
      </div>
      <span className="mt-1 flex items-center justify-center gap-1 rounded-full bg-white py-2 text-sm font-black text-black">
        {t("details")} <ArrowRight size={14} />
      </span>
    </div>
  );
}

function CategoryRow({ cat }: { cat: CategoryWithPresets }) {
  const { t, lang } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // ── Arrow scroll state ──
  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 5);
    setCanNext(Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 5);
  }, []);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollByDir = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (el)
      el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  };

  return (
    <section>
      {/* Row header: category name + "See all" (separate from the scroll arrows) */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight md:text-xl">
          {lang === "mn" ? cat.name_mn : cat.name_en}
        </h2>
        <Link
          href={`/category/${cat.id}`}
          className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary transition-transform hover:translate-x-0.5"
        >
          {t("seeAll")}
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="relative">
        {/* Horizontally scrollable cards (full-bleed on mobile, content-aligned on desktop) */}
        <div
          ref={scrollRef}
          className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto scrollbar-hide px-4 py-2 md:mx-0 md:scroll-pl-2 md:pl-2 md:pr-0"
        >
          {cat.presets.slice(0, ROW_LIMIT).map((preset) => (
            <PresetCard key={preset.id} preset={preset} cat={cat} />
          ))}

          {cat.presets.length > ROW_LIMIT && (
            <Link
              href={`/category/${cat.id}`}
              className="flex w-44 shrink-0 snap-start flex-col items-center justify-center gap-2 self-stretch rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary sm:w-52 md:w-[280px]"
            >
              <ArrowRight size={20} />
              <span className="text-sm font-semibold">{t("seeAll")}</span>
            </Link>
          )}
        </div>

        {/* Prev arrow — desktop only, fades out at the start */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-2 left-0 z-10 hidden w-16 items-center justify-start bg-linear-to-r from-background via-background/80 to-transparent transition-opacity duration-200 md:flex",
            canPrev ? "opacity-100" : "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            disabled={!canPrev}
            aria-label="Scroll previous presets"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur transition hover:border-primary hover:text-primary disabled:pointer-events-none"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Next arrow — desktop only, fades out at the end */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-2 right-0 z-10 hidden w-16 items-center justify-end bg-linear-to-l from-background via-background/80 to-transparent transition-opacity duration-200 md:flex",
            canNext ? "opacity-100" : "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            disabled={!canNext}
            aria-label="Scroll next presets"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur transition hover:border-primary hover:text-primary disabled:pointer-events-none"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function GenerateIndexPage() {
  const { t, lang } = useLang();
  const [categories, setCategories] = useState<CategoryWithPresets[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then((data) => {
      setCategories(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-black tracking-tight md:text-3xl">
          {t("generate")}
        </h1>
        <p className="mb-8 text-muted-foreground">
          {lang === "mn"
            ? "Ангилал сонгоод эхэл"
            : "Pick a category to get started"}
        </p>

        {loading ? (
          <div className="flex flex-col gap-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-4 h-6 w-40" />
                <div className="flex gap-4 overflow-hidden py-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="w-44 shrink-0 sm:w-52 md:w-[280px]">
                      <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                      <Skeleton className="mt-2 h-4 w-3/4" />
                      <Skeleton className="mt-2 h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {categories
              .filter((cat) => cat.presets.length > 0)
              .map((cat) => (
                <CategoryRow key={cat.id} cat={cat} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
