"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  ratioToCss,
  type CategoryWithPresets,
  type Preset,
} from "@/lib/catalog";
import { listFavoriteIds } from "@/app/actions/favorites";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteButton } from "@/components/favorite-button";
import { CategoryGlyph } from "@/components/category-icon";
import { cn } from "@/lib/utils";

// Max presets shown inline per category row; the rest live behind "See all".
const ROW_LIMIT = 6;

// Fallback poster ratio when the category has no aspect_ratio set (or it's
// "Original"/unknown). Every card in a row uses ONE ratio — the category's —
// so they're all the same size regardless of each preset's native output ratio.
// object-cover crops to fill (no letterboxing); the true ratio is still shown
// on the detail page.
const CARD_ASPECT = "4 / 5";

// Result image — the wrapper carries the preset's aspect ratio, so object-cover
// fills edge-to-edge with no letterbox/pillarbox. Falls back to the category icon.
function PosterImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
}) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
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
  favoriteIds,
}: {
  preset: Preset;
  cat: CategoryWithPresets;
  /** Bulk-loaded favourite ids; null while still loading (heart stays neutral). */
  favoriteIds: Set<string> | null;
}) {
  const { t, lang } = useLang();
  const name = lang === "mn" ? preset.name_mn : preset.name_en;
  // All cards in this category's row share the category's aspect ratio.
  const cardAspect = ratioToCss(cat.aspect_ratio) ?? CARD_ASPECT;

  return (
    <Link
      href={`/preset/${preset.id}`}
      className="group block w-44 shrink-0 snap-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--neu-ring) sm:w-52 md:w-70"
    >
      <Card className="overflow-visible rounded-xl">
        <div
          className="relative w-full overflow-hidden rounded-t-[23px] bg-muted"
          style={{ aspectRatio: cardAspect }}
        >
          <PosterImage
            src={preset.example_output}
            alt={name}
            fallback={
              <CategoryGlyph
                category={cat}
                className="size-9 text-muted-foreground"
              />
            }
          />

          {/* Favourite heart — same overlay as the category grid. Its own click
              handler stops propagation, so tapping it never triggers the card's
              <Link> navigation. */}
          <FavoriteButton
            presetId={preset.id}
            initialFavorited={favoriteIds?.has(preset.id) ?? false}
            variant="overlay"
            className="absolute right-2 top-2 z-10"
          />

          {/* Details panel — parked just below the poster's bottom edge, then slides
              up into view on hover. The poster's overflow-hidden clips it, so it
              reads as an elevated panel emerging from inside the card. Transform only
              (no opacity fade): the panel's backdrop-blur renders late/jumpy while an
              opacity transition runs, so the clip alone handles show/hide.
              transform-gpu gives the slide its own compositor layer up front (kills
              the first-frame promotion lag). No hover-scoped will-change: toggling it
              on at hover-start forces a fresh layer + repaint that "pops" the shadow
              in before the slide begins (and makes show/hide asymmetric). transform-gpu
              alone keeps one stable layer so both directions animate identically. */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full transform-gpu transition-transform duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0 motion-reduce:transition-none">
            <HoverDetails preset={preset} cat={cat} />
          </div>
        </div>
        <CardContent className="p-3">
          <p className="truncate font-semibold leading-tight">{name}</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-sm font-bold">
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
    <div className="relative flex flex-col gap-2.5 rounded-t-xl border-t border-white/55 bg-card/60 p-4 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10">
      {/* Category badge */}
      <span className="self-start rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-white">
        {catName}
      </span>

      {/* Title */}
      <p className="line-clamp-1 text-[15px] font-bold leading-snug text-foreground">
        {name}
      </p>

      {/* Description */}
      {desc && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {desc}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {preset.eta_min} {t("min")}
        </span>
        <span className="opacity-40">·</span>
        <span className="flex items-center gap-1">
          <Ratio size={12} /> {preset.output_ratio}
        </span>
        <span className="opacity-40">·</span>
        <span className="flex items-center gap-1">
          <Images size={12} /> {photos}
        </span>
      </div>

      {/* Price + CTA */}
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-lg font-black tracking-tight text-foreground">
          ₮{preset.price_mnt.toLocaleString()}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[13px] font-bold text-foreground shadow-(--shadow-card)">
          {t("details")} <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
}

function CategoryRow({
  cat,
  favoriteIds,
}: {
  cat: CategoryWithPresets;
  favoriteIds: Set<string> | null;
}) {
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
          className="-mx-4 flex scroll-pl-4 gap-4 overflow-x-auto scrollbar-hide px-4 py-2 md:mx-0 md:scroll-pl-2 md:pl-2 md:pr-0"
        >
          {cat.presets.slice(0, ROW_LIMIT).map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              cat={cat}
              favoriteIds={favoriteIds}
            />
          ))}

          {cat.presets.length > ROW_LIMIT && (
            <Link
              href={`/category/${cat.id}`}
              className="flex w-44 shrink-0 snap-start flex-col items-center justify-center gap-2 self-stretch rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary sm:w-52 md:w-70"
            >
              <ArrowRight size={20} />
              <span className="text-sm font-semibold">{t("seeAll")}</span>
            </Link>
          )}
        </div>

        {/* Prev arrow — desktop only, fades out at the start */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-2 left-0 z-10 hidden w-16 items-center justify-start bg-linear-to-r from-background via-background/20 to-transparent transition-opacity duration-200 md:flex",
            canPrev ? "opacity-100" : "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            disabled={!canPrev}
            aria-label="Scroll previous presets"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-(--shadow-card) transition-all hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed) disabled:pointer-events-none"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Next arrow — desktop only, fades out at the end */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-2 right-0 z-10 hidden w-16 items-center justify-end bg-linear-to-l from-background via-background/20 to-transparent transition-opacity duration-200 md:flex",
            canNext ? "opacity-100" : "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            disabled={!canNext}
            aria-label="Scroll next presets"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-(--shadow-card) transition-all hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed) disabled:pointer-events-none"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function GenerateClient({
  initialCategories,
}: {
  initialCategories: CategoryWithPresets[];
}) {
  const { t, lang } = useLang();
  // Catalog is fetched server-side and passed in — no client fetch waterfall.
  const categories = initialCategories;

  // Favourited preset ids, loaded once so every card across all rows seeds its
  // heart without a per-card request. null = still loading (cards stay neutral).
  const [favoriteIds, setFavoriteIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    listFavoriteIds()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => setFavoriteIds(new Set())); // signed out → none
  }, []);

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">
          {t("generate")}
        </h1>
        <p className="mb-8 text-muted-foreground">
          {lang === "mn"
            ? "Ангилал сонгоод эхэл"
            : "Pick a category to get started"}
        </p>

        <div className="flex flex-col gap-10">
          {categories
            .filter((cat) => cat.presets.length > 0)
            .map((cat) => (
              <CategoryRow key={cat.id} cat={cat} favoriteIds={favoriteIds} />
            ))}
        </div>
      </div>
    </div>
  );
}
