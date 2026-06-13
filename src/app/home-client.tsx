"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Clock, Shield } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { type CategoryWithPresets, type FeaturedPreset } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
// import { Led } from "@/components/ui/led";
import { PresetCardImage } from "@/components/preset-card-image";
import { CategoryGlyph } from "@/components/category-icon";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion/reveal";
import { HeroVisual } from "@/components/home/hero-visual";
import { HeroSpotlight } from "@/components/home/hero-spotlight";
import { ResultsMarquee } from "@/components/home/results-marquee";

export default function HomeClient({
  initialCategories,
  initialFeatured,
  initialCategoryCovers,
}: {
  initialCategories: CategoryWithPresets[];
  initialFeatured: FeaturedPreset[];
  initialCategoryCovers: Record<string, string>;
}) {
  const { t, lang } = useLang();
  // Catalog is fetched server-side and passed in — no client fetch waterfall.
  const categories = initialCategories;

  const steps = [
    { num: "01", title: t("step1Title"), desc: t("step1Desc") },
    { num: "02", title: t("step2Title"), desc: t("step2Desc") },
    { num: "03", title: t("step3Title"), desc: t("step3Desc") },
  ];

  const stats = [
    { icon: Clock, label: "₮1,900-с эхлэнэ" },
    { icon: Shield, label: "Хувийн, аюулгүй" },
  ];

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className=" relative overflow-hidden px-4 pb-16 pt-12 md:px-6">
        <HeroSpotlight />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.div
            className="mb-5 flex justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/*<span className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 shadow-(--shadow-recessed)">
              <Led color="online" label="SYSTEM ONLINE" />
            </span>*/}
          </motion.div>
          <motion.h2
            className="mb-3 font-display text-xl font-bold leading-tight tracking-tight text-embossed sm:text-2xl md:text-2xl lg:text-3xl"
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
            <span className="block text-foreground text-embossed">
              {t("heroSubtitle")}
            </span>
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
            <Button
              render={<Link href="/generate" />}
              variant="shadow"
              size="lg"
              className="gap-1 rounded-full px-8 text-lg"
            >
              {t("getStarted")}
            </Button>
          </motion.div>

          <HeroVisual />

          <motion.div
            className="mt-10 flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Card detail className="w-full max-w-md">
              <div className="flex items-center justify-center gap-6 px-6 py-4 text-sm">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-6">
                    {i > 0 && <div className="h-7 w-px bg-border" />}
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-full bg-background text-primary shadow-(--shadow-floating)">
                        <s.icon size={16} />
                      </span>
                      <span className="font-medium text-foreground">
                        {s.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="mb-6 font-display text-xl font-bold tracking-tight text-embossed sm:text-2xl">
              {t("categories")}
            </h2>
          </Reveal>
          <RevealStagger className="-mx-5 -my-5 grid snap-x auto-rows-fr grid-flow-col grid-rows-2 gap-6 overflow-x-auto scroll-pl-5 scrollbar-hide mask-fade-x bg-transparent px-5 py-5">
            {categories.map((cat) => (
              <RevealItem
                key={cat.id}
                className="h-full w-44 shrink-0 snap-start sm:w-52"
              >
                <Link href={`/category/${cat.id}`} className="block h-full">
                  <motion.div
                    className="h-full"
                    // whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                    }}
                  >
                    <Card className="group h-full cursor-pointer overflow-hidden py-0 active:shadow-(--shadow-pressed)">
                      <div className="flex aspect-4/5 items-center justify-center overflow-hidden bg-linear-to-br from-muted to-muted/50">
                        <PresetCardImage
                          src={initialCategoryCovers[cat.id] ?? ""}
                          alt={lang === "mn" ? cat.name_mn : cat.name_en}
                          fallback={
                            <CategoryGlyph
                              category={cat}
                              className="size-14 text-muted-foreground"
                            />
                          }
                          className="h-full w-full object-cover transition-transform duration-300"
                        />
                      </div>
                      <CardContent className="flex flex-col gap-2 p-4">
                        <div>
                          <p className="font-semibold leading-tight">
                            {lang === "mn" ? cat.name_mn : cat.name_en}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {lang === "mn"
                              ? cat.description_mn
                              : cat.description_en}
                          </p>
                        </div>
                        <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary">
                          <span>{cat.presets.length} пресет</span>
                          <ArrowRight
                            size={12}
                            className="transition-transform duration-300"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
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
            <h2 className="mb-6 font-display text-xl font-bold tracking-tight text-embossed sm:text-2xl">
              {t("featuredPresets")}
            </h2>
          </Reveal>
          <div className="-mx-5 -my-5 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-pl-5 scrollbar-hide mask-fade-x bg-transparent px-5 py-5">
            {initialFeatured.map(({ category: cat, preset }) => (
              <Link
                key={preset.id}
                href={`/preset/${preset.id}`}
                className="min-w-50 max-w-55 shrink-0 snap-start"
              >
                <motion.div
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                  }}
                >
                  <Card className="h-full cursor-pointer overflow-hidden py-0">
                    {/* One uniform ratio across all cards (best practice for
                          a rail): 4:5 matches the dominant preset ratio, so most
                          images aren't cropped and every card is the same height. */}
                    <div className="aspect-4/5 w-full overflow-hidden bg-linear-to-br from-muted to-muted/50 transition-transform duration-500">
                      <PresetCardImage
                        src={preset.example_output}
                        alt={lang === "mn" ? preset.name_mn : preset.name_en}
                        fallback={
                          <CategoryGlyph
                            category={cat}
                            className="size-14 text-muted-foreground"
                          />
                        }
                      />
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">
                        {lang === "mn" ? cat.name_mn : cat.name_en}
                      </p>
                      <p className="font-semibold">
                        {lang === "mn" ? preset.name_mn : preset.name_en}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-primary">
                          ₮{preset.price_mnt.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {preset.eta_min} {t("min")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="mb-8 text-center font-display text-xl font-bold tracking-tight text-embossed sm:text-2xl">
              {t("howItWorks")}
            </h2>
          </Reveal>
          <div className="relative">
            {/* Cylindrical pipe connecting the step nodes (desktop only). */}
            <div className="absolute left-[16.66%] right-[16.66%] top-6 hidden h-3 rounded-full bg-muted shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)] sm:block" />
            <RevealStagger className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
              {steps.map((step, i) => (
                <RevealItem key={i}>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-background shadow-(--shadow-floating)">
                      <span className="label-stamp text-sm text-primary">
                        {step.num}
                      </span>
                    </div>
                    <h3 className="mb-1 font-bold text-embossed">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="px-4 mb-4 md:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Card detail>
              <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left">
                <div>
                  <p className="font-display text-xl font-black text-embossed sm:text-2xl">
                    Өнөөдөр эхэл
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Промпт бичихгүйгээр гэр бүлийн зургаа бүтээ.
                  </p>
                </div>
                <Button
                  render={<Link href="/generate" />}
                  variant="shadow"
                  size="lg"
                  className="w-full shrink-0 rounded-full sm:w-auto"
                >
                  {t("getStarted")}
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
