import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkPayment } from "@/lib/qpay";
import { confirmPayment } from "@/lib/payments/confirm";
import type { Database } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

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

  // Already confirmed in a previous poll
  if (payment.status === "success") {
    const { data: ord } = await supabase
      .from("orders")
      .select("kind")
      .eq("id", payment.order_id)
      .single();
    if ((ord as { kind?: string } | null)?.kind === "print") {
      return NextResponse.json({ status: "paid", kind: "print", orderId: payment.order_id });
    }
    const { data: gen } = await supabase
      .from("generations")
      .select("id")
      .eq("order_id", payment.order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return NextResponse.json({ status: "paid", kind: "generation", generationId: gen?.id ?? null });
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

  // Idempotent confirmation shared with the QPay webhook + reconcile cron.
  const confirmed = await confirmPayment(payment, result.paidAt ?? new Date().toISOString());
  return NextResponse.json(confirmed);
}
