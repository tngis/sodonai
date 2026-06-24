import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvoice, type QPayDeepLink } from "@/lib/qpay";
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
