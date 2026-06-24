import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import {
  createPrintIntentCore,
  payPrintWithWalletCore,
  type PrintIntentInput,
} from "@/lib/payments/print-intent";

// Mobile entry point for ordering a physical print. Mirrors the createPrintIntent
// / payPrintWithWallet server actions but authenticates via Bearer. Body:
// { assetStoragePath, frameId, sizeId, addressId, method: "wallet" | "qpay" }.
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<PrintIntentInput> & { method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const { assetStoragePath, frameId, sizeId, addressId } = body;
  if (!assetStoragePath || !frameId || !sizeId || !addressId) {
    return NextResponse.json({ error: "Дутуу мэдээлэл." }, { status: 400 });
  }
  const input: PrintIntentInput = { assetStoragePath, frameId, sizeId, addressId };

  try {
    if (body.method === "wallet") {
      return NextResponse.json(await payPrintWithWalletCore({ ...auth, input }));
    }
    return NextResponse.json(await createPrintIntentCore({ ...auth, input }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
