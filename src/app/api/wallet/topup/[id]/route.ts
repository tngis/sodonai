import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPayment } from "@/lib/qpay";
import { creditWallet } from "@/lib/wallet-server";
import type { Database } from "@/lib/supabase/types";

type TopUpRow = Database["public"]["Tables"]["wallet_topups"]["Row"];

// Polled by the wallet top-up flow. Mirrors /api/payment/[id]: ask QPay (or the
// mock) whether the invoice is paid, and on confirmation credit the wallet.
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
  const topup = raw as unknown as TopUpRow;

  // Already credited in a previous poll.
  if (topup.status === "success") {
    const { data: w } = await supabase
      .from("wallets")
      .select("balance_mnt")
      .eq("user_id", user.id)
      .maybeSingle();
    return NextResponse.json({
      status: "credited",
      balance: (w as { balance_mnt: number } | null)?.balance_mnt ?? 0,
    });
  }

  const result = await checkPayment(topup.qpay_invoice_id ?? "", topup.created_at);
  if (!result.paid) return NextResponse.json({ status: "pending" });

  // Credit FIRST (idempotent on `topup:{id}`) so a crash before the status
  // flip can't strand a paid-but-uncredited top-up; the next poll re-credits
  // as a no-op and finishes marking it.
  const balance = await creditWallet({
    userId: user.id,
    amountMnt: topup.amount_mnt,
    type: "topup",
    idempotencyKey: `topup:${topup.id}`,
    note: "QPay цэнэглэлт",
  });

  const admin = createAdminClient();
  await admin
    .from("wallet_topups")
    .update({ status: "success", credited_at: result.paidAt ?? new Date().toISOString() })
    .eq("id", topup.id);

  console.log(JSON.stringify({ event: "wallet.topup.credited", topUpId: topup.id, amount: topup.amount_mnt, ts: new Date().toISOString() }));

  return NextResponse.json({ status: "credited", balance });
}
