import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRouteStaff, ForbiddenError } from "@/lib/auth-admin";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";
import type {
  PrintProductionStatus,
  PrintDeliveryStatus,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface PrintRow {
  id: string;
  order_id: string;
  asset_storage_path: string;
  frame_id: string;
  size_id: string;
  ship_recipient: string;
  ship_phone: string;
  ship_address: string;
  production_status: PrintProductionStatus;
  delivery_status: PrintDeliveryStatus;
  admin_note: string | null;
  created_at: string;
}

// Print-order fulfillment queue for the mobile admin screen. Staff-only (orders
// capability); reads across all users via the service-role client after the
// Bearer-token role check. `scope=active` (default) hides delivered orders.
export async function GET(req: NextRequest) {
  let staff;
  try {
    staff = await getRouteStaff(req, "orders");
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope") === "all" ? "all" : "active";
  const admin = createAdminClient();

  let query = admin
    .from("print_orders")
    .select(
      "id, order_id, asset_storage_path, frame_id, size_id, ship_recipient, ship_phone, ship_address, production_status, delivery_status, admin_note, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  // The working queue: anything not yet delivered.
  if (scope === "active") query = query.neq("delivery_status", "delivered");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as PrintRow[];
  if (rows.length === 0) return NextResponse.json({ orders: [] });

  // Resolve thumbnails: map each order's full-size asset path to its thumb_path
  // (fall back to the full path), then batch-presign in one shot.
  const assetPaths = [...new Set(rows.map((r) => r.asset_storage_path))];
  const { data: assetRows } = await admin
    .from("assets")
    .select("storage_path, thumb_path")
    .in("storage_path", assetPaths);
  const thumbByStorage = new Map(
    (assetRows ?? []).map((a) => [a.storage_path, a.thumb_path ?? a.storage_path]),
  );

  const signPaths = rows.map(
    (r) => thumbByStorage.get(r.asset_storage_path) ?? r.asset_storage_path,
  );
  const signed = await getSignedUrls(OUTPUTS_BUCKET, signPaths, 3600);

  const orders = rows.map((r, i) => ({
    id: r.id,
    orderId: r.order_id,
    createdAt: r.created_at,
    recipient: r.ship_recipient,
    phone: r.ship_phone,
    address: r.ship_address,
    frameId: r.frame_id,
    sizeId: r.size_id,
    productionStatus: r.production_status,
    deliveryStatus: r.delivery_status,
    adminNote: r.admin_note,
    thumbUrl: signed[i] ?? "",
  }));

  return NextResponse.json({ orders });
}
