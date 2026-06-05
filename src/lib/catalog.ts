// Dynamic catalog — fetches categories and presets from Supabase.
// Uses presets_public view so internal_prompt is never exposed to the client.

import { createClient } from "@/lib/supabase/client";

export interface PresetOptions {
  backgroundPresets?: string[];
  styleIntensityDefault?: number;
}

export interface Category {
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

export interface Preset {
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
  example_output: string;
  example_inputs: string[];
  options: PresetOptions | null;
  required_uploads: string[] | null;
  required_min: number;
  required_max: number;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryWithPresets extends Category {
  presets: Preset[];
}

export async function getCategories(): Promise<CategoryWithPresets[]> {
  const supabase = createClient();
  const [catsRes, presetsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("presets_public").select("*").eq("is_active", true).order("sort_order"),
  ]);
  const categories = (catsRes.data ?? []) as Category[];
  const presets = (presetsRes.data ?? []) as Preset[];
  return categories.map((cat) => ({
    ...cat,
    presets: presets.filter((p) => p.category_id === cat.id),
  }));
}

export async function getPreset(
  presetId: string
): Promise<{ category: Category; preset: Preset } | null> {
  const supabase = createClient();
  const presetRes = await supabase.from("presets_public").select("*").eq("id", presetId).eq("is_active", true).single();
  if (presetRes.error || !presetRes.data) return null;
  const preset = presetRes.data as Preset;
  const catRes = await supabase.from("categories").select("*").eq("id", preset.category_id).single();
  if (catRes.error || !catRes.data) return null;
  return { preset, category: catRes.data as Category };
}
