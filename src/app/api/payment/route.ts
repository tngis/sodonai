import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { createPaymentIntentCore, payWithWalletCore } from "@/lib/payments/intent";

// Mobile entry point for starting a paid generation. Mirrors the web server
// actions (createPaymentIntent / payWithWallet) but authenticates via Bearer and
// reads a multipart body: presetId, ratio, background, isPrivate, method ("wallet"
// | "qpay"), and file_0..file_n. The client then polls /api/payment/[id] (qpay)
// or /api/generation/[id] (wallet).
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Зураг хүлээж авахад алдаа гарлаа." },
      { status: 400 },
    );
  }

  try {
    if (formData.get("method") === "wallet") {
      return NextResponse.json(await payWithWalletCore({ ...auth, formData }));
    }
    return NextResponse.json(await createPaymentIntentCore({ ...auth, formData }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
