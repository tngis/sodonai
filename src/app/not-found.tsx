"use client";

import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-8xl font-black text-primary">404</p>
      <h1 className="text-2xl font-bold">{t("notFound")}</h1>
      <p className="text-muted-foreground">{t("notFoundDesc")}</p>
      <Button render={<Link href="/" />} className="mt-2 rounded-full">
        {t("backHome")}
      </Button>
    </div>
  );
}
