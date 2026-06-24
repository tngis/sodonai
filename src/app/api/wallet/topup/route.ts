import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { createTopUpIntentCore } from "@/lib/payments/topup";

// Mobile entry point for starting a wallet top-up. Mirrors the createTopUpIntent
// server action but authenticates via Bearer. The client then polls
// /api/wallet/topup/[id] until the wallet is credited.
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { amountMnt?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  try {
    const result = await createTopUpIntentCore({ ...auth, amountMnt: Number(body.amountMnt) });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
