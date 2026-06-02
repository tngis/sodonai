import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// QPay sends a POST callback when a payment is confirmed.
// Production checklist:
//   1. Set QPAY_WEBHOOK_SECRET in env (obtain from QPay merchant dashboard)
//   2. Implement the payment confirmation logic (currently handled by polling /api/payment/[id])
//   3. Remove the polling approach once webhooks are verified working in production

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

  // TODO: parse invoice_id from body, find the matching payment record,
  // and call the same confirmation logic as /api/payment/[id] to flip
  // the order to "paid" and start generation. The polling route handles
  // this today; migrate here once QPay credentials are live.

  return NextResponse.json({ ok: true });
}
