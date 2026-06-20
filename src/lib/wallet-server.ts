import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Server-only wallet money movements. Thin wrappers over the SECURITY DEFINER
// SQL functions (wallet_credit / wallet_debit), which are atomic (row lock),
// idempotent (idempotency_key), and guard against a negative balance. Always
// called through the service-role/admin client — the functions are revoked
// from the anon/authenticated roles.

export interface DebitResult {
  ok: boolean;
  /** New balance after the debit (when ok). */
  balance?: number;
  /** Set when the debit was rejected because the balance was too low. */
  reason?: "insufficient";
}

export async function debitWallet(params: {
  userId: string;
  amountMnt: number;
  type?: "spend" | "adjustment";
  idempotencyKey: string;
  orderId?: string | null;
  paymentId?: string | null;
  note?: string | null;
}): Promise<DebitResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("wallet_debit", {
    p_user: params.userId,
    p_amount: params.amountMnt,
    p_type: params.type ?? "spend",
    p_idempotency_key: params.idempotencyKey,
    p_order: params.orderId ?? null,
    p_payment: params.paymentId ?? null,
    p_note: params.note ?? null,
  });

  if (error) {
    // The SQL function raises 'insufficient_funds' (SQLSTATE P0001) when the
    // balance can't cover the debit — surface it as a typed reason, not a throw.
    if (error.message?.includes("insufficient_funds")) {
      return { ok: false, reason: "insufficient" };
    }
    throw new Error(error.message);
  }

  return { ok: true, balance: data as number };
}

export async function creditWallet(params: {
  userId: string;
  amountMnt: number;
  type: "topup" | "refund" | "adjustment";
  idempotencyKey: string;
  orderId?: string | null;
  paymentId?: string | null;
  note?: string | null;
}): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("wallet_credit", {
    p_user: params.userId,
    p_amount: params.amountMnt,
    p_type: params.type,
    p_idempotency_key: params.idempotencyKey,
    p_order: params.orderId ?? null,
    p_payment: params.paymentId ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw new Error(error.message);
  return data as number;
}

// Refund a paid order's amount back to the user's wallet after a failed
// generation. Idempotent per generation (key `refund:{generationId}`). Refunds
// happen to the wallet regardless of the original method (instant, no QPay
// refund API needed). Only refunds when a SUCCESSFUL payment exists for the
// order — the submitOrder/no-pay path has none, so it's correctly skipped.
export async function refundForGeneration(params: {
  userId: string;
  orderId: string;
  generationId: string;
  /** Retry counter — keys the refund per attempt so each failed run refunds once. */
  attempt?: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, amount_mnt")
    .eq("order_id", params.orderId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) return; // nothing was actually paid → nothing to refund
  const { id: paymentId, amount_mnt: amount } = payment as { id: string; amount_mnt: number };
  if (!amount || amount <= 0) return;

  await creditWallet({
    userId: params.userId,
    amountMnt: amount,
    type: "refund",
    idempotencyKey: `refund:${params.generationId}:${params.attempt ?? 0}`,
    orderId: params.orderId,
    paymentId,
    note: "Амжилтгүй болсон үүсгэлтийн буцаалт",
  });
}

// Reverses the refund of a previously-failed generation when an admin re-runs it,
// so a retry that ultimately succeeds is still paid for (charged iff a result was
// delivered). Mirrors refundForGeneration: only re-charges when an actual payment
// existed, and is idempotent per (generation, attempt). Returns the debit result —
// `ok:false` means the user already spent the refunded balance, so the caller
// should block the retry to keep the ledger consistent.
export async function rechargeForRetry(params: {
  userId: string;
  orderId: string;
  generationId: string;
  /** The attempt being reversed (the failed run's attempt number). */
  attempt: number;
}): Promise<DebitResult> {
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, amount_mnt")
    .eq("order_id", params.orderId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) return { ok: true }; // free (no-pay) path — no refund to reverse
  const { id: paymentId, amount_mnt: amount } = payment as { id: string; amount_mnt: number };
  if (!amount || amount <= 0) return { ok: true };

  return debitWallet({
    userId: params.userId,
    amountMnt: amount,
    type: "adjustment",
    idempotencyKey: `recharge:${params.generationId}:${params.attempt}`,
    orderId: params.orderId,
    paymentId,
    note: "Дахин оролдлогын төлбөр (буцаалт сэргээв)",
  });
}
