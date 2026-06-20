"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Loader2, Package, Sparkles, Search, SlidersHorizontal,
  ChevronLeft, ChevronRight, User, Phone, Mail, RotateCcw, History,
} from "lucide-react";
import { updatePrintFulfillment } from "@/app/actions/admin";
import { retryGeneration } from "@/app/actions/generation";
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

const STATUS_OPTIONS = [
  { value: "all", label: "Бүгд" },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const SEARCH_DEBOUNCE_MS = 350;

export interface PrintEvent {
  field: "production" | "delivery" | "note";
  from: string | null;
  to: string | null;
  actor: string | null;
  at: string;
}

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
  events: PrintEvent[];
}

export interface AdminGenerationDetail {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  error: string | null;
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
  generation: AdminGenerationDetail | null;
}

// Current filter state, mirrored to the URL. "all"/"" mean "no filter".
export interface OrderFilters {
  q: string;
  status: string;
  production: string;
  delivery: string;
  frame: string;
  size: string;
  preset: string;
  from: string;
  to: string;
}

interface OrderManagerProps {
  tab: "print" | "gen";
  orders: AdminOrderItem[];
  total: number;
  page: number; // 1-based
  pageCount: number;
  printCount: number;
  genCount: number;
  filters: OrderFilters;
  presetOptions: string[];
}

export function OrderManager({
  tab, orders, total, page, pageCount, printCount, genCount, filters, presetOptions,
}: OrderManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // isPending stays true while the server fetches the new page, so we can show a
  // loader over the list instead of a frozen UI during the navigation.
  const [isPending, startTransition] = useTransition();

  // Mirror filter/search/page state to the URL; the server re-renders with the
  // matching page of data. Values equal to a default ("all"/empty) are dropped.
  const pushParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const setFilter = (key: keyof OrderFilters, value: string) =>
    pushParams({ [key]: value, page: null });

  const goToPage = (p: number) => pushParams({ page: p > 1 ? String(p) : null });

  // Debounced search input → URL (keeps focus across the soft navigation since
  // this component stays mounted).
  const [queryInput, setQueryInput] = useState(filters.q);
  useEffect(() => {
    const h = setTimeout(() => {
      if (queryInput.trim() !== filters.q) pushParams({ q: queryInput.trim() || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const [filterOpen, setFilterOpen] = useState(false);

  // Optimistic tab so the segmented pill moves instantly on click, before the
  // server navigation resolves; re-syncs once the server confirms the new tab.
  const [optimisticTab, setOptimisticTab] = useState(tab);
  useEffect(() => { setOptimisticTab(tab); }, [tab]);

  const resetFilters = () => {
    setQueryInput("");
    pushParams({
      q: null, status: null, production: null, delivery: null,
      frame: null, size: null, preset: null, from: null, to: null, page: null,
    });
  };

  const isPrint = tab === "print";

  let activeCount = 0;
  if (filters.status !== "all") activeCount++;
  if (filters.from) activeCount++;
  if (filters.to) activeCount++;
  if (isPrint) {
    if (filters.production !== "all") activeCount++;
    if (filters.delivery !== "all") activeCount++;
    if (filters.frame !== "all") activeCount++;
    if (filters.size !== "all") activeCount++;
  } else if (filters.preset !== "all") {
    activeCount++;
  }

  const presetSelectOptions = [
    { value: "all", label: "Бүгд" },
    ...presetOptions.map((n) => ({ value: n, label: n })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs
        tabs={[
          { key: "print", label: `Хэвлэлийн захиалга (${printCount})`, icon: <Package size={15} /> },
          { key: "gen", label: `AI үүсгэлт (${genCount})`, icon: <Sparkles size={15} /> },
        ]}
        value={optimisticTab}
        onChange={(key) => {
          const next = key === "gen" ? "gen" : "print";
          setOptimisticTab(next);
          pushParams({ tab: next === "gen" ? "gen" : null, page: null });
        }}
        layoutId="orders-tab"
      />

      <div className="flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={isPrint ? "Захиалагч, утас, хаяг, ID-аар хайх…" : "Захиалагч, утас, имэйл, пресет, ID-аар хайх…"}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={() => setFilterOpen(true)} className="relative shrink-0 gap-1.5 rounded-lg">
            <SlidersHorizontal size={15} /> Шүүлтүүр
            {activeCount > 0 && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        </div>

        {/* List + pagination, dimmed with a spinner overlay while navigating. */}
        <div className="relative min-h-40" aria-busy={isPending}>
          {isPending && (
            <div className="absolute inset-0 z-10 flex items-start justify-center pt-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          )}
          <div className={cn("transition-opacity", isPending && "pointer-events-none opacity-40")}>
            {orders.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Захиалга олдсонгүй.</p>
            ) : isPrint ? (
              <div className="flex flex-col gap-3">
                {orders.map((o) => <PrintOrderCard key={o.id} order={o} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {orders.map((o) => <GenOrderCard key={o.id} order={o} />)}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground">Нийт {total}</span>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="Өмнөх">
                    <ChevronLeft size={15} />
                  </Button>
                  <span className="text-sm font-medium tabular-nums">{page} / {pageCount}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= pageCount} onClick={() => goToPage(page + 1)} aria-label="Дараах">
                    <ChevronRight size={15} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isPrint ? "Хэвлэлийн захиалга шүүх" : "AI үүсгэлтийн захиалга шүүх"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterSelect label="Төлбөрийн төлөв" value={filters.status} onChange={(v) => setFilter("status", v)} options={STATUS_OPTIONS} />
            {isPrint ? (
              <>
                <FilterSelect label="Үйлдвэрлэл" value={filters.production} onChange={(v) => setFilter("production", v)}
                  options={[{ value: "all", label: "Бүгд" }, ...Object.entries(PRODUCTION_LABELS).map(([value, label]) => ({ value, label }))]} />
                <FilterSelect label="Хүргэлт" value={filters.delivery} onChange={(v) => setFilter("delivery", v)}
                  options={[{ value: "all", label: "Бүгд" }, ...Object.entries(DELIVERY_LABELS).map(([value, label]) => ({ value, label }))]} />
                <FilterSelect label="Жааз" value={filters.frame} onChange={(v) => setFilter("frame", v)}
                  options={[{ value: "all", label: "Бүгд" }, ...FRAMES.map((f) => ({ value: f.id, label: f.name_mn }))]} />
                <FilterSelect label="Хэмжээ" value={filters.size} onChange={(v) => setFilter("size", v)}
                  options={[{ value: "all", label: "Бүгд" }, ...SIZES.map((s) => ({ value: s.id, label: s.label }))]} />
              </>
            ) : (
              <FilterSelect label="Пресет" value={filters.preset} onChange={(v) => setFilter("preset", v)} options={presetSelectOptions} />
            )}
            <div className="sm:col-span-2">
              <DateRange from={filters.from} to={filters.to} onFrom={(v) => setFilter("from", v)} onTo={(v) => setFilter("to", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full gap-1.5" onClick={resetFilters}>
              <RotateCcw size={14} /> Цэвэрлэх
            </Button>
            <Button className="rounded-full font-bold" onClick={() => setFilterOpen(false)}>Хаах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared UI bits ──────────────────────────────────────────
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

// Deterministic date formatting — a fixed timeZone + universally-supported
// locale (en-GB) so the server and client render the exact same string.
function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// ─── AI generation order card ────────────────────────────────
function GenOrderCard({ order }: { order: AdminOrderItem }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const gen = order.generation;
  const failed = gen?.status === "failed";

  const handleRetry = async () => {
    if (!gen) return;
    setRetrying(true);
    try {
      await retryGeneration(gen.id);
      toast.success("Дахин эхлүүллээ");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setRetrying(false);
    }
  };

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
          {failed && gen?.error && (
            <p className="mt-1 line-clamp-2 text-xs text-destructive">{gen.error}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant="secondary" className="text-xs">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
          <span className="font-bold text-primary">₮{order.amount_mnt.toLocaleString()}</span>
          {failed && (
            <Button onClick={handleRetry} disabled={retrying} size="sm" variant="outline" className="gap-1.5 rounded-full">
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Дахин оролдох
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Human-readable line for one audit event (status codes → MN labels).
function describeEvent(e: PrintEvent): string {
  if (e.field === "note") {
    return `Тэмдэглэл: ${e.to ? `"${e.to}"` : "(хоослов)"}`;
  }
  const fieldLabel = e.field === "production" ? "Үйлдвэрлэл" : "Хүргэлт";
  const labels: Record<string, string> = e.field === "production" ? PRODUCTION_LABELS : DELIVERY_LABELS;
  const val = (v: string | null) => (v ? labels[v] ?? v : "—");
  return `${fieldLabel}: ${val(e.from)} → ${val(e.to)}`;
}

// ─── Print order card ────────────────────────────────────────
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
  const [showHistory, setShowHistory] = useState(false);

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
              <Select
                items={PRODUCTION_LABELS}
                value={prod}
                onValueChange={(v) => {
                  if (typeof v !== "string") return;
                  const next = v as PrintProductionStatus;
                  setProd(next);
                  // Delivery can't be ahead of production — pull it back to pending
                  // if production drops below "ready".
                  if (next !== "ready" && delv !== "pending") setDelv("pending");
                }}
              >
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
              <Select
                items={DELIVERY_LABELS}
                value={delv}
                onValueChange={(v) => typeof v === "string" && setDelv(v as PrintDeliveryStatus)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DELIVERY_LABELS) as PrintDeliveryStatus[]).map((k) => (
                    <SelectItem key={k} value={k} disabled={k !== "pending" && prod !== "ready"}>
                      {DELIVERY_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {prod !== "ready" && (
                <p className="mt-1 text-xs text-muted-foreground">Үйлдвэрлэл бэлэн болсны дараа хүргэлт идэвхжинэ.</p>
              )}
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

          {p.events.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-2">
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <History size={12} /> Түүх ({p.events.length})
              </button>
              {showHistory && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {p.events.map((e, i) => (
                    <li key={i} className="flex flex-col gap-0.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                      <span className="text-muted-foreground">{formatDateTime(e.at)}</span>
                      <span>{describeEvent(e)}</span>
                      {e.actor && <span className="text-muted-foreground">· {e.actor}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
