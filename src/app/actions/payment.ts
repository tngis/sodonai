"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFile, validateImageFile } from "@/lib/supabase/storage";
import { createInvoice, type QPayDeepLink } from "@/lib/qpay";
import type { Database } from "@/lib/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

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
