"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvoice, type QPayDeepLink } from "@/lib/qpay";
import { isValidTopUpAmount } from "@/lib/wallet";
import type { Database, WalletTxnType } from "@/lib/supabase/types";

type TopUpRow = Database["public"]["Tables"]["wallet_topups"]["Row"];

export interface WalletTransaction {
  id: string;
  amountMnt: number;
  balanceAfter: number;
  type: WalletTxnType;
  note: string | null;
  createdAt: string;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return { supabase, user };
}

/** Current wallet balance in ₮ (0 if no wallet row yet). */
export async function getWalletBalance(): Promise<number> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("wallets")
    .select("balance_mnt")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as { balance_mnt: number } | null)?.balance_mnt ?? 0;
}

/** Recent ledger entries, newest first, for the wallet history list. */
export async function getWalletTransactions(limit = 50): Promise<WalletTransaction[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("wallet_transactions")
    .select("id, amount_mnt, balance_after, type, note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Row = Pick<
    Database["public"]["Tables"]["wallet_transactions"]["Row"],
    "id" | "amount_mnt" | "balance_after" | "type" | "note" | "created_at"
  >;

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    amountMnt: r.amount_mnt,
    balanceAfter: r.balance_after,
    type: r.type,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export interface TopUpIntentResult {
  topUpId: string;
  amountMnt: number;
  qrImage: string;
  deepLinks: QPayDeepLink[];
}

// Start a wallet top-up: create a pending wallet_topups row and a QPay invoice.
// The client polls /api/wallet/topup/{id}; on confirmation the wallet is
// credited. (Reuses the same QPay machinery as order payment — the only
// difference is the "fulfillment" credits the wallet instead of generating.)
export async function createTopUpIntent(amountMnt: number): Promise<TopUpIntentResult> {
  const { supabase, user } = await requireUser();
  if (!isValidTopUpAmount(amountMnt)) throw new Error("Цэнэглэх дүн буруу байна.");

  const { data: topup, error } = await supabase
    .from("wallet_topups")
    .insert({ user_id: user.id, amount_mnt: amountMnt, status: "pending" })
    .select()
    .single();

  const row = topup as TopUpRow | null;
  if (error || !row) throw new Error(error?.message ?? "Цэнэглэлт үүсгэхэд алдаа гарлаа.");

  const invoice = await createInvoice(row.id, amountMnt, "aistudio.mn — Хэтэвч цэнэглэлт");

  const admin = createAdminClient();
  await admin
    .from("wallet_topups")
    .update({ qpay_invoice_id: invoice.invoiceId })
    .eq("id", row.id);

  return {
    topUpId: row.id,
    amountMnt,
    qrImage: invoice.qrImage,
    deepLinks: invoice.deepLinks,
  };
}
