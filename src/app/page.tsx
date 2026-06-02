"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Clock, Shield, Sparkles } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getCategories, type CategoryWithPresets } from "@/lib/catalog";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion/reveal";
import { HeroVisual } from "@/components/home/hero-visual";
import { ResultsMarquee } from "@/components/home/results-marquee";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { t, lang } = useLang();
  const [categories, setCategories] = useState<CategoryWithPresets[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then((data) => {
      setCategories(data);
      setLoading(false);
    });
  }, []);

  const steps = [
    { num: "01", title: t("step1Title"), desc: t("step1Desc") },
    { num: "02", title: t("step2Title"), desc: t("step2Desc") },
    { num: "03", title: t("step3Title"), desc: t("step3Desc") },
  ];

  const stats = [
    { icon: Clock, label: "₮1,900-с эхлэнэ" },
    { icon: Shield, label: "Хувийн, аюулгүй" },
    { icon: Sparkles, label: "QPay дэмжинэ" },
  ];

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="grain mesh-bg relative overflow-hidden px-4 pb-16 pt-12 md:px-6 md:pt-20 lg:pt-28">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.h2
            className="mb-3 font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl md:text-2xl lg:text-3xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            {t("heroTitle")}
          </motion.h2>
          <motion.h1
            className="mb-3 font-display text-4xl font-black leading-tight tracking-tight sm:text-4xl md:text-4xl lg:text-6xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            <span className="block text-primary text-glow">{t("heroSubtitle")}</span>
          </motion.h1>

          <motion.p
            className="mx-auto mb-8 max-w-xl text-base text-muted-foreground sm:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
          >
            {t("heroDesc")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
          >
            <Link
              href="/generate"
              className={cn(buttonVariants({ variant: "shadow", size: "lg" }), "bg-primary text-purple-500 rounded-full text-lg px-8 font-bold")}
            >
              {t("getStarted")}
            </Link>
          </motion.div>

          <HeroVisual />

          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-4">
                {i > 0 && <div className="hidden h-4 w-px bg-border sm:block" />}
                <div className="flex items-center gap-1.5">
                  <s.icon size={14} className="text-primary" />
                  <span>{s.label}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="px-4 pb-12 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="mb-6 font-display text-xl font-bold tracking-tight sm:text-2xl">{t("categories")}</h2>
          </Reveal>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          ) : (
            <RevealStagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {categories.map((cat) => (
                <RevealItem key={cat.id}>
                  <Link href={`/category/${cat.id}`}>
                    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                      <Card className="glass glow-brand-hover group h-full cursor-pointer">
                        <CardContent className="flex flex-col gap-2 p-4">
                          <span className="text-3xl transition-transform duration-300 group-hover:scale-110">{cat.icon}</span>
                          <div>
                            <p className="font-semibold leading-tight">{lang === "mn" ? cat.name_mn : cat.name_en}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {lang === "mn" ? cat.description_mn : cat.description_en}
                            </p>
                          </div>
                          <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary">
                            <span>{cat.presets.length} пресет</span>
                            <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          )}
        </div>
      </section>

      {/* ── Social proof: results wall ── */}
      <section className="px-4 py-8 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <ResultsMarquee />
          </Reveal>
        </div>
      </section>

      {/* ── Featured presets carousel ── */}
      <section className="relative px-4 py-12 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="mb-6 font-display text-xl font-bold tracking-tight sm:text-2xl">{t("featuredPresets")}</h2>
          </Reveal>
          <div
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide"
            style={{ maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent)" }}
          >
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 w-52 shrink-0 rounded-2xl" />)
              : categories.flatMap((cat) =>
                  cat.presets.map((preset) => (
                    <Link key={preset.id} href={`/generate/${preset.id}`} className="min-w-[200px] max-w-[220px] shrink-0 snap-start">
                      <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
                        <Card className="glass glow-brand-hover group h-full cursor-pointer overflow-hidden py-0">
                          <div className="flex h-36 items-center justify-center bg-linear-to-br from-muted to-muted/50 text-5xl transition-transform duration-500 group-hover:scale-105">
                            {cat.icon}
                          </div>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground">{lang === "mn" ? cat.name_mn : cat.name_en}</p>
                            <p className="font-semibold">{lang === "mn" ? preset.name_mn : preset.name_en}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-sm font-bold text-primary">₮{preset.price_mnt.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{preset.eta_min} {t("min")}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </Link>
                  ))
                )}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="mb-8 text-center font-display text-xl font-bold tracking-tight sm:text-2xl">{t("howItWorks")}</h2>
          </Reveal>
          <RevealStagger className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <RevealItem key={i}>
                <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <div className="glow-brand-sm mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <span className="text-sm font-black">{step.num}</span>
                  </div>
                  <h3 className="mb-1 font-bold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="mx-4 mb-12 md:mx-6">
        <Reveal>
          <div className="glow-brand grain relative overflow-hidden rounded-2xl">
            <div className="relative z-10 flex flex-col items-center gap-4 bg-primary px-6 py-10 text-center text-primary-foreground sm:flex-row sm:justify-between sm:text-left">
              <div>
                <p className="font-display text-xl font-black sm:text-2xl">Өнөөдөр эхэл</p>
                <p className="mt-1 text-sm opacity-80">Промпт бичихгүйгээр гэр бүлийн зургаа бүтээ.</p>
              </div>
              <Link href="/generate" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full shrink-0 rounded-full font-bold sm:w-auto")}>
                {t("getStarted")}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
