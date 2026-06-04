"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Frame } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { findFrame, findSize } from "@/lib/print-catalog";
import { OrderTimeline } from "@/components/print/order-timeline";
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
  production_status: PrintProductionStatus;
  delivery_status: PrintDeliveryStatus;
}

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
  const [presetMap, setPresetMap] = useState<Record<string, { name_mn: string; name_en: string }>>({});
  const [printMap, setPrintMap] = useState<Record<string, PrintDetail>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [ordersRes, presetsRes, printsRes] = await Promise.all([
      supabase.from("orders").select("id, preset_id, kind, status, amount_mnt, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("presets_public").select("id, name_mn, name_en"),
      supabase.from("print_orders").select("order_id, frame_id, size_id, production_status, delivery_status").eq("user_id", user.id),
    ]);

    setOrders((ordersRes.data ?? []) as OrderItem[]);

    const map: Record<string, { name_mn: string; name_en: string }> = {};
    for (const p of (presetsRes.data ?? [])) {
      const row = p as { id: string; name_mn: string; name_en: string };
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
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusLabel: Record<string, string> = {
    completed: t("completed"), paid: t("completed"),
    processing: t("processing"), queued: t("processing"),
    pending: t("pending"), failed: t("failed"),
  };

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-black tracking-tight md:text-3xl">{t("myOrders")}</h1>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : orders.length > 0 ? (
          <div className="flex flex-col gap-3">
            {orders.map((order, i) => {
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
                  className="glass flex flex-col gap-3 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between gap-3">
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
