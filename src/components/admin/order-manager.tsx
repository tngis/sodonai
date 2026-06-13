"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Loader2, Package, Sparkles, Search, SlidersHorizontal,
  ChevronLeft, ChevronRight, User, Phone, Mail, RotateCcw,
} from "lucide-react";
import { updatePrintFulfillment } from "@/app/actions/admin";
import { findFrame, findSize, FRAMES, SIZES } from "@/lib/print-catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedTabs } from "@/components/motion/segmented-tabs";
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

const PAGE_SIZE = 15;

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
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  print: AdminPrintDetail | null;
}

export function OrderManager({ orders }: { orders: AdminOrderItem[] }) {
  const [tab, setTab] = useState<"print" | "gen">("print");
  const printOrders = useMemo(() => orders.filter((o) => o.kind === "print"), [orders]);
  const genOrders = useMemo(() => orders.filter((o) => o.kind === "generation"), [orders]);

  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs
        tabs={[
          { key: "print", label: `Хэвлэлийн захиалга (${printOrders.length})`, icon: <Package size={15} /> },
          { key: "gen", label: `AI үүсгэлт (${genOrders.length})`, icon: <Sparkles size={15} /> },
        ]}
        value={tab}
        onChange={setTab}
        layoutId="orders-tab"
      />

      {tab === "print" ? <PrintOrdersView orders={printOrders} /> : <GenOrdersView orders={genOrders} />}
    </div>
  );
}

// ─── Shared UI bits ──────────────────────────────────────────
function Toolbar({
  query, onQuery, onOpenFilter, activeCount, placeholder,
}: {
  query: string; onQuery: (v: string) => void; onOpenFilter: () => void;
  activeCount: number; placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      <Button variant="outline" onClick={onOpenFilter} className="relative shrink-0 gap-1.5 rounded-lg">
        <SlidersHorizontal size={15} /> Шүүлтүүр
        {activeCount > 0 && (
          <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>
    </div>
  );
}

function Pagination({
  page, pageCount, total, onPage,
}: {
  page: number; pageCount: number; total: number; onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-xs text-muted-foreground">Нийт {total}</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Өмнөх">
            <ChevronLeft size={15} />
          </Button>
          <span className="text-sm font-medium tabular-nums">{page + 1} / {pageCount}</span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} aria-label="Дараах">
            <ChevronRight size={15} />
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <Select items={items} value={value} onValueChange={(v) => typeof v === "string" && onChange(v)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateRange({
  from, to, onFrom, onTo,
}: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Огнооноос</p>
        <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Огноо хүртэл</p>
        <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

function countActive<T extends object>(filters: T, empty: T): number {
  return (Object.keys(filters) as (keyof T)[]).filter((k) => filters[k] !== empty[k]).length;
}

// Deterministic date formatting — a fixed timeZone + universally-supported
// locale (en-GB) so the server and client render the exact same string.
// Using toLocaleString("mn-MN") breaks hydration: the browser often lacks
// mn-MN locale data and falls back to a different format than the server.
function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function inDateRange(created: string, from: string, to: string): boolean {
  const t = new Date(created).getTime();
  if (from && t < new Date(from + "T00:00:00").getTime()) return false;
  if (to && t > new Date(to + "T23:59:59").getTime()) return false;
  return true;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Бүгд" },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

// ─── Print orders tab ────────────────────────────────────────
interface PrintFilters {
  status: string; production: string; delivery: string; frame: string; size: string; from: string; to: string;
}
const EMPTY_PRINT: PrintFilters = { status: "all", production: "all", delivery: "all", frame: "all", size: "all", from: "", to: "" };

function PrintOrdersView({ orders }: { orders: AdminOrderItem[] }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PrintFilters>(EMPTY_PRINT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);

  const resetPage = () => setPage(0);
  const onQuery = (v: string) => { setQuery(v); resetPage(); };
  const patch = (p: Partial<PrintFilters>) => { setFilters((f) => ({ ...f, ...p })); resetPage(); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const p = o.print!;
      if (filters.status !== "all" && o.status !== filters.status) return false;
      if (filters.production !== "all" && p.production_status !== filters.production) return false;
      if (filters.delivery !== "all" && p.delivery_status !== filters.delivery) return false;
      if (filters.frame !== "all" && p.frame_id !== filters.frame) return false;
      if (filters.size !== "all" && p.size_id !== filters.size) return false;
      if (!inDateRange(o.created_at, filters.from, filters.to)) return false;
      if (q) {
        const hay = [o.id, p.ship_recipient, p.ship_phone, p.ship_address, o.customerName, o.customerPhone, o.customerEmail]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, query, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const activeCount = countActive(filters, EMPTY_PRINT);

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        query={query} onQuery={onQuery} onOpenFilter={() => setFilterOpen(true)}
        activeCount={activeCount}
        placeholder="Захиалагч, утас, хаяг, ID-аар хайх…"
      />

      {pageItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Захиалга олдсонгүй.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((o) => <PrintOrderCard key={o.id} order={o} />)}
        </div>
      )}

      <Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Хэвлэлийн захиалга шүүх</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterSelect label="Төлбөрийн төлөв" value={filters.status} onChange={(v) => patch({ status: v })} options={STATUS_OPTIONS} />
            <FilterSelect label="Үйлдвэрлэл" value={filters.production} onChange={(v) => patch({ production: v })}
              options={[{ value: "all", label: "Бүгд" }, ...Object.entries(PRODUCTION_LABELS).map(([value, label]) => ({ value, label }))]} />
            <FilterSelect label="Хүргэлт" value={filters.delivery} onChange={(v) => patch({ delivery: v })}
              options={[{ value: "all", label: "Бүгд" }, ...Object.entries(DELIVERY_LABELS).map(([value, label]) => ({ value, label }))]} />
            <FilterSelect label="Жааз" value={filters.frame} onChange={(v) => patch({ frame: v })}
              options={[{ value: "all", label: "Бүгд" }, ...FRAMES.map((f) => ({ value: f.id, label: f.name_mn }))]} />
            <FilterSelect label="Хэмжээ" value={filters.size} onChange={(v) => patch({ size: v })}
              options={[{ value: "all", label: "Бүгд" }, ...SIZES.map((s) => ({ value: s.id, label: s.label }))]} />
            <div className="sm:col-span-2">
              <DateRange from={filters.from} to={filters.to} onFrom={(v) => patch({ from: v })} onTo={(v) => patch({ to: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full gap-1.5" onClick={() => { setFilters(EMPTY_PRINT); resetPage(); }}>
              <RotateCcw size={14} /> Цэвэрлэх
            </Button>
            <Button className="rounded-full font-bold" onClick={() => setFilterOpen(false)}>Хаах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── AI generation orders tab ────────────────────────────────
interface GenFilters {
  status: string; preset: string; from: string; to: string;
}
const EMPTY_GEN: GenFilters = { status: "all", preset: "all", from: "", to: "" };

function GenOrdersView({ orders }: { orders: AdminOrderItem[] }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<GenFilters>(EMPTY_GEN);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);

  const resetPage = () => setPage(0);
  const onQuery = (v: string) => { setQuery(v); resetPage(); };
  const patch = (p: Partial<GenFilters>) => { setFilters((f) => ({ ...f, ...p })); resetPage(); };

  const presetOptions = useMemo(() => {
    const names = new Map<string, string>();
    orders.forEach((o) => { if (o.presetName) names.set(o.presetName, o.presetName); });
    return [{ value: "all", label: "Бүгд" }, ...[...names.keys()].sort().map((n) => ({ value: n, label: n }))];
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filters.status !== "all" && o.status !== filters.status) return false;
      if (filters.preset !== "all" && o.presetName !== filters.preset) return false;
      if (!inDateRange(o.created_at, filters.from, filters.to)) return false;
      if (q) {
        const hay = [o.id, o.presetName, o.customerName, o.customerPhone, o.customerEmail].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, query, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const activeCount = countActive(filters, EMPTY_GEN);

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        query={query} onQuery={onQuery} onOpenFilter={() => setFilterOpen(true)}
        activeCount={activeCount}
        placeholder="Захиалагч, утас, имэйл, пресет, ID-аар хайх…"
      />

      {pageItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Захиалга олдсонгүй.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pageItems.map((o) => <GenOrderCard key={o.id} order={o} />)}
        </div>
      )}

      <Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI үүсгэлтийн захиалга шүүх</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterSelect label="Төлбөрийн төлөв" value={filters.status} onChange={(v) => patch({ status: v })} options={STATUS_OPTIONS} />
            <FilterSelect label="Пресет" value={filters.preset} onChange={(v) => patch({ preset: v })} options={presetOptions} />
            <div className="sm:col-span-2">
              <DateRange from={filters.from} to={filters.to} onFrom={(v) => patch({ from: v })} onTo={(v) => patch({ to: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full gap-1.5" onClick={() => { setFilters(EMPTY_GEN); resetPage(); }}>
              <RotateCcw size={14} /> Цэвэрлэх
            </Button>
            <Button className="rounded-full font-bold" onClick={() => setFilterOpen(false)}>Хаах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenOrderCard({ order }: { order: AdminOrderItem }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{order.presetName ?? order.id.slice(0, 8)}</p>
            <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          {/* Захиалагчийн мэдээлэл */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User size={12} /> {order.customerName ?? "Нэргүй"}
            </span>
            {order.customerPhone && (
              <span className="flex items-center gap-1">
                <Phone size={12} /> {order.customerPhone}
              </span>
            )}
            {order.customerEmail && (
              <span className="flex items-center gap-1">
                <Mail size={12} /> {order.customerEmail}
              </span>
            )}
            <span>{formatDateTime(order.created_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant="secondary" className="text-xs">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
          <span className="font-bold text-primary">₮{order.amount_mnt.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
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
      toast.success("Хадгаллаа");
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
        <div className="relative h-28 w-36 sm:h-36 sm:w-48 md:h-42 md:w-56 lg:h-58 lg:w-72 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
          {p.thumbUrl && <Image src={p.thumbUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />}
        </div>

        {/* Detail + controls */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8).toUpperCase()}</span>
            <Badge variant="secondary" className="text-xs">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</span>
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
