"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getCategories, type CategoryWithPresets } from "@/lib/catalog";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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
                <Card className="group h-full cursor-pointer overflow-hidden border-border py-0 transition-all hover:border-primary hover:shadow-md">
                  <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-linear-to-br from-muted to-muted/50 text-4xl">
                    <CategoryIcon
                      category={cat}
                      imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <CardContent className="flex flex-col gap-2 p-5">
                    <p className="font-bold">{lang === "mn" ? cat.name_mn : cat.name_en}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {lang === "mn" ? cat.description_mn : cat.description_en}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {cat.presets.length} {lang === "mn" ? "пресет" : "presets"}
                      </span>
                      <Button variant="shadow" className="cursor-pointer flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground transition-transform group-hover:translate-x-0.5">
                        {lang === "mn" ? "Сонгох" : "Select"}
                        <ArrowRight size={14} />
                      </Button>
                    </div>
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
