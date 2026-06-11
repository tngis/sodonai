"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFiles, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

export interface UserExport {
  exportedAt: string;
  user: { id: string; email?: string; name?: string | null; phone?: string };
  orders: unknown[];
  payments: unknown[];
  assetCount: number;
}

export async function exportUserData(): Promise<UserExport> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const [ordersRes, paymentsRes, assetsRes, profileRes] = await Promise.all([
    supabase.from("orders").select("id, preset_id, status, amount_mnt, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("id, order_id, provider, status, amount_mnt, paid_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("users").select("name, phone").eq("id", user.id).single(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: profileRes.data?.name,
      phone: profileRes.data?.phone ?? undefined,
    },
    orders: ordersRes.data ?? [],
    payments: paymentsRes.data ?? [],
    assetCount: assetsRes.count ?? 0,
  };
}

export async function deleteAccount(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const admin = createAdminClient();

  // Delete saved output files from storage (best-effort)
  const { data: assets } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("user_id", user.id);

  if (assets && assets.length > 0) {
    await removeFiles(OUTPUTS_BUCKET, assets.map((a) => a.storage_path));
  }

  // Delete auth user — cascades to public.users, orders, payments, generations, assets
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);
}
