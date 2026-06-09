"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, Bell, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { GenItem } from "@/lib/use-generations";
import type { Lang } from "@/lib/i18n";

function timeAgo(iso: string, lang: Lang): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return lang === "mn" ? "саяхан" : "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return lang === "mn" ? `${m} мин` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "mn" ? `${h} цаг` : `${h}h`;
  const d = Math.floor(h / 24);
  return lang === "mn" ? `${d} өдөр` : `${d}d`;
}

// Presentational list of finished generations, shared by the header dropdown
// and the standalone /notifications page. `lastSeen` highlights unread items.
export function NotificationsPanel({
  items,
  loading,
  lastSeen,
  onNavigate,
}: {
  items: GenItem[];
  loading: boolean;
  lastSeen: number;
  onNavigate?: () => void;
}) {
  const { t, lang } = useLang();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Bell size={22} className="text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t("noNotifications")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((g) => {
        const failed = g.status === "failed";
        const unread = new Date(g.updated_at).getTime() > lastSeen;
        return (
          <Link
            key={g.id}
            href={`/output?id=${g.id}`}
            onClick={onNavigate}
            className={cn(
              "flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted",
              unread && "bg-primary/5"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                failed ? "bg-destructive/10 text-destructive" : "bg-primary/15 text-primary"
              )}
            >
              {failed ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">
                {failed ? t("generationFailedNotif") : t("imageReady")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(g.updated_at, lang)}</p>
            </div>
            {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </div>
  );
}
