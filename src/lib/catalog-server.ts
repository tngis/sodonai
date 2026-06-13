// Server-side catalog fetch — used by Server Component pages so the catalog is
// rendered into the RSC payload (no client-side useEffect waterfall on navigation).
//
// The catalog is public (categories + the presets_public view, which strips
// internal_prompt), so we use a cookieless anon client. Being cookieless lets us
// wrap reads in unstable_cache for cross-request caching with a short TTL —
// mirroring the in-memory TTL the browser-side catalog.ts uses.
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/types";
import type { Category, CategoryWithPresets, FeaturedPreset, Preset } from "@/lib/catalog";

// Match the browser catalog cache TTL so freshness behaves the same both ways.
const CATALOG_TTL_SECONDS = 60;

// How many presets the landing-page featured rail shows.
const FEATURED_LIMIT = 10;

function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export const getCategoriesServer = unstable_cache(
  async (): Promise<CategoryWithPresets[]> => {
    const supabase = anonClient();
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
  },
  ["catalog-categories"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["catalog"] }
);

export const getCategoryServer = unstable_cache(
  async (id: string): Promise<CategoryWithPresets | null> => {
    const supabase = anonClient();
    const [catRes, presetsRes] = await Promise.all([
      supabase.from("categories").select("*").eq("id", id).eq("is_active", true).single(),
      supabase.from("presets_public").select("*").eq("category_id", id).eq("is_active", true).order("sort_order"),
    ]);
    if (catRes.error || !catRes.data) return null;
    return { ...(catRes.data as Category), presets: (presetsRes.data ?? []) as Preset[] };
  },
  ["catalog-category"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["catalog"] }
);

// Per-preset "done" generation counts (preset_id → count), the popularity signal
// behind both the featured rail and the category covers. Plain object so it caches
// cleanly; presets with no generations are simply absent (treat as 0).
const getGenerationCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = anonClient();
    const { data } = await supabase
      .from("preset_generation_counts")
      .select("preset_id, generation_count");
    return Object.fromEntries((data ?? []).map((r) => [r.preset_id, r.generation_count]));
  },
  ["catalog-generation-counts"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["catalog"] }
);

// Landing-page featured rail: the FEATURED_LIMIT most-generated presets overall,
// regardless of category. Each preset keeps its category so the card can label it.
// When presets tie (e.g. no generations yet), the earliest by category/sort_order
// wins: the flat list is built in that pre-sorted order and Array.sort is stable,
// so ties hold their position.
export const getFeaturedPresetsServer = unstable_cache(
  async (): Promise<FeaturedPreset[]> => {
    const [categories, counts] = await Promise.all([
      getCategoriesServer(),
      getGenerationCounts(),
    ]);
    const all: FeaturedPreset[] = categories.flatMap((cat) =>
      cat.presets.map((preset) => ({ category: cat, preset })),
    );
    all.sort((a, b) => (counts[b.preset.id] ?? 0) - (counts[a.preset.id] ?? 0));
    return all.slice(0, FEATURED_LIMIT);
  },
  ["catalog-featured-presets"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["catalog"] }
);

// Landing-page category cards: cover image per category (category_id → image url).
// The cover is the example_output of the most-generated preset in that category
// (tie → earliest by sort_order, via a strictly-greater scan over the pre-sorted
// presets). Falls back to the category's own image_url, then "" — at which point
// the card renders the emoji icon.
export const getCategoryCoversServer = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const [categories, counts] = await Promise.all([
      getCategoriesServer(),
      getGenerationCounts(),
    ]);
    const covers: Record<string, string> = {};
    for (const cat of categories) {
      let top: Preset | undefined = cat.presets[0];
      let topCount = top ? counts[top.id] ?? 0 : -1;
      for (let i = 1; i < cat.presets.length; i++) {
        const c = counts[cat.presets[i].id] ?? 0;
        if (c > topCount) {
          top = cat.presets[i];
          topCount = c;
        }
      }
      covers[cat.id] = top?.example_output || cat.image_url || "";
    }
    return covers;
  },
  ["catalog-category-covers"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["catalog"] }
);

export const getPresetServer = unstable_cache(
  async (presetId: string): Promise<{ category: Category; preset: Preset } | null> => {
    const supabase = anonClient();
    const presetRes = await supabase.from("presets_public").select("*").eq("id", presetId).eq("is_active", true).single();
    if (presetRes.error || !presetRes.data) return null;
    const preset = presetRes.data as Preset;
    const catRes = await supabase.from("categories").select("*").eq("id", preset.category_id).single();
    if (catRes.error || !catRes.data) return null;
    return { preset, category: catRes.data as Category };
  },
  ["catalog-preset"],
  { revalidate: CATALOG_TTL_SECONDS, tags: ["catalog"] }
);
