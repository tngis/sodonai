"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getCategories, type CategoryWithPresets } from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-black tracking-tight md:text-3xl">{t("generate")}</h1>
        <p className="mb-8 text-muted-foreground">Ангилал сонгоод эхэл</p>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/category/${cat.id}`}>
                <Card className="group cursor-pointer border-border transition-all hover:border-primary hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-3xl">
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{lang === "mn" ? cat.name_mn : cat.name_en}</p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {lang === "mn" ? cat.description_mn : cat.description_en}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {cat.presets.map((p) => (
                          <Badge key={p.id} variant="secondary" className="text-xs">
                            ₮{p.price_mnt.toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <ArrowRight size={18} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
