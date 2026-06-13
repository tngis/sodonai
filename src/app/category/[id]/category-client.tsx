"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Clock, Ratio, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { type CategoryWithPresets } from "@/lib/catalog";
import { listFavoriteIds } from "@/app/actions/favorites";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon, CategoryGlyph } from "@/components/category-icon";
import { PresetCardImage } from "@/components/preset-card-image";
import { FavoriteButton } from "@/components/favorite-button";
import { BeforeAfter } from "@/components/before-after";
import { cn } from "@/lib/utils";

export default function CategoryClient({ initialCategory }: { initialCategory: CategoryWithPresets | null }) {
  const { t, lang } = useLang();

  // Category + its presets are fetched server-side and passed in.
  const category = initialCategory;
  const presets = initialCategory?.presets ?? [];
  const [ratioFilter, setRatioFilter] = useState<string>("all");
  // Favorited preset ids, loaded once so each card seeds its heart without a
  // per-card request. null = still loading (cards stay neutral until it lands).
  const [favoriteIds, setFavoriteIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    listFavoriteIds()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => setFavoriteIds(new Set())); // signed out → none
  }, []);

  if (!category) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader2 size={32} className="text-muted-foreground" />
        <p className="text-muted-foreground">Ангилал олдсонгүй.</p>
        <Button render={<Link href="/generate" />} size="sm" className="rounded-full">Буцах</Button>
      </div>
    );
  }

  // The restoration category is inherently a before→after operation, so every
  // card here is shown as a comparison slider regardless of the per-preset
  // example_type (which still drives the other categories).
  const forceBeforeAfter = category.id === "cat-restoration";

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        {/* ── Back → generate index, not home ── */}
        <Link href="/generate" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {t("generate")}
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary text-3xl shadow-[4px_4px_8px_rgba(166,50,60,0.45),-4px_-4px_8px_rgba(255,107,117,0.45)] glow-brand-sm">
            <CategoryIcon category={category} className="size-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">
              {lang === "mn" ? category.name_mn : category.name_en}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lang === "mn" ? category.description_mn : category.description_en}
            </p>
          </div>
        </div>

        <div>
          {(() => {
            const distinctRatios = [...new Set(presets.map((p) => p.output_ratio))];
            const shown = ratioFilter === "all" ? presets : presets.filter((p) => p.output_ratio === ratioFilter);
            const filters = ["all", ...distinctRatios];
            return (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">{t("presets")}</h2>
                  <motion.span
                    key={shown.length}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-sm text-muted-foreground"
                  >
                    {shown.length} {t("presets").toLowerCase()}
                  </motion.span>
                </div>

                {/* Ratio filter chips (only when there's more than one) */}
                {distinctRatios.length > 1 && (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {filters.map((f) => (
                      <motion.button
                        key={f}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setRatioFilter(f)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                          ratioFilter === f
                            ? "bg-primary text-primary-foreground shadow-[4px_4px_8px_rgba(166,50,60,0.45),-4px_-4px_8px_rgba(255,107,117,0.45)] glow-brand-sm active:shadow-[inset_4px_4px_8px_rgba(166,50,60,0.55),inset_-4px_-4px_8px_rgba(255,107,117,0.4)]"
                            : "bg-background text-muted-foreground shadow-(--shadow-card) hover:text-primary active:shadow-(--shadow-pressed)"
                        )}
                      >
                        {f === "all" ? "Бүгд" : f}
                      </motion.button>
                    ))}
                  </div>
                )}

                <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {shown.map((preset) => (
                <Card key={preset.id} interactive className="relative gap-0 overflow-hidden py-0">

                  {/* ── Admin chooses per preset: before/after slider or a single image.
                       Restoration always uses the slider (see forceBeforeAfter). ── */}
                  {preset.example_type === "before_after" || forceBeforeAfter ? (
                    <BeforeAfter
                      before={preset.example_before || preset.example_inputs[0] || ""}
                      after={preset.example_output}
                      fallback={<CategoryGlyph category={category} className="size-12 text-muted-foreground" />}
                      className="h-52"
                    />
                  ) : (
                    <div className="h-96 overflow-hidden bg-muted">
                      <PresetCardImage
                        src={preset.example_output}
                        alt={lang === "mn" ? preset.name_mn : preset.name_en}
                        fallback={<CategoryGlyph category={category} className="size-14 text-muted-foreground" />}
                      />
                    </div>
                  )}

                  <FavoriteButton
                    presetId={preset.id}
                    initialFavorited={favoriteIds?.has(preset.id) ?? false}
                    variant="overlay"
                    className="absolute right-2 top-2 z-10"
                  />

                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-bold">{lang === "mn" ? preset.name_mn : preset.name_en}</h3>
                      <span className="shrink-0 text-lg font-black text-primary">₮{preset.price_mnt.toLocaleString()}</span>
                    </div>

                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                      {lang === "mn" ? preset.description_mn : preset.description_en}
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        <Clock size={11} /> {preset.eta_min} {t("min")}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        <Ratio size={11} /> {preset.output_ratio}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{preset.steps} алхам</Badge>
                    </div>

                    <Button render={<Link href={`/preset/${preset.id}`} />} variant="shadow" className="w-full bg-primary text-primary-foreground justify-center rounded-full font-bold">
                      {t("details")} <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </CardContent>
                </Card>
                  ))}
                </motion.div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
