"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2, EXAMPLES_BUCKET, publicUrl } from "@/lib/r2/client";
import { assertCapability } from "@/lib/auth-admin";
import { notify } from "@/lib/notify";
import { sendSms } from "@/lib/sms";
import type {
  Database,
  Json,
  SuggestionKind,
  PrintProductionStatus,
  PrintDeliveryStatus,
  UserRole,
} from "@/lib/supabase/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface CategoryInput {
  id: string;
  name_mn: string;
  name_en: string;
  description_mn: string;
  description_en: string;
  icon: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PresetInput {
  id: string;
  category_id: string;
  name_mn: string;
  name_en: string;
  description_mn: string;
  description_en: string;
  output_ratio: string;
  steps: number;
  price_mnt: number;
  public_discount_pct: number;
  eta_min: string;
  warnings_mn: string[];
  internal_prompt: string;
  ai_model: string | null;
  example_output: string;
  example_before: string | null;
  example_type: string;
  example_inputs: string[];
  options: Json | null;
  required_min: number;
  required_max: number;
  sort_order: number;
  is_active: boolean;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/presets");
}

// ─── Categories ──────────────────────────────────────────────
export async function createCategory(input: CategoryInput): Promise<void> {
  await assertCapability("catalog");
  if (!input.id.trim()) throw new Error("ID хоосон байж болохгүй.");
  const admin = createAdminClient();
  const { error } = await admin.from("categories").insert(input);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function updateCategory(id: string, input: Omit<CategoryInput, "id">): Promise<void> {
  await assertCapability("catalog");
  const admin = createAdminClient();
  const { error } = await admin.from("categories").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function deleteCategory(id: string): Promise<void> {
  await assertCapability("catalog");
  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

// ─── Presets ─────────────────────────────────────────────────
export async function createPreset(input: PresetInput): Promise<void> {
  await assertCapability("catalog");
  if (!input.id.trim()) throw new Error("ID хоосон байж болохгүй.");
  if (!input.category_id) throw new Error("Ангилал сонгоно уу.");
  const admin = createAdminClient();
  const { error } = await admin.from("presets").insert(input);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function updatePreset(id: string, input: Omit<PresetInput, "id">): Promise<void> {
  await assertCapability("catalog");
  const admin = createAdminClient();
  const { error } = await admin.from("presets").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function deletePreset(id: string): Promise<void> {
  await assertCapability("catalog");
  const admin = createAdminClient();
  const { error } = await admin.from("presets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

// ─── Drag & drop reordering ──────────────────────────────────
// Persists a new sort_order for the affected rows. The client sends only the
// rows whose position actually changed, each with its new zero-based index.
export async function reorderCategories(updates: { id: string; sort_order: number }[]): Promise<void> {
  await assertCapability("catalog");
  if (updates.length === 0) return;
  const admin = createAdminClient();
  const results = await Promise.all(
    updates.map((u) => admin.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidateAdmin();
}

export async function reorderPresets(updates: { id: string; sort_order: number }[]): Promise<void> {
  await assertCapability("catalog");
  if (updates.length === 0) return;
  const admin = createAdminClient();
  const results = await Promise.all(
    updates.map((u) => admin.from("presets").update({ sort_order: u.sort_order }).eq("id", u.id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidateAdmin();
}

// ─── Saved quick-select options ──────────────────────────────
export async function addOptionSuggestion(kind: SuggestionKind, value: string): Promise<void> {
  await assertCapability("catalog");
  const v = value.trim();
  if (!v) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("option_suggestions")
    .upsert({ kind, value: v }, { onConflict: "kind,value", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function deleteOptionSuggestion(kind: SuggestionKind, value: string): Promise<void> {
  await assertCapability("catalog");
  const admin = createAdminClient();
  const { error } = await admin
    .from("option_suggestions")
    .delete()
    .eq("kind", kind)
    .eq("value", value);
  if (error) throw new Error(error.message);
}

// ─── Print order fulfillment ─────────────────────────────────
export interface PrintFulfillmentInput {
  production_status: PrintProductionStatus;
  delivery_status: PrintDeliveryStatus;
  admin_note: string | null;
}

// Customer SMS copy per new status (phrase includes its own punctuation). Only
// forward-meaningful stages notify; reverting to "pending" sends nothing.
const PRODUCTION_SMS: Partial<Record<PrintProductionStatus, string>> = {
  printing: "хэвлэгдэж эхэллээ.",
  framing: "жаазлагдаж байна.",
  ready: "бэлэн боллоо.",
};
const DELIVERY_SMS: Partial<Record<PrintDeliveryStatus, string>> = {
  shipping: "хүргэлтэд гарлаа.",
  delivered: "амжилттай хүргэгдлээ. Баярлалаа!",
};

export async function updatePrintFulfillment(
  printOrderId: string,
  input: PrintFulfillmentInput
): Promise<void> {
  const staff = await assertCapability("orders");

  // Delivery can't run ahead of production: an item must be produced
  // (production = "ready") before it can be shipped or delivered. Blocks
  // inconsistent states like "production pending + delivered".
  if (input.delivery_status !== "pending" && input.production_status !== "ready") {
    throw new Error("Хүргэлт эхлэхээс өмнө үйлдвэрлэл 'Бэлэн' байх ёстой.");
  }

  const admin = createAdminClient();

  // Read current values: detect real changes (audit + notify) and get the
  // recipient's phone for the SMS.
  const { data: before } = await admin
    .from("print_orders")
    .select("order_id, production_status, delivery_status, admin_note, ship_phone")
    .eq("id", printOrderId)
    .single();

  const nextNote = input.admin_note?.trim() || null;

  const { error } = await admin
    .from("print_orders")
    .update({
      production_status: input.production_status,
      delivery_status: input.delivery_status,
      admin_note: nextNote,
    })
    .eq("id", printOrderId);
  if (error) throw new Error(error.message);

  const prev = before as {
    order_id: string;
    production_status: PrintProductionStatus;
    delivery_status: PrintDeliveryStatus;
    admin_note: string | null;
    ship_phone: string;
  } | null;
  if (!prev) {
    revalidatePath("/admin/orders");
    return;
  }

  const productionChanged = prev.production_status !== input.production_status;
  const deliveryChanged = prev.delivery_status !== input.delivery_status;
  const noteChanged = (prev.admin_note?.trim() || null) !== nextNote;

  // Audit log — who changed what, before→after.
  const events: Database["public"]["Tables"]["print_order_events"]["Insert"][] = [];
  const event = (field: "production" | "delivery" | "note", from: string | null, to: string | null) => ({
    print_order_id: printOrderId,
    order_id: prev.order_id,
    actor_id: staff.id,
    actor_name: staff.name,
    field,
    from_value: from,
    to_value: to,
  });
  if (productionChanged) events.push(event("production", prev.production_status, input.production_status));
  if (deliveryChanged) events.push(event("delivery", prev.delivery_status, input.delivery_status));
  if (noteChanged) events.push(event("note", prev.admin_note?.trim() || null, nextNote));
  if (events.length) await admin.from("print_order_events").insert(events);

  // Internal structured log (unchanged behaviour).
  if (productionChanged) {
    await notify("print.production.updated", {
      printOrderId, orderId: prev.order_id, from: prev.production_status, to: input.production_status,
    });
  }
  if (deliveryChanged) {
    await notify("print.delivery.updated", {
      printOrderId, orderId: prev.order_id, from: prev.delivery_status, to: input.delivery_status,
    });
  }

  // Customer SMS on a meaningful stage change — best-effort, after the response.
  const smsLines: string[] = [];
  const pPhrase = PRODUCTION_SMS[input.production_status];
  if (productionChanged && pPhrase) smsLines.push(`aistudio.mn: Таны хэвлэлийн захиалга ${pPhrase}`);
  const dPhrase = DELIVERY_SMS[input.delivery_status];
  if (deliveryChanged && dPhrase) smsLines.push(`aistudio.mn: Таны хэвлэлийн захиалга ${dPhrase}`);
  if (smsLines.length) {
    after(async () => {
      for (const line of smsLines) await sendSms(prev.ship_phone, line);
    });
  }

  revalidatePath("/admin/orders");
}

// ─── User role management ────────────────────────────────────
const ASSIGNABLE_ROLES: UserRole[] = ["user", "order_manager", "admin"];

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const staff = await assertCapability("users");
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error("Тодорхойгүй роль.");
  // Guard against self lock-out: an admin can't change their own role here
  // (do it via SQL if truly needed). Prevents demoting the last admin by accident.
  if (userId === staff.id) throw new Error("Өөрийн рольоо энд өөрчлөх боломжгүй.");

  const admin = createAdminClient();
  // Keep the legacy is_admin flag in sync until it's dropped, so nothing reading
  // it diverges from `role` during the migration window.
  const { error } = await admin
    .from("users")
    .update({ role, is_admin: role === "admin" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

// ─── Example image upload (public bucket) ────────────────────
export async function uploadExampleImage(formData: FormData): Promise<string> {
  await assertCapability("catalog");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Зураг олдсонгүй.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Зөвхөн JPEG, PNG, WEBP зураг оруулна уу.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Зургийн хэмжээ 10MB-аас хэтрэхгүй байх ёстой.");

  const path = `${randomUUID()}.webp`;
  const inputBuf = Buffer.from(await file.arrayBuffer());
  const body = await sharp(inputBuf, { failOn: "none" })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  await r2().send(
    new PutObjectCommand({
      Bucket: EXAMPLES_BUCKET,
      Key: path,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return publicUrl(path);
}
