"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useLang } from "@/contexts/LanguageContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { translations } from "@/lib/i18n";
import { AlertTriangle, Sparkles } from "lucide-react";

interface GenerationState {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  queue_position: number | null;
  error: string | null;
}

const POLL_INTERVAL = 2500;

function ProgressContent() {
  const { t, lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const generationId = searchParams.get("id");

  const [gen, setGen] = useState<GenerationState | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const tips = [...translations[lang].tips] as string[];

  const poll = useCallback(async () => {
    if (!generationId) return;
    try {
      const res = await fetch(`/api/generation/${generationId}`);
      if (!res.ok) {
        setFetchError("Generation олдсонгүй.");
        return;
      }
      const data: GenerationState = await res.json();
      setGen(data);

      if (data.status === "done") {
        // fresh=1 marks a just-finished generation so /output fires the success
        // banner + confetti once. /output strips it from the URL right away, so
        // refreshes and later opens from the gallery stay quiet.
        setTimeout(
          () => router.push(`/output?id=${generationId}&fresh=1`),
          600,
        );
      }
    } catch {
      setFetchError("Сүлжээний алдаа гарлаа.");
    }
  }, [generationId, router]);

  useEffect(() => {
    if (!generationId) return;
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [generationId, poll]);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 3000);
    return () => clearInterval(id);
  }, [tips.length]);

  const progress = gen?.progress ?? 0;
  const etaSec = Math.max(0, Math.ceil(((100 - progress) / 100) * 120));

  // ── Error states ──────────────────────────────────────────
  if (!generationId) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle size={40} className="text-destructive" />
        <p className="font-bold">Generation ID олдсонгүй.</p>
        <Button onClick={() => router.push("/generate")} className="rounded-full">
          Буцах
        </Button>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle size={40} className="text-destructive" />
        <p className="font-bold">{fetchError}</p>
        <Button onClick={poll} className="rounded-full">
          Дахин оролдох
        </Button>
      </div>
    );
  }

  if (gen?.status === "failed") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle size={28} className="text-destructive" />
        </div>
        <h1 className="text-xl font-black">Боловсруулалт амжилтгүй боллоо</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {gen.error ?? "Техникийн алдаа гарлаа. Дахин оролдоно уу."}
        </p>
        <p className="text-xs text-muted-foreground">
          Төлбөр буцаах асуудлаар тусламж хэсгээс холбогдоно уу.
        </p>
        <Button onClick={() => router.push("/generate")} className="rounded-full font-bold">
          Дахин оролдох
        </Button>
      </div>
    );
  }

  // ── Normal progress UI ────────────────────────────────────
  return (
    <div className="grain relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient brand glow behind the orb */}
      <div aria-hidden className="pointer-events-none absolute h-72 w-72 rounded-full opacity-20 blur-3xl" style={{ background: "var(--brand)" }} />

      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Generative orb — orbiting particles around a glowing core */}
        <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
          {[0, 1, 2].map((ring) => (
            <motion.div
              key={ring}
              className="absolute rounded-full border border-primary/30"
              style={{ width: 72 + ring * 22, height: 72 + ring * 22 }}
              animate={{ rotate: ring % 2 ? -360 : 360 }}
              transition={{ duration: 8 + ring * 4, repeat: Infinity, ease: "linear" }}
            >
              <span
                className="absolute h-2 w-2 rounded-full bg-primary"
                style={{ top: -4, left: "50%", marginLeft: -4, boxShadow: "0 0 8px var(--brand)" }}
              />
            </motion.div>
          ))}
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 40px -4px var(--brand)" }}
          >
            <Sparkles size={26} />
          </motion.div>
        </div>

        <h1 className="mb-2 text-2xl font-black">{t("progressTitle")}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{t("progressDesc")}</p>

        {/* Status badge — aria-live so screen readers announce updates */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-(--shadow-recessed)"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              gen?.status === "queued" ? "bg-yellow-400" : "bg-primary animate-pulse"
            }`}
          />
          {gen?.status === "queued" ? "Дараалалд хүлээж байна" : "AI боловсруулж байна"}
        </div>

        {/* Progress bar */}
        <div className="mb-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Боловсруулалтын явц">
          <Progress value={progress} className="h-2" />
        </div>
        <div className="mb-6 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("estimatedTime")}: ~{etaSec}с
          </span>
          <AnimatedCounter value={progress} suffix="%" duration={0.5} className="font-bold text-primary" />
        </div>

        {/* Queue position */}
        {gen?.queue_position != null && gen.status === "queued" && (
          <div className="mb-6 rounded-xl p-4 shadow-(--shadow-card)">
            <p className="text-xs text-muted-foreground">{t("queuePosition")}</p>
            <p className="text-2xl font-black text-primary">#{gen.queue_position}</p>
          </div>
        )}

        {/* Rotating tip — crossfade */}
        <div className="h-10">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-muted-foreground"
            >
              {tips[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <ProgressContent />
    </Suspense>
  );
}
