"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Package, Sparkles } from "lucide-react";
import { updatePrintFulfillment } from "@/app/actions/admin";
import { findFrame, findSize } from "@/lib/print-catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { PrintProductionStatus, PrintDeliveryStatus } from "@/lib/supabase/types";

const PRODUCTION_LABELS: Record<PrintProductionStatus, string> = {
  pending: "Хүлээгдэж буй",
  printing: "Хэвлэж буй",
  framing: "Жаазалж буй",
  ready: "Бэлэн",
};

const DELIVERY_LABELS: Record<PrintDeliveryStatus, string> = {
  pending: "Хүлээгдэж буй",
  shipping: "Хүргэж буй",
  delivered: "Хүргэгдсэн",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж буй",
  paid: "Төлсөн",
  processing: "Боловсруулж буй",
  completed: "Дууссан",
  failed: "Амжилтгүй",
};

export interface AdminPrintDetail {
  id: string;
  frame_id: string;
  size_id: string;
  ship_recipient: string;
  ship_phone: string;
  ship_address: string;
  production_status: PrintProductionStatus;
  delivery_status: PrintDeliveryStatus;
  admin_note: string | null;
  thumbUrl: string;
}

export interface AdminOrderItem {
  id: string;
  kind: "generation" | "print";
  status: string;
  amount_mnt: number;
  created_at: string;
  presetName: string | null;
  print: AdminPrintDetail | null;
}

export function OrderManager({ orders }: { orders: AdminOrderItem[] }) {
  const printOrders = orders.filter((o) => o.kind === "print");
  const genOrders = orders.filter((o) => o.kind === "generation");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Package size={18} /> Боднор хэвлэлийн захиалга
          <Badge variant="secondary">{printOrders.length}</Badge>
        </h2>
        {printOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Хэвлэлийн захиалга алга байна.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {printOrders.map((o) => <PrintOrderCard key={o.id} order={o} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Sparkles size={18} /> AI үүсгэлтийн захиалга
          <Badge variant="secondary">{genOrders.length}</Badge>
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {genOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.presetName ?? o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("mn-MN")}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                  <span className="shrink-0 font-bold text-primary">₮{o.amount_mnt.toLocaleString()}</span>
                </div>
              ))}
              {genOrders.length === 0 && <p className="p-3 text-sm text-muted-foreground">Захиалга алга байна.</p>}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PrintOrderCard({ order }: { order: AdminOrderItem }) {
  const p = order.print!;
  const [prod, setProd] = useState<PrintProductionStatus>(p.production_status);
  const [delv, setDelv] = useState<PrintDeliveryStatus>(p.delivery_status);
  const [note, setNote] = useState(p.admin_note ?? "");
  const [baseline, setBaseline] = useState({
    prod: p.production_status,
    delv: p.delivery_status,
    note: p.admin_note ?? "",
  });
  const [saving, setSaving] = useState(false);

  const dirty =
    prod !== baseline.prod || delv !== baseline.delv || (note.trim() || null) !== (baseline.note.trim() || null);

  const frame = findFrame(p.frame_id);
  const size = findSize(p.size_id);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePrintFulfillment(p.id, {
        production_status: prod,
        delivery_status: delv,
        admin_note: note.trim() || null,
      });
      toast.success("Хадгаллаа ✓");
      setBaseline({ prod, delv, note: note.trim() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        {/* Thumb */}
        <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
          {p.thumbUrl && <Image src={p.thumbUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />}
        </div>

        {/* Detail + controls */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8).toUpperCase()}</span>
            <Badge variant="secondary" className="text-xs">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("mn-MN")}</span>
            <span className="ml-auto font-bold text-primary">₮{order.amount_mnt.toLocaleString()}</span>
          </div>

          <p className="text-sm">
            <span className="font-semibold">{size?.label ?? p.size_id}</span> · {frame?.name_mn ?? p.frame_id}
          </p>
          <p className="text-sm text-muted-foreground">
            {p.ship_recipient} · {p.ship_phone}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">{p.ship_address}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Үйлдвэрлэл</p>
              <Select items={PRODUCTION_LABELS} value={prod} onValueChange={(v) => typeof v === "string" && setProd(v as PrintProductionStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRODUCTION_LABELS) as PrintProductionStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{PRODUCTION_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Хүргэлт</p>
              <Select items={DELIVERY_LABELS} value={delv} onValueChange={(v) => typeof v === "string" && setDelv(v as PrintDeliveryStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DELIVERY_LABELS) as PrintDeliveryStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{DELIVERY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Дотоод тэмдэглэл (track код, заавар...)"
            className="mt-3"
          />

          <div className="mt-3 flex justify-end">
            <Button onClick={handleSave} disabled={!dirty || saving} size="sm" className="rounded-full font-bold">
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null} Хадгалах
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
