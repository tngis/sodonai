import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeFiles, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

// GET /api/account — export user data as JSON (mobile).
// Mirrors the exportUserData server action.
export async function GET(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, user } = auth;

  const [ordersRes, paymentsRes, assetsRes, profileRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, preset_id, status, amount_mnt, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, order_id, provider, status, amount_mnt, paid_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("users").select("name, phone").eq("id", user.id).single(),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: profileRes.data?.name ?? null,
      phone: profileRes.data?.phone ?? null,
    },
    orders: ordersRes.data ?? [],
    payments: paymentsRes.data ?? [],
    assetCount: assetsRes.count ?? 0,
  });
}

// DELETE /api/account — permanently delete the caller's account (mobile).
// Mirrors the deleteAccount server action. Requires Bearer auth only (not cookie)
// to prevent CSRF from web.
export async function DELETE(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, user } = auth;

  // Delete stored output files (best-effort)
  const [{ data: assets }, { data: profile }] = await Promise.all([
    supabase.from("assets").select("storage_path").eq("user_id", user.id),
    supabase.from("users").select("avatar_url").eq("id", user.id).single(),
  ]);

  const paths = (assets ?? []).map((a: { storage_path: string }) => a.storage_path);
  const avatarUrl = (profile as { avatar_url: string | null } | null)?.avatar_url;
  if (avatarUrl?.startsWith(`${user.id}/profile/`)) {
    paths.push(avatarUrl);
  }
  if (paths.length > 0) {
    await removeFiles(OUTPUTS_BUCKET, paths);
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
