"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFile, validateImageFile, removeFiles, UPLOADS_BUCKET } from "@/lib/supabase/storage";
import { createInvoice, type QPayDeepLink } from "@/lib/qpay";
import { getPresetModelConfig } from "@/lib/presets-server";
import { debitWallet } from "@/lib/wallet-server";
import { runGeneration } from "@/app/actions/generation";
import type { Database } from "@/lib/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

export interface PaymentIntentResult {
  paymentId: string;
  orderId: string;
  qrImage: string;
  deepLinks: QPayDeepLink[];
}

export async function createPaymentIntent(formData: FormData): Promise<PaymentIntentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const presetId = formData.get("presetId") as string;
  const amountMnt = Number(formData.get("amountMnt"));
  const ratio = formData.get("ratio") as string;
  const background = (formData.get("background") as string) || null;
  const intensity = formData.has("intensity") ? Number(formData.get("intensity")) : null;
  const isPrivate = formData.get("isPrivate") !== "false";

  // Validate all files before starting any DB writes
  const files: File[] = [];
  let i = 0;
  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File;
    const err = validateImageFile(file);
    if (err) throw new Error(err);
    files.push(file);
    i++;
  }
  if (files.length === 0) throw new Error("Зураг оруулаагүй байна.");

  // Create order (status=pending) with placeholder uploadPaths
  const orderRes = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      preset_id: presetId,
      status: "pending" as const,
      amount_mnt: amountMnt,
      options_snapshot: { ratio, background, intensity, isPrivate, uploadPaths: [] as string[] },
    })
    .select()
    .single();

  const order = orderRes.data as OrderRow | null;
  if (orderRes.error || !order) {
    throw new Error(orderRes.error?.message ?? "Захиалга үүсгэхэд алдаа гарлаа.");
  }

  // Upload source images; if upload fails, delete the orphaned order before re-throwing
  let uploadPaths: string[];
  try {
    uploadPaths = await Promise.all(
      files.map((file, idx) => uploadFile(file, user.id, order.id, idx))
    );
  } catch (uploadErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw uploadErr;
  }

  const admin = createAdminClient();
  await admin
    .from("orders")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ options_snapshot: { ratio, background, intensity, isPrivate, uploadPaths } } as any)
    .eq("id", order.id);

  // Create QPay invoice (mock or real depending on QPAY_MOCK env var)
  const invoice = await createInvoice(
    order.id,
    amountMnt,
    `aistudio.mn — ${presetId}`
  );

  // Persist payment record
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

  return {
    paymentId: payment.id,
    orderId: order.id,
    qrImage: invoice.qrImage,
    deepLinks: invoice.deepLinks,
  };
}

export interface WalletPaymentResult {
  orderId: string;
  generationId: string;
}

// Pay for a generation from the user's wallet balance. Unlike the QPay path
// there's no external QR/polling — the debit settles synchronously, so we flip
// the order to paid and kick off generation right here. The debit is atomic and
// idempotent on the order id; an insufficient balance rolls everything back and
// throws a clear error (the UI normally prevents reaching this with too low a
// balance, this is the safety net).
export async function payWithWallet(formData: FormData): Promise<WalletPaymentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const presetId = formData.get("presetId") as string;
  const amountMnt = Number(formData.get("amountMnt"));
  const ratio = formData.get("ratio") as string;
  const background = (formData.get("background") as string) || null;
  const intensity = formData.has("intensity") ? Number(formData.get("intensity")) : null;
  const isPrivate = formData.get("isPrivate") !== "false";

  // Validate all files before any DB writes.
  const files: File[] = [];
  let i = 0;
  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File;
    const err = validateImageFile(file);
    if (err) throw new Error(err);
    files.push(file);
    i++;
  }
  if (files.length === 0) throw new Error("Зураг оруулаагүй байна.");

  // Resolve model/prompt up-front so a misconfigured preset fails before we
  // touch the wallet.
  const { prompt: internalPrompt, model } = await getPresetModelConfig(presetId);

  // Create order (status=pending) with placeholder uploadPaths.
  const orderRes = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      preset_id: presetId,
      status: "pending" as const,
      amount_mnt: amountMnt,
      options_snapshot: { ratio, background, intensity, isPrivate, uploadPaths: [] as string[] },
    })
    .select()
    .single();

  const order = orderRes.data as OrderRow | null;
  if (orderRes.error || !order) {
    throw new Error(orderRes.error?.message ?? "Захиалга үүсгэхэд алдаа гарлаа.");
  }

  // Upload source images; delete the orphaned order on failure.
  let uploadPaths: string[];
  try {
    uploadPaths = await Promise.all(
      files.map((file, idx) => uploadFile(file, user.id, order.id, idx))
    );
  } catch (uploadErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw uploadErr;
  }

  const admin = createAdminClient();
  await admin
    .from("orders")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ options_snapshot: { ratio, background, intensity, isPrivate, uploadPaths } } as any)
    .eq("id", order.id);

  // Debit the wallet atomically (idempotent on `spend:{orderId}`). If the
  // balance can't cover it, roll back the order + uploads.
  const debit = await debitWallet({
    userId: user.id,
    amountMnt,
    idempotencyKey: `spend:${order.id}`,
    orderId: order.id,
    note: `aistudio.mn — ${presetId}`,
  });

  if (!debit.ok) {
    // Nothing was charged and no generation/payment exists yet — roll the order
    // and its uploads back cleanly (admin: orders has no owner-delete policy).
    await admin.from("orders").delete().eq("id", order.id);
    await removeFiles(UPLOADS_BUCKET, uploadPaths);
    throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна.");
  }

  // Record the settled wallet payment and flip the order to paid. (The spend is
  // already tied to the order via the ledger row's order_id; refundForGeneration
  // finds this payment by order_id to refund a failed generation.)
  await admin.from("payments").insert({
    order_id: order.id,
    user_id: user.id,
    provider: "wallet" as const,
    status: "success" as const,
    amount_mnt: amountMnt,
    paid_at: new Date().toISOString(),
  });

  await admin.from("orders").update({ status: "paid" } as OrderUpdate).eq("id", order.id);

  // Create the queued generation and run it after the response is sent.
  const { data: gen } = await admin
    .from("generations")
    .insert({
      order_id: order.id,
      user_id: user.id,
      status: "queued" as const,
      progress: 0,
      queue_position: 1,
    })
    .select()
    .single();

  if (!gen) throw new Error("Боловсруулалт эхлүүлэхэд алдаа гарлаа.");

  after(() =>
    runGeneration({
      generationId: gen.id,
      orderId: order.id,
      userId: user.id,
      uploadPaths,
      internalPrompt,
      model,
      options: { ratio, background, intensity, isPrivate },
    })
  );

  return { orderId: order.id, generationId: gen.id };
}
