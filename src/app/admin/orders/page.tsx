import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedUrls } from "@/lib/supabase/storage";
import { OrderManager, type AdminOrderItem } from "@/components/admin/order-manager";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "user_id" | "preset_id" | "kind" | "status" | "amount_mnt" | "created_at"
>;
type PrintRow = Database["public"]["Tables"]["print_orders"]["Row"];
type UserRow = Pick<Database["public"]["Tables"]["users"]["Row"], "id" | "name" | "phone" | "email">;

const OUTPUTS_BUCKET = "outputs";
const ORDERS_LIMIT = 500;

export default async function AdminOrdersPage() {
  const admin = createAdminClient();

  // 1) Fetch the recent orders + preset names first so we know which
  //    print rows and users we actually need (scoped fetches below).
  const [ordersRes, presetsRes] = await Promise.all([
    admin
      .from("orders")
      .select("id, user_id, preset_id, kind, status, amount_mnt, created_at")
      .order("created_at", { ascending: false })
      .limit(ORDERS_LIMIT),
    admin.from("presets").select("id, name_mn"),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const presetNames = new Map((presetsRes.data ?? []).map((p) => [p.id, p.name_mn]));

  const orderIds = orders.map((o) => o.id);
  const userIds = [...new Set(orders.map((o) => o.user_id))];

  // 2) Only fetch the print rows and users referenced by those orders —
  //    not the entire tables. Email now lives in public.users (mirrored
  //    from auth.users by a trigger), so no listUsers() over every user.
  const [printRes, usersRes] = await Promise.all([
    orderIds.length
      ? admin.from("print_orders").select("*").in("order_id", orderIds)
      : Promise.resolve({ data: [] as PrintRow[] }),
    userIds.length
      ? admin.from("users").select("id, name, phone, email").in("id", userIds)
      : Promise.resolve({ data: [] as UserRow[] }),
  ]);

  const prints = (printRes.data ?? []) as PrintRow[];
  const usersById = new Map((usersRes.data ?? []).map((u) => [u.id, u as UserRow]));
  const printByOrder = new Map(prints.map((p) => [p.order_id, p]));

  // 3) Batch-sign thumbnails for the print rows we loaded (single storage call).
  const printPaths = prints.map((p) => p.asset_storage_path);
  const signed = printPaths.length ? await getSignedUrls(OUTPUTS_BUCKET, printPaths, 3600) : [];
  const thumbByPath = new Map(printPaths.map((path, i) => [path, signed[i] ?? ""]));

  const items: AdminOrderItem[] = orders.map((o) => {
    const pr = printByOrder.get(o.id);
    const user = usersById.get(o.user_id);
    return {
      id: o.id,
      kind: o.kind,
      status: o.status,
      amount_mnt: o.amount_mnt,
      created_at: o.created_at,
      presetName: o.preset_id ? (presetNames.get(o.preset_id) ?? o.preset_id) : null,
      customerName: user?.name ?? null,
      customerPhone: user?.phone || null,
      customerEmail: user?.email ?? null,
      print: pr
        ? {
            id: pr.id,
            frame_id: pr.frame_id,
            size_id: pr.size_id,
            ship_recipient: pr.ship_recipient,
            ship_phone: pr.ship_phone,
            ship_address: pr.ship_address,
            production_status: pr.production_status,
            delivery_status: pr.delivery_status,
            admin_note: pr.admin_note,
            thumbUrl: thumbByPath.get(pr.asset_storage_path) ?? "",
          }
        : null,
    };
  });

  return <OrderManager orders={items} />;
}
