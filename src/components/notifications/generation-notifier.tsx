"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLang } from "@/contexts/LanguageContext";
import { useUserGenerations } from "@/lib/use-generations";

const FRESH_MS = 2 * 60 * 1000;

// Mounted once in the root layout. Watches the user's generations and fires a
// transient toast when one finishes — so the "done" notification appears no
// matter which page the user is on after kicking off a generation. The header
// bell keeps the persistent history; this is the live nudge with a tap-through
// to the result.
export function GenerationNotifier() {
  const { items, loading } = useUserGenerations();
  const { t } = useLang();
  const router = useRouter();

  // generationId -> last status we acted on. Seeded on the first real load so
  // generations that were already finished before this session don't re-toast.
  const seen = useRef<Map<string, string>>(new Map());
  const baselined = useRef(false);

  useEffect(() => {
    if (loading) return;
    const prev = seen.current;

    if (!baselined.current) {
      for (const g of items) prev.set(g.id, g.status);
      baselined.current = true;
      return;
    }

    for (const g of items) {
      const before = prev.get(g.id);
      if (before === g.status) continue;
      prev.set(g.id, g.status);

      const wasActive = before === "queued" || before === "processing";
      // A fast generation can finish before we ever observe it active — still
      // toast if it appears already-done and is fresh (just completed).
      const appearedFresh =
        before === undefined && Date.now() - new Date(g.updated_at).getTime() < FRESH_MS;
      if (!wasActive && !appearedFresh) continue;

      if (g.status === "done") {
        toast.success(t("imageReady"), {
          description: t("imageReadyToastDesc"),
          duration: 8000,
          action: {
            label: t("viewImage"),
            onClick: () => router.push(`/output?id=${g.id}`),
          },
        });
      } else if (g.status === "failed") {
        toast.error(t("generationFailedNotif"), {
          description: g.error ?? undefined,
        });
      }
    }
  }, [items, loading, t, router]);

  return null;
}
