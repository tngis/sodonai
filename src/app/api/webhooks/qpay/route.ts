import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPayment } from "@/lib/qpay";
import { confirmPayment } from "@/lib/payments/confirm";
import type { Database } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

// QPay sends a POST callback when a payment is confirmed. This is the live
// fast-path; /api/payment/[id] polling and /api/cron/reconcile-payments are
// backstops. All three share confirmPayment(), which is idempotent.
// Production checklist:
//   1. Set QPAY_WEBHOOK_SECRET in env (obtain from QPay merchant dashboard)
//   2. Register this route as the invoice callback_url (see lib/qpay realCreateInvoice)

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const secret = process.env.QPAY_WEBHOOK_SECRET;
  const signature = req.headers.get("x-qpay-signature") ?? "";

  // Enforce signature verification when secret is configured
  if (secret) {
    if (!signature || !verifySignature(bodyText, signature, secret)) {
      console.warn(JSON.stringify({ event: "webhook.qpay.invalid_signature", ts: new Date().toISOString() }));
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: unknown;
  try { body = JSON.parse(bodyText); } catch { body = null; }

  console.log(JSON.stringify({ event: "webhook.qpay.received", body, ts: new Date().toISOString() }));

  // QPay's payment callback identifies the invoice; field name varies by
  // integration, so accept the common ones.
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawInvoice = rec.object_id ?? rec.invoice_id ?? rec.payment_id;
  const invoiceId = typeof rawInvoice === "string" ? rawInvoice : null;
  if (!invoiceId) return NextResponse.json({ ok: true, ignored: "no invoice id" });

  const admin = createAdminClient();
  const { data: rawPayment } = await admin
    .from("payments")
    .select("*")
    .eq("qpay_invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payment = rawPayment as unknown as PaymentRow | null;
  if (!payment) return NextResponse.json({ ok: true, ignored: "unknown invoice" });
  if (payment.status === "success") return NextResponse.json({ ok: true, already: true });

  // Defense in depth: verify with QPay rather than trusting the callback's claim.
  const result = await checkPayment(payment.qpay_invoice_id ?? "", payment.created_at);
  if (!result.paid) return NextResponse.json({ ok: true, pending: true });

  await confirmPayment(payment, result.paidAt ?? new Date().toISOString());
  return NextResponse.json({ ok: true });
}
