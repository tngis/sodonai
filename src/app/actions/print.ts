"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvoice } from "@/lib/qpay";
import { priceFor, findFrame, findSize } from "@/lib/print-catalog";
import { debitWallet } from "@/lib/wallet-server";
import { notify } from "@/lib/notify";
import { formatAddress } from "@/lib/address";
import type { PaymentIntentResult } from "@/app/actions/payment";
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

export async function createPrintIntent(input: PrintIntentInput): Promise<PaymentIntentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

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

  // Create the order (print kind, no preset)
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

  // Print-specific detail with an immutable address snapshot
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

  // QPay invoice (mock or real per QPAY_MOCK)
  const invoice = await createInvoice(order.id, amountMnt, `aistudio.mn — Хэвлэл ${size.label}`);

  const paymentRes = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
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
    orderId: order.id,
    userId: user.id,
    amountMnt,
    frameId: input.frameId,
    sizeId: input.sizeId,
  });

  return {
    paymentId: payment.id,
    orderId: order.id,
    qrImage: invoice.qrImage,
    deepLinks: invoice.deepLinks,
  };
}

export interface PrintWalletResult {
  orderId: string;
}

// Pay for a print order from the user's wallet balance. Like payWithWallet for
// generations, but print has no AI step — an admin fulfils it manually — so we
// just settle the debit, record the wallet payment, flip the order to paid, and
// notify. The debit is atomic and idempotent on the order id; an insufficient
// balance rolls the order (and its cascaded print_orders row) back and throws a
// clear message (the UI normally blocks this; it's the safety net).
export async function payPrintWithWallet(input: PrintIntentInput): Promise<PrintWalletResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

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

  // Create the order (print kind, no preset)
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

  // Print-specific detail with an immutable address snapshot
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

  const admin = createAdminClient();

  // Debit the wallet atomically (idempotent on `spend:{orderId}`). If the
  // balance can't cover it, roll the order back — print_orders cascades on the
  // order delete (see migration 0010).
  const debit = await debitWallet({
    userId: user.id,
    amountMnt,
    idempotencyKey: `spend:${order.id}`,
    orderId: order.id,
    note: `aistudio.mn — Хэвлэл ${size.label}`,
  });

  if (!debit.ok) {
    await admin.from("orders").delete().eq("id", order.id);
    throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна.");
  }

  // Record the settled wallet payment and flip the order to paid. Admin fulfils
  // the physical print from here — there is no generation step.
  await admin.from("payments").insert({
    order_id: order.id,
    user_id: user.id,
    provider: "wallet" as const,
    status: "success" as const,
    amount_mnt: amountMnt,
    paid_at: new Date().toISOString(),
  });

  await admin.from("orders").update({ status: "paid" } as OrderUpdate).eq("id", order.id);

  await notify("print.order.created", {
    orderId: order.id,
    userId: user.id,
    amountMnt,
    frameId: input.frameId,
    sizeId: input.sizeId,
  });

  return { orderId: order.id };
}
