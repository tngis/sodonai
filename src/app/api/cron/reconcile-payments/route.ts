import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPayment } from "@/lib/qpay";
import { confirmPayment } from "@/lib/payments/confirm";
import type { Database } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export const dynamic = "force-dynamic";

// Backstop for a user who paid but never returned to the tab — the poll route
// never confirmed, so the order would otherwise stay 'pending' forever. Sweeps
// recent still-pending payments and confirms any QPay reports as paid (idempotent
// via confirmPayment). Protect with CRON_SECRET and call from a scheduler (e.g.
// Vercel Cron) every few minutes: `Authorization: Bearer ${CRON_SECRET}`.

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const BATCH = 100;

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

  console.log(JSON.stringify({
    event: "reconcile.done", scanned: pending.length, confirmed, ts: new Date().toISOString(),
  }));
  return NextResponse.json({ ok: true, scanned: pending.length, confirmed });
}

// GET for Vercel Cron (sends GET); POST for manual/other schedulers.
export async function GET(req: NextRequest) { return reconcile(req); }
export async function POST(req: NextRequest) { return reconcile(req); }
