import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvoice, checkPayment, type QPayDeepLink } from "@/lib/qpay";
import { creditWallet } from "@/lib/wallet-server";
import { isValidTopUpAmount } from "@/lib/wallet";
import type { Database } from "@/lib/supabase/types";

type TopUpRow = Database["public"]["Tables"]["wallet_topups"]["Row"];

export interface TopUpIntentResult {
  topUpId: string;
  amountMnt: number;
  qrImage: string;
  deepLinks: QPayDeepLink[];
}

// Shared core for starting a wallet top-up: create a pending wallet_topups row +
// a QPay invoice. Auth (cookie session or Bearer) is resolved by the caller. The
// client then polls /api/wallet/topup/[id] to credit the wallet on confirmation.
export async function createTopUpIntentCore({
  supabase,
  user,
  amountMnt,
}: {
  supabase: SupabaseClient<Database>;
  user: User;
  amountMnt: number;
}): Promise<TopUpIntentResult> {
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

export interface ConfirmTopUpResult {
  status: "credited" | "pending";
  balance?: number;
}

// Confirms a paid wallet top-up and credits the wallet exactly once. Shared by
// the client poll route, the QPay webhook, and the reconcile cron — all three can
// race the same top-up, so every step is idempotent:
//   * the wallet credit is keyed on `topup:{id}` (creditWallet no-ops on replay),
//   * credit happens BEFORE the status flip, so a crash in between can't strand a
//     paid-but-uncredited top-up; a later confirmer re-credits as a no-op.
// Uses the admin client + the row's own user_id throughout, so it works without a
// caller session (cron/webhook). Returns the fresh balance when credited.
export async function confirmTopUp(topup: TopUpRow): Promise<ConfirmTopUpResult> {
  const admin = createAdminClient();

  // Already credited in a previous poll/webhook/cron.
  if (topup.status === "success") {
    const { data: w } = await admin
      .from("wallets")
      .select("balance_mnt")
      .eq("user_id", topup.user_id)
      .maybeSingle();
    return {
      status: "credited",
      balance: (w as { balance_mnt: number } | null)?.balance_mnt ?? 0,
    };
  }

  const result = await checkPayment(topup.qpay_invoice_id ?? "", topup.created_at);
  if (!result.paid) return { status: "pending" };

  const balance = await creditWallet({
    userId: topup.user_id,
    amountMnt: topup.amount_mnt,
    type: "topup",
    idempotencyKey: `topup:${topup.id}`,
    note: "QPay цэнэглэлт",
  });

  await admin
    .from("wallet_topups")
    .update({ status: "success", credited_at: result.paidAt ?? new Date().toISOString() })
    .eq("id", topup.id);

  console.log(JSON.stringify({
    event: "wallet.topup.credited", topUpId: topup.id, amount: topup.amount_mnt, ts: new Date().toISOString(),
  }));

  return { status: "credited", balance };
}
