"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Frame, Sparkles } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { getOutputThumbUrls } from "@/app/actions/storage";
import { findFrame, findSize } from "@/lib/print-catalog";
import { OrderTimeline } from "@/components/print/order-timeline";
import { ResumePaymentDialog } from "@/components/orders/resume-payment-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PrintProductionStatus, PrintDeliveryStatus } from "@/lib/supabase/types";

interface OrderItem {
  id: string;
  preset_id: string | null;
  kind: string;
  status: string;
  amount_mnt: number;
  created_at: string;
}

interface PrintDetail {
  frame_id: string;
  size_id: string;
  asset_storage_path: string;
  production_status: PrintProductionStatus;
  delivery_status: PrintDeliveryStatus;
}

interface PresetInfo {
  name_mn: string;
  name_en: string;
  example_output: string;
}

type OrderTab = "all" | "generation" | "print";

const STATUS_STYLE: Record<string, string> = {
  completed:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  paid:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  processing: "bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400",
  queued:     "bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400",
  pending:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  failed:     "bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric", year: "numeric" });
}

export default function OrdersPage() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [presetMap, setPresetMap] = useState<Record<string, PresetInfo>>({});
  const [printMap, setPrintMap] = useState<Record<string, PrintDetail>>({});
  // order_id → signed thumbnail URL of the framed image
  const [printThumbs, setPrintThumbs] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<OrderTab>("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    // Local session read (no network); orders/print queries are RLS-scoped.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }

    const [ordersRes, presetsRes, printsRes] = await Promise.all([
      supabase.from("orders").select("id, preset_id, kind, status, amount_mnt, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("presets_public").select("id, name_mn, name_en, example_output"),
      supabase.from("print_orders").select("order_id, frame_id, size_id, asset_storage_path, production_status, delivery_status").eq("user_id", user.id),
    ]);

    setOrders((ordersRes.data ?? []) as OrderItem[]);

    const map: Record<string, PresetInfo> = {};
    for (const p of (presetsRes.data ?? [])) {
      const row = p as { id: string } & PresetInfo;
      map[row.id] = row;
    }
    setPresetMap(map);

    const pmap: Record<string, PrintDetail> = {};
    for (const pr of (printsRes.data ?? [])) {
      const row = pr as { order_id: string } & PrintDetail;
      pmap[row.order_id] = row;
    }
    setPrintMap(pmap);
    setLoading(false);

    // Presign the framed-image thumbnails (best-effort; cards still render without).
    const printList = Object.values(pmap);
    if (printList.length > 0) {
      try {
        const byPath = await getOutputThumbUrls(printList.map((p) => p.asset_storage_path));
        const thumbs: Record<string, string> = {};
        for (const [orderId, p] of Object.entries(pmap)) {
          const url = byPath[p.asset_storage_path];
          if (url) thumbs[orderId] = url;
        }
        setPrintThumbs(thumbs);
      } catch {
        /* thumbnails are non-critical — leave the placeholder */
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusLabel: Record<string, string> = {
    completed: t("completed"), paid: t("paid"),
    processing: t("processing"), queued: t("processing"),
    pending: t("pending"), failed: t("failed"),
  };

  const counts = {
    all: orders.length,
    generation: orders.filter((o) => o.kind !== "print").length,
    print: orders.filter((o) => o.kind === "print").length,
  };
  const TABS: { key: OrderTab; label: string }[] = [
    { key: "all", label: t("ordersAll") },
    { key: "generation", label: t("ordersAi") },
    { key: "print", label: t("ordersPrint") },
  ];
  const visible =
    tab === "all"
      ? orders
      : orders.filter((o) => (tab === "print" ? o.kind === "print" : o.kind !== "print"));

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-2xl font-black tracking-tight text-embossed md:text-3xl">{t("myOrders")}</h1>

        {/* Filter tabs — AI generations vs framed prints */}
        {!loading && orders.length > 0 && (
          <div className="mb-5 flex gap-2">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all active:translate-y-px",
                  tab === tb.key
                    ? "bg-primary text-primary-foreground shadow-(--shadow-card)"
                    : "text-muted-foreground shadow-(--shadow-card) hover:text-foreground",
                )}
              >
                {tb.label}
                <span className={cn("text-xs font-bold", tab === tb.key ? "opacity-80" : "opacity-60")}>
                  {counts[tb.key]}
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : visible.length > 0 ? (
          <div className="flex flex-col gap-3">
            {visible.map((order, i) => {
              const print = order.kind === "print" ? printMap[order.id] : undefined;
              const p = order.preset_id ? presetMap[order.preset_id] : undefined;
              const title = print
                ? `${t("orderPrint")} · ${findSize(print.size_id)?.label ?? print.size_id}`
                : p
                ? (lang === "mn" ? p.name_mn : p.name_en)
                : order.preset_id ?? order.id.slice(0, 8);
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-3 rounded-xl p-4 shadow-(--shadow-card)"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Thumbnail — framed photo for prints, preset example for AI */}
                      {print ? (
                        printThumbs[order.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={printThumbs[order.id]}
                            alt={title}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-(--shadow-card)"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted shadow-(--shadow-recessed)">
                            <Frame size={18} className="text-muted-foreground" />
                          </div>
                        )
                      ) : p?.example_output ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.example_output}
                          alt={title}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-(--shadow-card)"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted shadow-(--shadow-recessed)">
                          <Sparkles size={18} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="flex items-center gap-1.5 truncate font-semibold">
                          {print && <Frame size={14} className="shrink-0 text-primary" />}
                          {title}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {order.id.slice(0, 8).toUpperCase()} · {formatDate(order.created_at)}
                          {print && ` · ${findFrame(print.frame_id)?.name_mn ?? print.frame_id}`}
                        </p>
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-3">
                      <Badge className={cn("border-0 text-xs font-semibold", STATUS_STYLE[order.status] ?? STATUS_STYLE.pending)}>
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                      <span className="font-bold">₮{order.amount_mnt.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Print fulfillment timeline (only once the order is paid) */}
                  {print && order.status !== "pending" && (
                    <div className="border-t border-border/60 pt-3">
                      <OrderTimeline production={print.production_status} delivery={print.delivery_status} />
                    </div>
                  )}

                  {/* Unpaid order — let the user resume the QPay payment. */}
                  {order.status === "pending" && (
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <ResumePaymentDialog orderId={order.id} amount={order.amount_mnt} onPaid={load} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted-foreground">{t("noOrders")}</p>
            <Button render={<Link href="/generate" />} size="sm" className="rounded-full">
              {t("startGenerating")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
