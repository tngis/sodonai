import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvoice } from "@/lib/qpay";
import { priceFor, findFrame, findSize } from "@/lib/print-catalog";
import { debitWallet } from "@/lib/wallet-server";
import { notify } from "@/lib/notify";
import { formatAddress } from "@/lib/address";
import type { PaymentIntentResult } from "@/lib/payments/intent";
import type { Database } from "@/lib/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

export interface PrintIntentInput {
  assetStoragePath: string;
  frameId: string;
  sizeId: string;
  addressId: string;
}

export interface PrintWalletResult {
  orderId: string;
}

interface CoreArgs {
  supabase: SupabaseClient<Database>;
  user: User;
  input: PrintIntentInput;
}

// Shared setup for both print payment paths: validate frame/size, recompute the
// price server-side, verify the chosen asset belongs to the user, snapshot the
// delivery address, and create the order + print_orders rows. Returns the order
// id, the recomputed amount, and the size label (for the invoice description).
async function prepPrintOrder({
  supabase,
  user,
  input,
}: CoreArgs): Promise<{ orderId: string; amountMnt: number; sizeLabel: string }> {
  const frame = findFrame(input.frameId);
  const size = findSize(input.sizeId);
  if (!frame || !size) throw new Error("Жааз эсвэл хэмжээ буруу байна.");

  // Recompute price server-side — never trust a client-supplied amount.
  const amountMnt = priceFor(input.sizeId, input.frameId);

  // Verify the selected image really belongs to this user (it lives in assets).
  const { data: asset } = await supabase
    .from("assets")
    .select("id")
    .eq("user_id", user.id)
    .eq("storage_path", input.assetStoragePath)
    .limit(1)
    .maybeSingle();
  if (!asset) throw new Error("Сонгосон зураг олдсонгүй.");

  // Load the delivery address (owner-scoped) and snapshot it.
  const { data: addr } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", input.addressId)
    .eq("user_id", user.id)
    .single();
  const address = addr as AddressRow | null;
  if (!address) throw new Error("Хүргэлтийн хаяг олдсонгүй.");

  const orderRes = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      kind: "print" as const,
      status: "pending" as const,
      amount_mnt: amountMnt,
      options_snapshot: { frameId: input.frameId, sizeId: input.sizeId },
    })
    .select()
    .single();

  const order = orderRes.data as OrderRow | null;
  if (orderRes.error || !order) {
    throw new Error(orderRes.error?.message ?? "Захиалга үүсгэхэд алдаа гарлаа.");
  }

  // Print-specific detail with an immutable address snapshot.
  const printRes = await supabase.from("print_orders").insert({
    order_id: order.id,
    user_id: user.id,
    asset_storage_path: input.assetStoragePath,
    frame_id: input.frameId,
    size_id: input.sizeId,
    ship_recipient: address.recipient,
    ship_phone: address.phone,
    ship_address: formatAddress(address),
  });
  if (printRes.error) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error(printRes.error.message);
  }

  return { orderId: order.id, amountMnt, sizeLabel: size.label };
}

// QPay print payment: create the order + a QPay invoice; the client polls
// /api/payment/[id] (a print order has no AI step — an admin fulfils it).
export async function createPrintIntentCore(args: CoreArgs): Promise<PaymentIntentResult> {
  const { supabase, user, input } = args;
  const { orderId, amountMnt, sizeLabel } = await prepPrintOrder(args);

  const invoice = await createInvoice(orderId, amountMnt, `aistudio.mn — Хэвлэл ${sizeLabel}`);

  const paymentRes = await supabase
    .from("payments")
    .insert({
      order_id: orderId,
      user_id: user.id,
      provider: "qpay" as const,
      qpay_invoice_id: invoice.invoiceId,
      status: "pending" as const,
      amount_mnt: amountMnt,
    })
    .select()
    .single();

  const payment = paymentRes.data as PaymentRow | null;
  if (paymentRes.error || !payment) {
    throw new Error(paymentRes.error?.message ?? "Төлбөр үүсгэхэд алдаа гарлаа.");
  }

  await notify("print.order.created", {
    orderId,
    userId: user.id,
    amountMnt,
    frameId: input.frameId,
    sizeId: input.sizeId,
  });

  return {
    paymentId: payment.id,
    orderId,
    qrImage: invoice.qrImage,
    deepLinks: invoice.deepLinks,
  };
}

// Wallet print payment: settle the debit synchronously and flip the order to
// paid (no AI step). Insufficient balance rolls the order back and throws.
export async function payPrintWithWalletCore(args: CoreArgs): Promise<PrintWalletResult> {
  const { user, input } = args;
  const { orderId, amountMnt, sizeLabel } = await prepPrintOrder(args);
  const admin = createAdminClient();

  const debit = await debitWallet({
    userId: user.id,
    amountMnt,
    idempotencyKey: `spend:${orderId}`,
    orderId,
    note: `aistudio.mn — Хэвлэл ${sizeLabel}`,
  });
  if (!debit.ok) {
    await admin.from("orders").delete().eq("id", orderId);
    throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна.");
  }

  await admin.from("payments").insert({
    order_id: orderId,
    user_id: user.id,
    provider: "wallet" as const,
    status: "success" as const,
    amount_mnt: amountMnt,
    paid_at: new Date().toISOString(),
  });

  await admin.from("orders").update({ status: "paid" } as OrderUpdate).eq("id", orderId);

  await notify("print.order.created", {
    orderId,
    userId: user.id,
    amountMnt,
    frameId: input.frameId,
    sizeId: input.sizeId,
  });

  return { orderId };
}
