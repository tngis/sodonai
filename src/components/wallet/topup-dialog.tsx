"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createTopUpIntent } from "@/app/actions/wallet";
import { TOPUP_PRESETS, MIN_TOPUP_MNT, isValidTopUpAmount, formatMnt } from "@/lib/wallet";
import { banks } from "@/lib/banks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { QPayDeepLink } from "@/lib/qpay";

const POLL_MS = 2500;

type Phase =
  | { kind: "select" }
  | { kind: "creating" }
  | { kind: "awaiting"; topUpId: string; amountMnt: number; qrImage: string; deepLinks: QPayDeepLink[] };

// Wallet top-up modal: pick an amount (preset chip or custom), pay the QPay
// invoice (QR + bank deep links), and poll until the wallet is credited.
// Mirrors the order-payment QR flow in the generate page.
export function TopUpDialog({
  open,
  onOpenChange,
  onCredited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCredited: (balance: number) => void;
}) {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>({ kind: "select" });
  const [selected, setSelected] = useState<number>(TOPUP_PRESETS[1]); // ₮10,000 default
  const [custom, setCustom] = useState("");
  const creditedRef = useRef(false);

  // Reset whenever the dialog closes.
  useEffect(() => {
    if (!open) {
      setPhase({ kind: "select" });
      setSelected(TOPUP_PRESETS[1]);
      setCustom("");
      creditedRef.current = false;
    }
  }, [open]);

  const amount = custom.trim() ? Number(custom) : selected;
  const amountValid = isValidTopUpAmount(amount);

  // Poll for top-up confirmation once the invoice is shown.
  useEffect(() => {
    if (phase.kind !== "awaiting") return;
    const { topUpId } = phase;

    const poll = async () => {
      try {
        const res = await fetch(`/api/wallet/topup/${topUpId}`);
        if (!res.ok) return;
        const data: { status: string; balance?: number } = await res.json();
        if (data.status === "credited" && !creditedRef.current) {
          creditedRef.current = true;
          toast.success(t("walletTopupSuccess"), { description: t("walletTopupSuccessDesc") });
          onCredited(data.balance ?? 0);
          onOpenChange(false);
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [phase, onCredited, onOpenChange, t]);

  const startTopUp = useCallback(async () => {
    if (!amountValid) {
      toast.error(t("enterAmount"));
      return;
    }
    setPhase({ kind: "creating" });
    try {
      const result = await createTopUpIntent(amount);
      setPhase({
        kind: "awaiting",
        topUpId: result.topUpId,
        amountMnt: result.amountMnt,
        qrImage: result.qrImage,
        deepLinks: result.deepLinks,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      setPhase({ kind: "select" });
    }
  }, [amount, amountValid, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("topUpWallet")}</DialogTitle>
          <DialogDescription>
            {phase.kind === "awaiting"
              ? t("qpayDesc")
              : `${t("minTopUpNote")}: ${formatMnt(MIN_TOPUP_MNT)}`}
          </DialogDescription>
        </DialogHeader>

        {phase.kind === "awaiting" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted p-6 shadow-(--shadow-recessed)">
              <span className="text-2xl font-black text-primary">{formatMnt(phase.amountMnt)}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={phase.qrImage} alt="QPay QR" className="h-44 w-44 rounded-xl bg-white p-2" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" />
                <span>{t("paymentWaiting")}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {phase.deepLinks.map((dl) => {
                const bank = banks.find((b) => b.nameMn === dl.name);
                return (
                  <a
                    key={dl.name}
                    href={dl.link}
                    className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium shadow-(--shadow-card) transition-all hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed)"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ background: bank?.color ?? "#666" }}
                    >
                      {dl.name.slice(0, 1)}
                    </span>
                    <span className="whitespace-nowrap">{dl.name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Preset amount chips */}
            <div className="grid grid-cols-2 gap-2">
              {TOPUP_PRESETS.map((p) => {
                const active = !custom.trim() && selected === p;
                return (
                  <button
                    key={p}
                    onClick={() => { setSelected(p); setCustom(""); }}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-base font-bold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground glow-brand-sm"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {formatMnt(p)}
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("customAmount")}</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₮</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={MIN_TOPUP_MNT}
                  placeholder={t("enterAmount")}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <Button
              onClick={startTopUp}
              disabled={!amountValid || phase.kind === "creating"}
              variant="shadow"
              size="lg"
              className="w-full rounded-full bg-primary font-bold text-primary-foreground"
            >
              {phase.kind === "creating" ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> {t("topUpBtn")}</>
              ) : (
                `${t("topUpPay")} · ${formatMnt(amountValid ? amount : 0)}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
