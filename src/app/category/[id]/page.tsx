"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Clock, Ratio, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getCategory, type Category, type Preset } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { BeforeAfter } from "@/components/before-after";
import { cn } from "@/lib/utils";

// Shows example_output image; falls back to the category emoji on load error or missing src.
function PresetCardImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-6xl">
        {fallback}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setError(true)}
    />
  );
}

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useLang();

  const [category, setCategory] = useState<Category | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ratioFilter, setRatioFilter] = useState<string>("all");

  useEffect(() => {
    getCategory(id).then((cat) => {
      if (!cat) { setNotFound(true); setLoading(false); return; }
      setCategory(cat);
      setPresets(cat.presets);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="mb-6 h-5 w-20" />
          <Skeleton className="mb-8 h-14 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader2 size={32} className="text-muted-foreground" />
        <p className="text-muted-foreground">Ангилал олдсонгүй.</p>
        <Button render={<Link href="/generate" />} size="sm" className="rounded-full">Буцах</Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-4xl">
        {/* ── Back → generate index, not home ── */}
        <Link href="/generate" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {t("generate")}
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary text-3xl">
            <CategoryIcon category={category} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
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
                          "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                          ratioFilter === f
                            ? "border-primary bg-primary text-primary-foreground glow-brand-sm"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {f === "all" ? "Бүгд" : f}
                      </motion.button>
                    ))}
                  </div>
                )}

                <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {shown.map((preset) => (
                <Card key={preset.id} className="gap-0 overflow-hidden py-0 border-border transition-all hover:border-primary hover:shadow-md">

                  {/* ── Admin chooses per preset: before/after slider or a single image. ── */}
                  {preset.example_type === "before_after" ? (
                    <BeforeAfter
                      before={preset.example_before ?? ""}
                      after={preset.example_output}
                      fallback={category.icon}
                      className="h-52"
                    />
                  ) : (
                    <div className="h-96 overflow-hidden bg-muted">
                      <PresetCardImage
                        src={preset.example_output}
                        alt={lang === "mn" ? preset.name_mn : preset.name_en}
                        fallback={category.icon}
                      />
                    </div>
                  )}

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

                    <Button render={<Link href={`/preset/${preset.id}`} />} variant="shadow" className="w-full bg-primary text-black justify-center rounded-full font-bold">
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
