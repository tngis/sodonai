import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPayment } from "@/lib/qpay";
import { confirmPayment, ensureGenerationForOrder } from "@/lib/payments/confirm";
import { confirmTopUp } from "@/lib/payments/topup";
import type { Database } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type TopUpRow = Database["public"]["Tables"]["wallet_topups"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export const dynamic = "force-dynamic";

// Backstop for a user who paid but never returned to the tab — the poll route
// never confirmed, so the order would otherwise stay 'pending' forever. Sweeps
// recent still-pending payments and confirms any QPay reports as paid (idempotent
// via confirmPayment). Protect with CRON_SECRET and call from a scheduler (e.g.
// Vercel Cron) every few minutes: `Authorization: Bearer ${CRON_SECRET}`.

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const BATCH = 100;
// Only treat a paid order as an "orphan" once it's old enough that a normal
// confirm should have created its generation — avoids racing confirmPayment.
const ORPHAN_MIN_AGE_MS = 5 * 60 * 1000; // 5 minutes

function authorized(req: NextRequest, secret: string): boolean {
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

async function reconcile(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const { data } = await admin
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(BATCH);

  const pending = (data ?? []) as unknown as PaymentRow[];
  let confirmed = 0;

  for (const payment of pending) {
    try {
      const result = await checkPayment(payment.qpay_invoice_id ?? "", payment.created_at);
      if (!result.paid) continue;
      await confirmPayment(payment, result.paidAt ?? new Date().toISOString());
      confirmed++;
    } catch (err) {
      console.error(JSON.stringify({
        event: "reconcile.payment_error",
        paymentId: payment.id,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }));
    }
  }

  // Wallet top-ups live in a separate table and are NOT reachable via the payments
  // sweep above — the webhook + the client poll are their only other confirmers.
  // Without this, a user who paid a top-up but closed the app before the poll
  // confirmed would never get credited. confirmTopUp is idempotent (key topup:{id}).
  const { data: topupData } = await admin
    .from("wallet_topups")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(BATCH);

  const pendingTopups = (topupData ?? []) as unknown as TopUpRow[];
  let credited = 0;

  for (const topup of pendingTopups) {
    try {
      const res = await confirmTopUp(topup);
      if (res.status === "credited") credited++;
    } catch (err) {
      console.error(JSON.stringify({
        event: "reconcile.topup_error",
        topUpId: topup.id,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }));
    }
  }

  // Orphan paid orders: a generation order whose payment is settled (order=paid)
  // but whose generation row was never created — e.g. the insert in confirmPayment
  // failed after the order flipped paid. Neither the payment sweep (payment is
  // already success) nor fail-stale (no generation row exists) catches these.
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS).toISOString();
  const { data: orderData } = await admin
    .from("orders")
    .select("*")
    .eq("status", "paid")
    .neq("kind", "print")
    .not("preset_id", "is", null)
    .gte("created_at", since)
    .lte("created_at", orphanCutoff)
    .order("created_at", { ascending: false })
    .limit(BATCH);

  const candidates = (orderData ?? []) as unknown as OrderRow[];
  let recovered = 0;

  if (candidates.length) {
    // One query to find which candidates already have a generation, so we only
    // call ensureGenerationForOrder for the genuine orphans.
    const { data: gens } = await admin
      .from("generations")
      .select("order_id")
      .in("order_id", candidates.map((o) => o.id));
    const haveGen = new Set((gens ?? []).map((g) => (g as { order_id: string }).order_id));

    for (const order of candidates) {
      if (haveGen.has(order.id)) continue;
      try {
        await ensureGenerationForOrder(order);
        recovered++;
      } catch (err) {
        console.error(JSON.stringify({
          event: "reconcile.orphan_error",
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
          ts: new Date().toISOString(),
        }));
      }
    }
  }

  console.log(JSON.stringify({
    event: "reconcile.done",
    scanned: pending.length, confirmed,
    topupsScanned: pendingTopups.length, credited,
    ordersScanned: candidates.length, recovered,
    ts: new Date().toISOString(),
  }));
  return NextResponse.json({
    ok: true,
    scanned: pending.length, confirmed,
    topupsScanned: pendingTopups.length, credited,
    ordersScanned: candidates.length, recovered,
  });
}

// GET for Vercel Cron (sends GET); POST for manual/other schedulers.
export async function GET(req: NextRequest) { return reconcile(req); }
export async function POST(req: NextRequest) { return reconcile(req); }
