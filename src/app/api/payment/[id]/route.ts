import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPayment } from "@/lib/qpay";
import { runGeneration } from "@/app/actions/generation";
import { getInternalPrompt } from "@/lib/presets-server";
import type { Database } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

interface OptionsSnapshot {
  ratio: string;
  background: string | null;
  intensity: number | null;
  isPrivate: boolean;
  uploadPaths: string[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paymentId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rawPayment, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", user.id)
    .single();

  if (payErr || !rawPayment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const payment = rawPayment as unknown as PaymentRow;

  // Already confirmed in a previous poll — return the generation ID
  if (payment.status === "success") {
    const { data: gen } = await supabase
      .from("generations")
      .select("id")
      .eq("order_id", payment.order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return NextResponse.json({ status: "paid", generationId: gen?.id ?? null });
  }

  // Ask QPay (or mock) if the user has paid
  const result = await checkPayment(
    payment.qpay_invoice_id ?? "",
    payment.created_at
  );

  console.log(JSON.stringify({ event: "payment.poll", paymentId, paid: result.paid, ts: new Date().toISOString() }));

  if (!result.paid) {
    return NextResponse.json({ status: "pending" });
  }

  console.log(JSON.stringify({ event: "payment.confirmed", paymentId, orderId: payment.order_id, ts: new Date().toISOString() }));

  // ── Payment confirmed ────────────────────────────────────────────────────
  const admin = createAdminClient();

  await admin
    .from("payments")
    .update({ status: "success", paid_at: result.paidAt ?? new Date().toISOString() })
    .eq("id", paymentId);

  await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", payment.order_id);

  // Fetch order to get preset + upload paths
  const { data: rawOrder } = await admin
    .from("orders")
    .select("*")
    .eq("id", payment.order_id)
    .single();

  const order = rawOrder as unknown as OrderRow;
  const snapshot = order.options_snapshot as unknown as OptionsSnapshot;

  // Create queued generation record
  const { data: gen } = await admin
    .from("generations")
    .insert({
      order_id: payment.order_id,
      user_id: user.id,
      status: "queued" as const,
      progress: 0,
      queue_position: 1,
    })
    .select()
    .single();

  if (!gen) {
    return NextResponse.json({ error: "Failed to create generation" }, { status: 500 });
  }

  const internalPrompt = await getInternalPrompt(order.preset_id);

  // Kick off generation after this response is sent
  after(() =>
    runGeneration({
      generationId: gen.id,
      orderId: payment.order_id,
      userId: user.id,
      uploadPaths: snapshot.uploadPaths ?? [],
      internalPrompt,
      options: {
        ratio: snapshot.ratio,
        background: snapshot.background,
        intensity: snapshot.intensity,
      },
    })
  );

  return NextResponse.json({ status: "paid", generationId: gen.id });
}
