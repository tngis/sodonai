"use server";

import { createClient } from "@/lib/supabase/server";
import { createTopUpIntentCore, type TopUpIntentResult } from "@/lib/payments/topup";
import type { Database, WalletTxnType } from "@/lib/supabase/types";

export type { TopUpIntentResult };

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

// Thin cookie-auth wrapper around the shared core (the mobile path authenticates
// via Bearer in src/app/api/wallet/topup/route.ts and calls the same core).
export async function createTopUpIntent(amountMnt: number): Promise<TopUpIntentResult> {
  const { supabase, user } = await requireUser();
  return createTopUpIntentCore({ supabase, user, amountMnt });
}
