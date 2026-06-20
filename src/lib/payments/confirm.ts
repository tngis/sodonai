import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runGeneration } from "@/app/actions/generation";
import { getPresetModelConfig } from "@/lib/presets-server";
import type { Database } from "@/lib/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

interface OptionsSnapshot {
  ratio: string;
  background: string | null;
  isPrivate: boolean;
  pricing?: { full: number; discount: number; paid: number };
  uploadPaths: string[];
}

export type ConfirmResult =
  | { status: "paid"; kind: "print"; orderId: string }
  | { status: "paid"; kind: "generation"; generationId: string | null };

// Confirms a *paid* payment and runs its side effects exactly once. Shared by the
// client poll route, the QPay webhook, and the reconcile cron — all three can race
// the same payment, so every step here is idempotent:
//   * the payment is claimed with a conditional pending→success update; only the
//     winner runs the order/generation side effects,
//   * the order is flipped pending→paid (never clobbering completed/failed on a
//     late reconcile),
//   * an existing generation for the order is reused rather than duplicated.
// Generation kicks off via after(), so callers must be in a request scope.
export async function confirmPayment(
  payment: PaymentRow,
  paidAt: string,
): Promise<ConfirmResult> {
  const admin = createAdminClient();

  // Atomic claim — only the first confirmer flips the row and proceeds to create
  // the generation. A loser converges on the same generation below.
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "success", paid_at: paidAt })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  const isFirstConfirm = (claimed?.length ?? 0) > 0;

  await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", payment.order_id)
    .eq("status", "pending");

  const { data: rawOrder } = await admin
    .from("orders")
    .select("*")
    .eq("id", payment.order_id)
    .single();
  const order = rawOrder as unknown as OrderRow;

  // Print orders have no AI generation — an admin fulfils them manually.
  if (order.kind === "print" || !order.preset_id) {
    return { status: "paid", kind: "print", orderId: payment.order_id };
  }

  // Reuse the generation if one already exists for this order.
  const { data: existingGen } = await admin
    .from("generations")
    .select("id")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingGen) {
    return { status: "paid", kind: "generation", generationId: (existingGen as { id: string }).id };
  }

  // Not created yet. Only the claim winner creates + runs it; a loser that arrives
  // before the winner inserts returns null (the caller keeps polling / the cron
  // re-sweeps). This prevents a duplicate generation under concurrent confirmers.
  if (!isFirstConfirm) {
    return { status: "paid", kind: "generation", generationId: null };
  }

  const snapshot = order.options_snapshot as unknown as OptionsSnapshot;
  const pricing = snapshot.pricing ?? { full: order.amount_mnt, discount: 0, paid: order.amount_mnt };

  const { data: gen } = await admin
    .from("generations")
    .insert({
      order_id: order.id,
      user_id: payment.user_id,
      status: "queued" as const,
      progress: 0,
      queue_position: 1,
      full_price_mnt: pricing.full,
      discount_mnt: pricing.discount,
      paid_price_mnt: pricing.paid,
      shared_to_feed: !snapshot.isPrivate,
    })
    .select()
    .single();

  if (!gen) throw new Error("Failed to create generation");

  const { prompt: internalPrompt, model } = await getPresetModelConfig(order.preset_id);

  after(() =>
    runGeneration({
      generationId: gen.id,
      orderId: order.id,
      userId: payment.user_id,
      uploadPaths: snapshot.uploadPaths ?? [],
      internalPrompt,
      model,
      options: {
        ratio: snapshot.ratio,
        background: snapshot.background,
        isPrivate: snapshot.isPrivate,
      },
    }),
  );

  return { status: "paid", kind: "generation", generationId: gen.id };
}
