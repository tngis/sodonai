"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, QrCode, ChevronRight } from "lucide-react";
import { resumePayment, payPendingWithWallet } from "@/app/actions/payment";
import { getWalletBalance } from "@/app/actions/wallet";
import { TopUpDialog } from "@/components/wallet/topup-dialog";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface QrData {
  paymentId: string;
  qrImage: string;
  deepLinks: { name: string; link: string }[];
}

const POLL_MS = 3000;
const fmt = (n: number) => `₮${n.toLocaleString()}`;

// "Pay now" for a still-pending order on /orders. Offers wallet (with a confirm
// step, plus a top-up path when short) or QPay QR (re-issued + polled), then
// refreshes the list.
export function ResumePaymentDialog({
  orderId, amount, onPaid,
}: {
  orderId: string; amount: number; onPaid: () => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"method" | "confirm" | "qpay">("method");
  const [balance, setBalance] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qr, setQr] = useState<QrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const openDialog = () => {
    setOpen(true);
    setView("method");
    setQr(null);
    setError(null);
    setBalance(null);
    getWalletBalance().then(setBalance).catch(() => setBalance(0));
  };

  const payWallet = async () => {
    setPaying(true);
    try {
      await payPendingWithWallet(orderId);
      toast.success(t("paymentConfirmed"));
      setOpen(false);
      onPaid();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setPaying(false);
    }
  };

  const startQpay = async () => {
    setView("qpay");
    setLoadingQr(true);
    setError(null);
    setQr(null);
    try {
      setQr(await resumePayment(orderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setLoadingQr(false);
    }
  };

  // Poll while the QR is shown.
  useEffect(() => {
    if (!open || view !== "qpay" || !qr?.paymentId) return;
    let done = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/payment/${qr.paymentId}`);
        if (!res.ok) return;
        const j: { status?: string } = await res.json();
        if (j.status === "paid" && !done) {
          done = true;
          toast.success(t("paymentConfirmed"));
          setOpen(false);
          onPaid();
        }
      } catch {
        /* network hiccup — keep polling */
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { done = true; clearInterval(id); };
  }, [open, view, qr?.paymentId, onPaid, t]);

  const insufficient = balance !== null && balance < amount;

  return (
    <>
      <Button size="sm" onClick={openDialog} className="rounded-full font-bold">
        {t("payNow")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{view === "qpay" ? t("qpayTitle") : t("payNow")}</DialogTitle>
          </DialogHeader>

          {/* ── Method choice ─────────────────────────────────── */}
          {view === "method" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl bg-muted p-4 shadow-(--shadow-recessed)">
                <span className="text-sm text-muted-foreground">{t("totalPrice")}</span>
                <span className="text-xl font-black text-primary">{fmt(amount)}</span>
              </div>

              {/* Wallet — insufficient shows a top-up CTA instead of paying */}
              {insufficient ? (
                <div className="flex items-center justify-between gap-3 rounded-xl p-4 shadow-(--shadow-card)">
                  <span className="flex items-center gap-3">
                    <Wallet size={20} className="shrink-0 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span className="font-semibold">{t("payWithWallet")}</span>
                      <span className="text-xs text-destructive">
                        {t("insufficientBalance")} · {fmt(amount - (balance ?? 0))} {t("shortBy")}
                      </span>
                    </span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => setTopUpOpen(true)}>
                    {t("topUpWallet")}
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setView("confirm")}
                  disabled={balance === null}
                  className="flex items-center justify-between gap-3 rounded-xl p-4 text-left shadow-(--shadow-card) transition-all active:translate-y-px active:shadow-(--shadow-pressed) disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-3">
                    <Wallet size={20} className="shrink-0 text-primary" />
                    <span className="flex flex-col">
                      <span className="font-semibold">{t("payWithWallet")}</span>
                      <span className="text-xs text-muted-foreground">{balance === null ? "…" : fmt(balance)}</span>
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </button>
              )}

              {/* QPay */}
              <button
                type="button"
                onClick={startQpay}
                className="flex items-center justify-between gap-3 rounded-xl p-4 text-left shadow-(--shadow-card) transition-all active:translate-y-px active:shadow-(--shadow-pressed)"
              >
                <span className="flex items-center gap-3">
                  <QrCode size={20} className="shrink-0 text-primary" />
                  <span className="font-semibold">{t("qpayTitle")}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* ── Wallet confirm step (guards accidental clicks) ──── */}
          {view === "confirm" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl bg-muted p-4 shadow-(--shadow-recessed)">
                <span className="text-sm text-muted-foreground">{t("totalPrice")}</span>
                <span className="text-xl font-black text-primary">{fmt(amount)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t("walletPayConfirm")}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setView("method")} disabled={paying}>
                  {t("back")}
                </Button>
                <Button className="rounded-full font-bold" onClick={payWallet} disabled={paying}>
                  {paying ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  {t("payNow")}
                </Button>
              </div>
            </div>
          )}

          {/* ── QPay QR ──────────────────────────────────────── */}
          {view === "qpay" && (
            <div className="flex flex-col gap-4">
              {loadingQr && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-muted-foreground" size={24} />
                </div>
              )}
              {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
              {qr && (
                <>
                  <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted p-6 shadow-(--shadow-recessed)">
                    <p className="text-sm font-semibold text-muted-foreground">{t("qpayDesc")}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr.qrImage} alt="QPay QR" className="h-48 w-48 rounded-xl bg-white p-2" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      <span>{t("paymentWaiting")}</span>
                    </div>
                  </div>
                  {qr.deepLinks.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">{t("bankApps")}</p>
                      <div className="flex flex-wrap gap-2">
                        {qr.deepLinks.map((dl) => (
                          <a
                            key={dl.name}
                            href={dl.link}
                            className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium shadow-(--shadow-card) transition-all hover:text-primary active:translate-y-px active:shadow-(--shadow-pressed)"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">
                              {dl.name.slice(0, 1)}
                            </span>
                            <span className="whitespace-nowrap">{dl.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Top-up flow when the wallet is short. On credit, refresh the balance so
          the user can pay without leaving the page. */}
      <TopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        onCredited={(bal) => setBalance(bal)}
      />
    </>
  );
}
