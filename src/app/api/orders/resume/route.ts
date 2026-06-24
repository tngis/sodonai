import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { resumePaymentCore } from "@/lib/payments/intent";

// Mobile entry point for finishing payment on a still-pending order. Mirrors the
// resumePayment server action but authenticates via Bearer. Returns a fresh QPay
// QR + deep links; the client then polls /api/payment/[paymentId].
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ error: "Захиалга заагаагүй." }, { status: 400 });
  }

  try {
    const result = await resumePaymentCore({ ...auth, orderId: body.orderId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
