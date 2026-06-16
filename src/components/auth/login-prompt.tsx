"use client";

import Link from "next/link";
import { LogIn, Sparkles } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Reusable signed-out prompt. Lives in its own component so the same UI backs the
// account sheet's logged-out state today AND future commit-time login gates (the
// preset "Start" gate, protected-tab taps) without duplication.
//   • `next`        — post-login return path (forwarded to /auth as ?next=).
//   • `onNavigate`  — lets a host (e.g. the account sheet) close itself on tap.
//   • `title`/`description` — override the default copy per call site.
export function LoginPrompt({
  title,
  description,
  next,
  onNavigate,
  className,
}: {
  title?: string;
  description?: string;
  next?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useLang();
  const href = next ? `/auth?next=${encodeURIComponent(next)}` : "/auth";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-2 py-6 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary shadow-(--shadow-card)">
        <Sparkles size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-bold">{title ?? t("loginPromptTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {description ?? t("loginPromptDesc")}
        </p>
      </div>
      <Button
        render={<Link href={href} onClick={onNavigate} />}
        variant="shadow"
        size="lg"
        className="w-full gap-1.5 rounded-full font-bold"
      >
        {t("signIn")} <LogIn size={16} />
      </Button>
    </div>
  );
}
