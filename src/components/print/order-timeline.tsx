"use client";

import { Check } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { PrintProductionStatus, PrintDeliveryStatus } from "@/lib/supabase/types";

const PRODUCTION_ORDER: PrintProductionStatus[] = ["pending", "printing", "framing", "ready"];
const DELIVERY_ORDER: PrintDeliveryStatus[] = ["pending", "shipping", "delivered"];

export function OrderTimeline({
  production,
  delivery,
}: {
  production: PrintProductionStatus;
  delivery: PrintDeliveryStatus;
}) {
  const { t } = useLang();

  const prodLabels: Record<PrintProductionStatus, string> = {
    pending: t("prodPending"),
    printing: t("prodPrinting"),
    framing: t("prodFraming"),
    ready: t("prodReady"),
  };
  const delvLabels: Record<PrintDeliveryStatus, string> = {
    pending: t("delvPending"),
    shipping: t("delvShipping"),
    delivered: t("delvDelivered"),
  };

  return (
    <div className="flex flex-col gap-3">
      <Stage title={t("production")} steps={PRODUCTION_ORDER} labels={prodLabels} current={production} />
      <Stage title={t("delivery")} steps={DELIVERY_ORDER} labels={delvLabels} current={delivery} />
    </div>
  );
}

function Stage<T extends string>({
  title,
  steps,
  labels,
  current,
}: {
  title: string;
  steps: T[];
  labels: Record<T, string>;
  current: T;
}) {
  const currentIdx = steps.indexOf(current);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="flex items-center">
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                    done
                      ? "bg-primary/30 text-primary"
                      : active
                      ? "bg-primary text-black glow-brand-sm"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className={cn("whitespace-nowrap text-[10px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {labels[step]}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="mx-1 mb-4 h-0.5 flex-1 rounded-full bg-border">
                  <div className={cn("h-full rounded-full bg-primary transition-all", i < currentIdx ? "w-full" : "w-0")} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
