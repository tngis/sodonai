"use server";

import { createClient } from "@/lib/supabase/server";
import type { Preset } from "@/lib/catalog";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return { supabase, user };
}

// All preset ids the current user has favorited. Used to seed toggle state.
export async function listFavoriteIds(): Promise<string[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("favorites")
    .select("preset_id")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.preset_id);
}

export async function isFavorite(presetId: string): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("favorites")
    .select("preset_id")
    .eq("user_id", user.id)
    .eq("preset_id", presetId)
    .maybeSingle();
  return !!data;
}

// Toggle favorite for a preset. Returns the new state (true = now favorited).
export async function toggleFavorite(presetId: string): Promise<boolean> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("favorites")
    .select("preset_id")
    .eq("user_id", user.id)
    .eq("preset_id", presetId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("preset_id", presetId);
    if (error) throw new Error(error.message);
    return false;
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, preset_id: presetId });
  // Ignore duplicate races (double-tap): the row is already there.
  if (error && error.code !== "23505") throw new Error(error.message);
  return true;
}

// Full preset rows for the user's favorites — newest first — for the profile
// page. Reads presets_public so internal_prompt is never exposed; inactive
// presets are dropped so a favorited-then-retired preset doesn't render broken.
export async function getFavoritePresets(): Promise<Preset[]> {
  const { supabase, user } = await requireUser();

  const { data: favs } = await supabase
    .from("favorites")
    .select("preset_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const ids = (favs ?? []).map((f) => f.preset_id);
  if (ids.length === 0) return [];

  const { data: presets } = await supabase
    .from("presets_public")
    .select("*")
    .in("id", ids)
    .eq("is_active", true);

  // Preserve favorite order (newest first); the `in` query returns no order.
  const byId = new Map((presets ?? []).map((p) => [p.id, p as unknown as Preset]));
  return ids.map((id) => byId.get(id)).filter((p): p is Preset => !!p);
}
