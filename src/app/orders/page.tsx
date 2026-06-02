"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  preset_id: string;
  status: string;
  amount_mnt: number;
  created_at: string;
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

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [ordersRes, presetsRes] = await Promise.all([
      supabase.from("orders").select("id, preset_id, status, amount_mnt, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("presets_public").select("id, name_mn, name_en"),
    ]);

    setOrders((ordersRes.data ?? []) as OrderItem[]);

    const map: Record<string, { name_mn: string; name_en: string }> = {};
    for (const p of (presetsRes.data ?? [])) {
      const row = p as { id: string; name_mn: string; name_en: string };
      map[row.id] = row;
    }
    setPresetMap(map);
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
              const p = presetMap[order.preset_id];
              const presetName = p ? (lang === "mn" ? p.name_mn : p.name_en) : order.preset_id;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
                  className="glass flex items-center justify-between rounded-xl p-4"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="truncate font-semibold">{presetName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {order.id.slice(0, 8).toUpperCase()} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <Badge className={cn("border-0 text-xs font-semibold", STATUS_STYLE[order.status] ?? STATUS_STYLE.pending)}>
                      {statusLabel[order.status] ?? order.status}
                    </Badge>
                    <span className="font-bold">₮{order.amount_mnt.toLocaleString()}</span>
                  </div>
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
