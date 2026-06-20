import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth-admin";
import { getSignedUrls } from "@/lib/supabase/storage";
import {
  OrderManager,
  type AdminOrderItem,
  type OrderFilters,
  type PrintEvent,
} from "@/components/admin/order-manager";
import type {
  Database,
  OrderStatus,
  PrintProductionStatus,
  PrintDeliveryStatus,
  GenerationStatus,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const OUTPUTS_BUCKET = "outputs";
const PAGE_SIZE = 15;

type ViewRow = Database["public"]["Views"]["admin_order_list"]["Row"];

function str(v: string | string[] | undefined, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  await requireStaff("orders");
  const sp = await searchParams;

  const tab = str(sp.tab) === "gen" ? "generation" : "print";
  const pageParam = parseInt(str(sp.page, "1"), 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const q = str(sp.q).trim();

  const filters: OrderFilters = {
    q,
    status: str(sp.status, "all"),
    production: str(sp.production, "all"),
    delivery: str(sp.delivery, "all"),
    frame: str(sp.frame, "all"),
    size: str(sp.size, "all"),
    preset: str(sp.preset, "all"),
    from: str(sp.from),
    to: str(sp.to),
  };

  const admin = createAdminClient();

  // Build the filtered + paginated page query (the heavy view query).
  let query = admin.from("admin_order_list").select("*", { count: "exact" }).eq("kind", tab);

  if (filters.status !== "all") query = query.eq("status", filters.status as OrderStatus);
  if (q) query = query.ilike("search", `%${q.toLowerCase()}%`);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);

  if (tab === "print") {
    if (filters.production !== "all") query = query.eq("production_status", filters.production as PrintProductionStatus);
    if (filters.delivery !== "all") query = query.eq("delivery_status", filters.delivery as PrintDeliveryStatus);
    if (filters.frame !== "all") query = query.eq("frame_id", filters.frame);
    if (filters.size !== "all") query = query.eq("size_id", filters.size);
  } else if (filters.preset !== "all") {
    query = query.eq("preset_name", filters.preset);
  }

  const offset = (page - 1) * PAGE_SIZE;

  // Tab-badge totals come from the base `orders` table (cheap — no joins), not the
  // heavy view that recomputes a 4-way join. Run them with the page query + preset
  // list in one parallel batch so a tab switch is a single round-trip.
  const [printTotalRes, genTotalRes, mainRes, presetNamesRes] = await Promise.all([
    admin.from("orders").select("id", { count: "exact", head: true }).eq("kind", "print"),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("kind", "generation"),
    query.order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
    admin.from("presets").select("name_mn").order("name_mn"),
  ]);

  const printCount = printTotalRes.count ?? 0;
  const genCount = genTotalRes.count ?? 0;
  const presetOptions = [...new Set((presetNamesRes.data ?? []).map((p) => p.name_mn))];

  const rows = (mainRes.data ?? []) as ViewRow[];
  const total = mainRes.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Print-only enrichment: thumbnails + audit history. The AI tab has neither, so
  // these resolve instantly (no extra round-trip). Run both in parallel.
  const printRows = rows.filter((r) => r.kind === "print" && r.asset_storage_path);
  const printIds = rows.filter((r) => r.print_id).map((r) => r.print_id as string);
  const assetPaths = [...new Set(printRows.map((r) => r.asset_storage_path as string))];

  type EventRow = {
    print_order_id: string;
    field: "production" | "delivery" | "note";
    from_value: string | null;
    to_value: string | null;
    actor_name: string | null;
    created_at: string;
  };
  const [assetsRes, eventsRes] = await Promise.all([
    assetPaths.length
      ? admin.from("assets").select("storage_path, thumb_path").in("storage_path", assetPaths)
      : Promise.resolve({ data: [] as { storage_path: string; thumb_path: string | null }[] }),
    printIds.length
      ? admin
          .from("print_order_events")
          .select("print_order_id, field, from_value, to_value, actor_name, created_at")
          .in("print_order_id", printIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as EventRow[] }),
  ]);

  const thumbPathByStorage = new Map(
    (assetsRes.data ?? []).map((a) => [a.storage_path, a.thumb_path ?? a.storage_path]),
  );
  const signPaths = printRows.map(
    (r) => thumbPathByStorage.get(r.asset_storage_path as string) ?? (r.asset_storage_path as string),
  );
  const signed = signPaths.length ? await getSignedUrls(OUTPUTS_BUCKET, signPaths, 3600) : [];
  const thumbByAsset = new Map(printRows.map((r, i) => [r.asset_storage_path as string, signed[i] ?? ""]));

  const eventsByPrint = new Map<string, PrintEvent[]>();
  for (const e of (eventsRes.data ?? []) as EventRow[]) {
    const list = eventsByPrint.get(e.print_order_id) ?? [];
    list.push({ field: e.field, from: e.from_value, to: e.to_value, actor: e.actor_name, at: e.created_at });
    eventsByPrint.set(e.print_order_id, list);
  }

  const items: AdminOrderItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    amount_mnt: r.amount_mnt,
    created_at: r.created_at,
    presetName: r.preset_name ?? r.preset_id ?? null,
    customerName: r.customer_name,
    customerPhone: r.customer_phone || null,
    customerEmail: r.customer_email,
    print: r.print_id
      ? {
          id: r.print_id,
          frame_id: r.frame_id as string,
          size_id: r.size_id as string,
          ship_recipient: r.ship_recipient as string,
          ship_phone: r.ship_phone as string,
          ship_address: r.ship_address as string,
          production_status: r.production_status as PrintProductionStatus,
          delivery_status: r.delivery_status as PrintDeliveryStatus,
          admin_note: r.admin_note,
          thumbUrl: thumbByAsset.get(r.asset_storage_path as string) ?? "",
          events: eventsByPrint.get(r.print_id) ?? [],
        }
      : null,
    generation: r.generation_id
      ? {
          id: r.generation_id,
          status: r.generation_status as GenerationStatus,
          error: r.generation_error,
        }
      : null,
  }));

  return (
    <OrderManager
      tab={tab === "generation" ? "gen" : "print"}
      orders={items}
      total={total}
      page={page}
      pageCount={pageCount}
      printCount={printCount}
      genCount={genCount}
      filters={filters}
      presetOptions={presetOptions}
    />
  );
}
