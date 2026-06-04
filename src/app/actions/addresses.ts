"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AddressInput } from "@/lib/address";
import type { Database } from "@/lib/supabase/types";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return { supabase, user };
}

function validate(input: AddressInput) {
  if (!input.recipient?.trim()) throw new Error("Хүлээн авагчийн нэр оруулна уу.");
  if (!input.phone?.trim()) throw new Error("Утасны дугаар оруулна уу.");
  if (!input.city?.trim()) throw new Error("Аймаг / хот оруулна уу.");
  if (!input.detail?.trim()) throw new Error("Дэлгэрэнгүй хаяг (байр, тоот) оруулна уу.");
}

export async function listAddresses(): Promise<AddressRow[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as AddressRow[];
}

export async function addAddress(input: AddressInput): Promise<string> {
  const { supabase, user } = await requireUser();
  validate(input);

  // First saved address is default automatically.
  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const makeDefault = input.is_default || (count ?? 0) === 0;

  if (makeDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      label: input.label?.trim() || null,
      recipient: input.recipient.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      district: input.district?.trim() || null,
      khoroo: input.khoroo?.trim() || null,
      detail: input.detail.trim(),
      note: input.note?.trim() || null,
      is_default: makeDefault,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Хаяг хадгалахад алдаа гарлаа.");
  revalidatePath("/settings");
  return data.id;
}

export async function updateAddress(id: string, input: AddressInput): Promise<void> {
  const { supabase, user } = await requireUser();
  validate(input);

  if (input.is_default) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("addresses")
    .update({
      label: input.label?.trim() || null,
      recipient: input.recipient.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      district: input.district?.trim() || null,
      khoroo: input.khoroo?.trim() || null,
      detail: input.detail.trim(),
      note: input.note?.trim() || null,
      ...(input.is_default ? { is_default: true } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteAddress(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setDefaultAddress(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
