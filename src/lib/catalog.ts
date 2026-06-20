// Dynamic catalog — fetches categories and presets from Supabase.
// Uses presets_public view so internal_prompt is never exposed to the client.

import { createClient } from "@/lib/supabase/client";

export interface PresetOptions {
  backgroundPresets?: string[];
  /** "Юу гарах вэ?" — bullet points describing the result, shown on the detail page. */
  benefits?: string[];
  /** "Шаардлагатай зураг" — guidance bullets about the input photos. */
  imageRequirements?: string[];
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
  /** Aspect ratio shared by most of the category's presets (e.g. "4:5"); null if unset. */
  aspect_ratio: string | null;
}

// Convert a ratio label ("4:5", "16:9") to a CSS aspect-ratio value ("4 / 5").
// Returns null for "Original"/empty/unknown so callers can pick their own fallback.
export function ratioToCss(ratio: string | null | undefined): string | null {
  if (!ratio) return null;
  const m = ratio.match(/^\s*(\d+)\s*[:/]\s*(\d+)\s*$/);
  return m ? `${m[1]} / ${m[2]}` : null;
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
  /** Public-sharing discount as a whole percent (0–100); 0 = none. */
  public_discount_pct: number;
  eta_min: string;
  warnings_mn: string[];
  example_output: string;
  example_before: string | null;
  example_type: string;
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

// A preset on the landing-page featured rail (the most-generated presets
// overall), paired with its category for labelling. See getFeaturedPresetsServer.
export interface FeaturedPreset {
  category: Category;
  preset: Preset;
}

// Simple in-memory cache so navigating between pages (home → generate →
// category) within a session doesn't re-fetch the whole catalog each time.
// Categories/presets change rarely; a short TTL keeps it fresh enough and a
// full page reload clears it. Call invalidateCatalog() after admin edits.
const CATALOG_TTL_MS = 60_000;
let catalogCache: { at: number; promise: Promise<CategoryWithPresets[]> } | null = null;

export function invalidateCatalog() {
  catalogCache = null;
}

async function fetchCategories(): Promise<CategoryWithPresets[]> {
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

export function getCategories({ force = false }: { force?: boolean } = {}): Promise<CategoryWithPresets[]> {
  const now = Date.now();
  if (!force && catalogCache && now - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.promise;
  }
  const promise = fetchCategories();
  catalogCache = { at: now, promise };
  // If the fetch rejects, drop the cache so the next call retries.
  promise.catch(() => { if (catalogCache?.promise === promise) catalogCache = null; });
  return promise;
}

// Fetch a single category + its presets — used by the category detail page so
// it doesn't pull the entire catalog just to show one category.
export async function getCategory(id: string): Promise<CategoryWithPresets | null> {
  const supabase = createClient();
  const [catRes, presetsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).eq("is_active", true).single(),
    supabase.from("presets_public").select("*").eq("category_id", id).eq("is_active", true).order("sort_order"),
  ]);
  if (catRes.error || !catRes.data) return null;
  return { ...(catRes.data as Category), presets: (presetsRes.data ?? []) as Preset[] };
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
