"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Clock } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getCategories, type CategoryWithPresets, type Preset } from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Max presets shown inline per category row; the rest live behind "See all".
const ROW_LIMIT = 6;

// Shows example_output image; falls back to the category emoji on error/missing src.
function PresetThumb({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <div className="flex h-full w-full items-center justify-center text-5xl">{fallback}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setError(true)} />
  );
}

function PresetCard({ preset, cat }: { preset: Preset; cat: CategoryWithPresets }) {
  const { t, lang } = useLang();
  return (
    <Link href={`/generate/${preset.id}`} className="w-44 shrink-0 snap-start sm:w-48">
      <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
        <Card className="group h-full cursor-pointer overflow-hidden border-border py-0 transition-all hover:border-primary hover:shadow-md">
          <div className="h-40 overflow-hidden bg-linear-to-br from-muted to-muted/50 transition-transform duration-300 group-hover:scale-105">
            <PresetThumb
              src={preset.example_output}
              alt={lang === "mn" ? preset.name_mn : preset.name_en}
              fallback={cat.icon}
            />
          </div>
          <CardContent className="p-3">
            <p className="truncate font-semibold leading-tight">{lang === "mn" ? preset.name_mn : preset.name_en}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-primary">₮{preset.price_mnt.toLocaleString()}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} /> {preset.eta_min} {t("min")}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
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
        <h1 className="mb-2 text-2xl font-black tracking-tight md:text-3xl">{t("generate")}</h1>
        <p className="mb-8 text-muted-foreground">
          {lang === "mn" ? "Ангилал сонгоод эхэл" : "Pick a category to get started"}
        </p>

        {loading ? (
          <div className="flex flex-col gap-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-4 h-6 w-40" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-56 w-44 shrink-0 rounded-2xl sm:w-48" />
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
                <section key={cat.id}>
                  {/* ── Row header: category name + "See all" → ── */}
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

                  {/* ── Horizontally scrollable preset cards ── */}
                  <div className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto scrollbar-hide px-4 pb-2 md:-mx-6 md:scroll-pl-6 md:px-6">
                    {cat.presets.slice(0, ROW_LIMIT).map((preset) => (
                      <PresetCard key={preset.id} preset={preset} cat={cat} />
                    ))}

                    {/* "See all" tail card when there are more than the row limit */}
                    {cat.presets.length > ROW_LIMIT && (
                      <Link
                        href={`/category/${cat.id}`}
                        className="flex w-44 shrink-0 snap-start items-center justify-center sm:w-48"
                      >
                        <div className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                          <ArrowRight size={20} />
                          <span className="text-sm font-semibold">{t("seeAll")}</span>
                        </div>
                      </Link>
                    )}
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
