"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth-admin";
import { notify } from "@/lib/notify";
import type {
  Json,
  SuggestionKind,
  PrintProductionStatus,
  PrintDeliveryStatus,
} from "@/lib/supabase/types";

const EXAMPLES_BUCKET = "examples";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface CategoryInput {
  id: string;
  name_mn: string;
  name_en: string;
  description_mn: string;
  description_en: string;
  icon: string;
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
  eta_min: string;
  warnings_mn: string[];
  internal_prompt: string;
  ai_model: string | null;
  example_output: string;
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
  await assertAdmin();
  if (!input.id.trim()) throw new Error("ID хоосон байж болохгүй.");
  const admin = createAdminClient();
  const { error } = await admin.from("categories").insert(input);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function updateCategory(id: string, input: Omit<CategoryInput, "id">): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("categories").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function deleteCategory(id: string): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

// ─── Presets ─────────────────────────────────────────────────
export async function createPreset(input: PresetInput): Promise<void> {
  await assertAdmin();
  if (!input.id.trim()) throw new Error("ID хоосон байж болохгүй.");
  if (!input.category_id) throw new Error("Ангилал сонгоно уу.");
  const admin = createAdminClient();
  const { error } = await admin.from("presets").insert(input);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function updatePreset(id: string, input: Omit<PresetInput, "id">): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("presets").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

export async function deletePreset(id: string): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("presets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAdmin();
}

// ─── Saved quick-select options ──────────────────────────────
export async function addOptionSuggestion(kind: SuggestionKind, value: string): Promise<void> {
  await assertAdmin();
  const v = value.trim();
  if (!v) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("option_suggestions")
    .upsert({ kind, value: v }, { onConflict: "kind,value", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function deleteOptionSuggestion(kind: SuggestionKind, value: string): Promise<void> {
  await assertAdmin();
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

export async function updatePrintFulfillment(
  printOrderId: string,
  input: PrintFulfillmentInput
): Promise<void> {
  await assertAdmin();
  const admin = createAdminClient();

  // Read current values so we only notify on an actual stage change.
  const { data: before } = await admin
    .from("print_orders")
    .select("order_id, production_status, delivery_status")
    .eq("id", printOrderId)
    .single();

  const { error } = await admin
    .from("print_orders")
    .update({
      production_status: input.production_status,
      delivery_status: input.delivery_status,
      admin_note: input.admin_note?.trim() || null,
    })
    .eq("id", printOrderId);
  if (error) throw new Error(error.message);

  const prev = before as { order_id: string; production_status: string; delivery_status: string } | null;
  if (prev && prev.production_status !== input.production_status) {
    await notify("print.production.updated", {
      printOrderId,
      orderId: prev.order_id,
      from: prev.production_status,
      to: input.production_status,
    });
  }
  if (prev && prev.delivery_status !== input.delivery_status) {
    await notify("print.delivery.updated", {
      printOrderId,
      orderId: prev.order_id,
      from: prev.delivery_status,
      to: input.delivery_status,
    });
  }

  revalidatePath("/admin/orders");
}

// ─── Example image upload (public bucket) ────────────────────
export async function uploadExampleImage(formData: FormData): Promise<string> {
  await assertAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Зураг олдсонгүй.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Зөвхөн JPEG, PNG, WEBP зураг оруулна уу.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Зургийн хэмжээ 10MB-аас хэтрэхгүй байх ёстой.");

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${randomUUID()}.${ext}`;

  const { error } = await admin.storage
    .from(EXAMPLES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Зураг оруулахад алдаа: ${error.message}`);

  const { data } = admin.storage.from(EXAMPLES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
