import "server-only";

import { after } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  uploadFile,
  validateImageFile,
  removeFiles,
  UPLOADS_BUCKET,
} from "@/lib/supabase/storage";
import { createInvoice, type QPayDeepLink } from "@/lib/qpay";
import { getPresetModelConfig, getPresetPricing } from "@/lib/presets-server";
import { computeShareDiscount } from "@/lib/pricing";
import { debitWallet } from "@/lib/wallet-server";
import { runGeneration } from "@/app/actions/generation";
import type { Database } from "@/lib/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

// Auth is resolved by the caller (cookie session via the server action, or a
// Bearer token via the mobile API route) and the resulting RLS-scoped client +
// user are injected here. Keeping the core auth-agnostic lets both transports
// share one implementation of the order/payment writes.
interface CoreArgs {
  supabase: SupabaseClient<Database>;
  user: User;
  formData: FormData;
}

export interface PaymentIntentResult {
  paymentId: string;
  orderId: string;
  qrImage: string;
  deepLinks: QPayDeepLink[];
}

export interface WalletPaymentResult {
  orderId: string;
  generationId: string;
}

export interface ResumePaymentResult {
  paymentId: string;
  qrImage: string;
  deepLinks: QPayDeepLink[];
}

// Collect + validate file_0..file_n from the multipart form (throws on the first
// invalid file, matching the web validation).
function collectFiles(formData: FormData): File[] {
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
  return files;
}

// Create a pending order, upload its source images, and issue a QPay invoice.
// The client then polls /api/payment/[id] to confirm + kick off generation.
export async function createPaymentIntentCore({
  supabase,
  user,
  formData,
}: CoreArgs): Promise<PaymentIntentResult> {
  const presetId = formData.get("presetId") as string;
  const ratio = formData.get("ratio") as string;
  const background = (formData.get("background") as string) || null;
  const isPrivate = formData.get("isPrivate") !== "false";

  // Price the order server-side from the preset (never trust a client amount):
  // sharing to the public feed earns the preset's discount. Snapshot the result
  // so un-share can replay it even if the preset's price/percent changes later.
  const { priceMnt, discountPct } = await getPresetPricing(presetId);
  const pricing = computeShareDiscount(priceMnt, discountPct, !isPrivate);
  const amountMnt = pricing.paid;

  const files = collectFiles(formData);

  // Create order (status=pending) with placeholder uploadPaths
  const orderRes = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      preset_id: presetId,
      status: "pending" as const,
      amount_mnt: amountMnt,
      options_snapshot: { ratio, background, isPrivate, pricing: { full: pricing.full, discount: pricing.discount, paid: pricing.paid }, uploadPaths: [] as string[] },
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
    .update({ options_snapshot: { ratio, background, isPrivate, pricing, uploadPaths } } as any)
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

// Pay for a generation from the user's wallet balance. The debit settles
// synchronously (no QR/polling) — flip the order to paid and kick off generation
// after the response. Insufficient balance rolls everything back and throws.
export async function payWithWalletCore({
  supabase,
  user,
  formData,
}: CoreArgs): Promise<WalletPaymentResult> {
  const presetId = formData.get("presetId") as string;
  const ratio = formData.get("ratio") as string;
  const background = (formData.get("background") as string) || null;
  const isPrivate = formData.get("isPrivate") !== "false";

  // Price the order server-side (see createPaymentIntentCore) and snapshot it.
  const { priceMnt, discountPct } = await getPresetPricing(presetId);
  const pricing = computeShareDiscount(priceMnt, discountPct, !isPrivate);
  const amountMnt = pricing.paid;

  const files = collectFiles(formData);

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
      options_snapshot: { ratio, background, isPrivate, pricing: { full: pricing.full, discount: pricing.discount, paid: pricing.paid }, uploadPaths: [] as string[] },
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
    .update({ options_snapshot: { ratio, background, isPrivate, pricing, uploadPaths } } as any)
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
    await admin.from("orders").delete().eq("id", order.id);
    await removeFiles(UPLOADS_BUCKET, uploadPaths);
    throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна.");
  }

  // Record the settled wallet payment and flip the order to paid.
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
      full_price_mnt: pricing.full,
      discount_mnt: pricing.discount,
      paid_price_mnt: pricing.paid,
      shared_to_feed: !isPrivate,
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
      options: { ratio, background, isPrivate },
    })
  );

  return { orderId: order.id, generationId: gen.id };
}

// Re-issue the QPay QR for a still-pending order so the user can finish paying.
// Reuses the existing order + payment row; re-creates the invoice and points the
// payment at it. The poll/webhook/cron all key off payments.qpay_invoice_id.
export async function resumePaymentCore({
  supabase,
  user,
  orderId,
}: {
  supabase: SupabaseClient<Database>;
  user: User;
  orderId: string;
}): Promise<ResumePaymentResult> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, amount_mnt, preset_id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();
  if (!order) throw new Error("Захиалга олдсонгүй.");
  if (order.status !== "pending") throw new Error("Энэ захиалга төлбөр хүлээгээгүй байна.");

  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment) throw new Error("Төлбөрийн мэдээлэл олдсонгүй.");

  const invoice = await createInvoice(
    order.id,
    order.amount_mnt,
    `aistudio.mn — ${order.preset_id ?? "хэвлэл"}`,
  );

  // payments has no owner-update RLS policy → point the row at the (possibly new)
  // invoice id via the admin client.
  const admin = createAdminClient();
  await admin.from("payments").update({ qpay_invoice_id: invoice.invoiceId }).eq("id", payment.id);

  return { paymentId: payment.id, qrImage: invoice.qrImage, deepLinks: invoice.deepLinks };
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

// Settle a still-pending order from the wallet (the /orders resume flow's wallet
// option). Debit → mark the abandoned QPay invoice failed → record the wallet
// payment → flip the order to paid → (for generation orders) queue and run it.
// Auth-agnostic: shared by the payPendingWithWallet server action (cookie) and
// the /api/orders/pay-wallet route (Bearer).
export async function payPendingWithWalletCore({
  supabase,
  user,
  orderId,
}: {
  supabase: SupabaseClient<Database>;
  user: User;
  orderId: string;
}): Promise<ResumeWalletResult> {
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

  // Atomically claim the order (pending→paid) BEFORE touching the wallet. If no
  // row comes back, another path (QPay poll/webhook/cron) already settled this
  // order — bail out without debiting so we never double-charge QPay + wallet.
  // (The status check above is only a fast pre-check; this is the real guard.)
  const { data: claimed } = await admin
    .from("orders")
    .update({ status: "paid" } as OrderUpdate)
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) throw new Error("Энэ захиалга аль хэдийн төлөгдсөн байна.");

  // Debit the wallet atomically (idempotent on the order id). If the balance is
  // short, compensate by reverting our claim so QPay can still settle the order.
  const debit = await debitWallet({
    userId: user.id,
    amountMnt: order.amount_mnt,
    idempotencyKey: `spend:${order.id}`,
    orderId: order.id,
    note: `aistudio.mn — ${order.preset_id ?? "хэвлэл"}`,
  });
  if (!debit.ok) {
    await admin
      .from("orders")
      .update({ status: "pending" } as OrderUpdate)
      .eq("id", order.id)
      .eq("status", "paid");
    throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна.");
  }

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
