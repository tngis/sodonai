import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { confirmTopUp } from "@/lib/payments/topup";
import type { Database } from "@/lib/supabase/types";

type TopUpRow = Database["public"]["Tables"]["wallet_topups"]["Row"];

// Polled by the wallet top-up flow. Ownership is enforced here (RLS-scoped read by
// the caller's session); the actual confirm/credit is delegated to confirmTopUp,
// which is shared with the QPay webhook and the reconcile cron and is idempotent.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topUpId } = await params;

  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, user } = auth;

  const { data: raw, error } = await supabase
    .from("wallet_topups")
    .select("*")
    .eq("id", topUpId)
    .eq("user_id", user.id)
    .single();

  if (error || !raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await confirmTopUp(raw as unknown as TopUpRow);
  return NextResponse.json(result);
}
