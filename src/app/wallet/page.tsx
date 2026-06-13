"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getWalletBalance, getWalletTransactions, type WalletTransaction } from "@/app/actions/wallet";
import { formatMnt } from "@/lib/wallet";
import { TopUpDialog } from "@/components/wallet/topup-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WalletTxnType } from "@/lib/supabase/types";

// Icon + label + amount-color per ledger entry type.
function txnMeta(type: WalletTxnType, t: (k: "walletTxnTopup" | "walletTxnSpend" | "walletTxnRefund" | "walletTxnAdjustment") => string) {
  switch (type) {
    case "topup":
      return { Icon: ArrowDownLeft, label: t("walletTxnTopup"), tone: "text-emerald-600 dark:text-emerald-400" };
    case "spend":
      return { Icon: ArrowUpRight, label: t("walletTxnSpend"), tone: "text-foreground" };
    case "refund":
      return { Icon: RotateCcw, label: t("walletTxnRefund"), tone: "text-emerald-600 dark:text-emerald-400" };
    default:
      return { Icon: SlidersHorizontal, label: t("walletTxnAdjustment"), tone: "text-foreground" };
  }
}

export default function WalletPage() {
  const { t, lang } = useLang();
  const router = useRouter();

  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[] | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const loadTxns = useCallback(() => {
    getWalletTransactions().then(setTxns).catch(() => setTxns([]));
  }, []);

  useEffect(() => {
    getWalletBalance().then(setBalance).catch(() => router.push("/auth"));
    loadTxns();
  }, [router, loadTxns]);

  const onCredited = useCallback((newBalance: number) => {
    setBalance(newBalance);
    loadTxns();
  }, [loadTxns]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === "mn" ? "mn-MN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {t("back")}
        </button>

        <h1 className="mb-6 font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">
          {t("wallet")}
        </h1>

        {/* ── Balance card ── */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-linear-to-br from-primary/15 to-primary/5 p-6 shadow-(--shadow-card) ring-1 ring-primary/20">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <WalletIcon size={15} /> {t("walletBalance")}
          </div>
          {balance === null ? (
            <Skeleton className="h-10 w-40 rounded-lg" />
          ) : (
            <div className="text-4xl font-black tracking-tight text-primary md:text-5xl">
              {formatMnt(balance)}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("walletSubtitle")}</p>
          <Button
            onClick={() => setTopUpOpen(true)}
            variant="shadow"
            size="lg"
            className="mt-1 w-full rounded-full bg-primary font-bold text-primary-foreground sm:w-auto sm:self-start sm:px-8"
          >
            <Plus size={16} className="mr-1.5" /> {t("topUp")}
          </Button>
        </div>

        {/* ── Transaction history ── */}
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("transactionHistory")}
        </div>

        {txns === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : txns.length === 0 ? (
          <div className="rounded-xl px-4 py-10 text-center text-sm text-muted-foreground shadow-(--shadow-recessed)">
            {t("noTransactions")}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {txns.map((tx) => {
              const { Icon, label, tone } = txnMeta(tx.type, t);
              const credit = tx.amountMnt >= 0;
              return (
                <li key={tx.id} className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-(--shadow-card)">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.note || label}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(tx.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-bold", credit ? tone : "text-foreground")}>
                      {credit ? "+" : "−"}{formatMnt(Math.abs(tx.amountMnt))}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatMnt(tx.balanceAfter)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} onCredited={onCredited} />
    </div>
  );
}
