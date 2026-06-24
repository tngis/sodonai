"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPresetModelConfig } from "@/lib/presets-server";
import { debitWallet } from "@/lib/wallet-server";
import { runGeneration } from "@/app/actions/generation";
import {
  createPaymentIntentCore,
  payWithWalletCore,
  resumePaymentCore,
  type PaymentIntentResult,
  type WalletPaymentResult,
  type ResumePaymentResult,
} from "@/lib/payments/intent";
import type { Database } from "@/lib/supabase/types";

export type { PaymentIntentResult, WalletPaymentResult, ResumePaymentResult };

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

// Thin cookie-auth wrapper around the shared core (the mobile path authenticates
// via Bearer in src/app/api/payment/route.ts and calls the same core).
export async function createPaymentIntent(formData: FormData): Promise<PaymentIntentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return createPaymentIntentCore({ supabase, user, formData });
}

// Re-issue the QPay QR for a still-pending order so the user can finish paying
// from /orders. Thin cookie-auth wrapper around the shared core (mobile uses
// Bearer via src/app/api/orders/resume/route.ts).
export async function resumePayment(orderId: string): Promise<ResumePaymentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return resumePaymentCore({ supabase, user, orderId });
}

interface PendingSnapshot {
  ratio: string;
  background: string | null;
  isPrivate: boolean;
  pricing?: { full: number; discount: number; paid: number };
  uploadPaths: string[];
}

export interface ResumeWalletResult {
  orderId: string;
  kind: "print" | "generation";
  generationId: string | null;
}

// Pay an existing *pending* order from the wallet (the /orders resume flow's
// wallet option). Settles synchronously like payWithWallet: debit → mark the
// abandoned QPay invoice failed → record the wallet payment → flip the order to
// paid → (for generation orders) queue and run it.
export async function payPendingWithWallet(orderId: string): Promise<ResumeWalletResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const { data: orderRow } = await supabase
    .from("orders")
    .select("id, status, amount_mnt, preset_id, kind, options_snapshot")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();
  const order = orderRow as Pick<
    OrderRow,
    "id" | "status" | "amount_mnt" | "preset_id" | "kind" | "options_snapshot"
  > | null;
  if (!order) throw new Error("Захиалга олдсонгүй.");
  if (order.status !== "pending") throw new Error("Энэ захиалга төлбөр хүлээгээгүй байна.");

  const admin = createAdminClient();

  // Debit the wallet atomically (idempotent on the order id). Insufficient → throw.
  const debit = await debitWallet({
    userId: user.id,
    amountMnt: order.amount_mnt,
    idempotencyKey: `spend:${order.id}`,
    orderId: order.id,
    note: `aistudio.mn — ${order.preset_id ?? "хэвлэл"}`,
  });
  if (!debit.ok) throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна.");

  // Cancel the abandoned QPay invoice(s) so the poll/webhook/cron can't later
  // double-charge this order.
  await admin
    .from("payments")
    .update({ status: "failed" })
    .eq("order_id", order.id)
    .eq("status", "pending");

  // Record the settled wallet payment — refundForGeneration finds this by order_id.
  await admin.from("payments").insert({
    order_id: order.id,
    user_id: user.id,
    provider: "wallet" as const,
    status: "success" as const,
    amount_mnt: order.amount_mnt,
    paid_at: new Date().toISOString(),
  });

  await admin
    .from("orders")
    .update({ status: "paid" } as OrderUpdate)
    .eq("id", order.id)
    .eq("status", "pending");

  // Print orders have no AI generation — fulfilled manually by an admin.
  if (order.kind === "print" || !order.preset_id) {
    return { orderId: order.id, kind: "print", generationId: null };
  }

  // Reuse an existing generation if any; otherwise create + run it.
  const { data: existing } = await admin
    .from("generations")
    .select("id")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { orderId: order.id, kind: "generation", generationId: (existing as { id: string }).id };
  }

  const snapshot = (order.options_snapshot ?? {}) as unknown as PendingSnapshot;
  const pricing = snapshot.pricing ?? { full: order.amount_mnt, discount: 0, paid: order.amount_mnt };

  const { data: gen } = await admin
    .from("generations")
    .insert({
      order_id: order.id,
      user_id: user.id,
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
  if (!gen) throw new Error("Боловсруулалт эхлүүлэхэд алдаа гарлаа.");

  const { prompt: internalPrompt, model } = await getPresetModelConfig(order.preset_id);

  after(() =>
    runGeneration({
      generationId: gen.id,
      orderId: order.id,
      userId: user.id,
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

  return { orderId: order.id, kind: "generation", generationId: gen.id };
}

// Thin cookie-auth wrapper around the shared core (see createPaymentIntent).
export async function payWithWallet(formData: FormData): Promise<WalletPaymentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return payWithWalletCore({ supabase, user, formData });
}
