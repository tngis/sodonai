"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Clock, Ratio, Heart, ImageOff } from "lucide-react";
import { motion } from "motion/react";
import { useLang } from "@/contexts/LanguageContext";
import { getFavoritePresets } from "@/app/actions/favorites";
import type { Preset } from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteButton } from "@/components/favorite-button";

function PresetThumb({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
        <ImageOff size={28} className="text-muted-foreground/50" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setError(true)} />
  );
}

export function FavoritePresets() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);

  const load = useCallback(async () => {
    try {
      setPresets(await getFavoritePresets());
    } catch {
      // Not signed in / load error — render the empty state.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeFromList = (id: string) =>
    setPresets((prev) => prev.filter((p) => p.id !== id));

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
        <Heart size={28} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("noFavorites")}</p>
        <Button render={<Link href="/generate" />} size="sm" className="rounded-full">
          {t("browsePresets")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {presets.map((preset, i) => (
        <motion.div
          key={preset.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
        >
          <Card className="group relative gap-0 overflow-hidden py-0 transition-colors hover:border-primary/55">
            <div className="relative aspect-[4/5] overflow-hidden bg-muted">
              <Link href={`/preset/${preset.id}`} className="block h-full w-full">
                <PresetThumb
                  src={preset.example_output}
                  alt={lang === "mn" ? preset.name_mn : preset.name_en}
                />
              </Link>
              <FavoriteButton
                presetId={preset.id}
                initialFavorited
                variant="overlay"
                onChange={(fav) => { if (!fav) removeFromList(preset.id); }}
                className="absolute right-2 top-2"
              />
            </div>
            <CardContent className="p-3">
              <Link href={`/preset/${preset.id}`} className="block">
                <p className="truncate font-semibold leading-tight">
                  {lang === "mn" ? preset.name_mn : preset.name_en}
                </p>
                <div className="mt-1.5">
                  <span className="text-sm font-black text-primary">
                    ₮{preset.price_mnt.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                    <Clock size={10} /> {preset.eta_min} {t("min")}
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                    <Ratio size={10} /> {preset.output_ratio}
                  </Badge>
                </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
