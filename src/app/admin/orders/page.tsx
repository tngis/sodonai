import { createAdminClient } from "@/lib/supabase/admin";
import { OrderManager, type AdminOrderItem } from "@/components/admin/order-manager";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "preset_id" | "kind" | "status" | "amount_mnt" | "created_at"
>;
type PrintRow = Database["public"]["Tables"]["print_orders"]["Row"];

const OUTPUTS_BUCKET = "outputs";

export default async function AdminOrdersPage() {
  const admin = createAdminClient();

  const [ordersRes, printRes, presetsRes] = await Promise.all([
    admin.from("orders").select("id, preset_id, kind, status, amount_mnt, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("print_orders").select("*"),
    admin.from("presets").select("id, name_mn"),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const prints = (printRes.data ?? []) as PrintRow[];
  const presetNames = new Map((presetsRes.data ?? []).map((p) => [p.id, p.name_mn]));
  const printByOrder = new Map(prints.map((p) => [p.order_id, p]));

  // Batch-sign the thumbnails for every print order.
  const printPaths = prints.map((p) => p.asset_storage_path);
  const signed = printPaths.length
    ? (await admin.storage.from(OUTPUTS_BUCKET).createSignedUrls(printPaths, 3600)).data ?? []
    : [];
  const thumbByPath = new Map(printPaths.map((path, i) => [path, signed[i]?.signedUrl ?? ""]));

  const items: AdminOrderItem[] = orders.map((o) => {
    const pr = printByOrder.get(o.id);
    return {
      id: o.id,
      kind: o.kind,
      status: o.status,
      amount_mnt: o.amount_mnt,
      created_at: o.created_at,
      presetName: o.preset_id ? (presetNames.get(o.preset_id) ?? o.preset_id) : null,
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
