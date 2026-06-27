import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { payPendingWithWalletCore } from "@/lib/payments/intent";

// Mobile entry point for settling a still-pending order from the wallet. Mirrors
// the payPendingWithWallet server action but authenticates via Bearer. Returns
// { orderId, kind, generationId } — for generation orders the client then polls
// /api/generation/[generationId]; print orders are fulfilled manually.
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
    const result = await payPendingWithWalletCore({ ...auth, orderId: body.orderId });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
