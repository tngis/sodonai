import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PresetModelConfig {
  /** System-level instruction for the AI backend — never shown to the user. */
  prompt: string;
  /** Which model to run for this preset. Configured at data-entry, not by the user. */
  model: string;
}

// Fallback when a preset has no ai_model set yet.
const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL ?? "default";

// Server-only: reads the model internals (prompt + model) for a preset.
// Uses the admin client so it can read internal_prompt, which RLS/the public view hide.
export async function getPresetModelConfig(presetId: string): Promise<PresetModelConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("presets")
    .select("internal_prompt, ai_model")
    .eq("id", presetId)
    .single();

  return {
    prompt: data?.internal_prompt ?? "",
    model: data?.ai_model ?? DEFAULT_MODEL,
  };
}

export interface PresetPricing {
  /** The preset's full price in ₮. */
  priceMnt: number;
  /** Public-sharing discount as a whole percent (0–100). */
  discountPct: number;
}

// Server-only: reads the preset's pricing authoritatively (not trusting any
// client-supplied amount) so the public-sharing discount can be computed and
// snapshotted onto the generation. See computeShareDiscount in @/lib/pricing.
export async function getPresetPricing(presetId: string): Promise<PresetPricing> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("presets")
    .select("price_mnt, public_discount_pct")
    .eq("id", presetId)
    .single();

  return {
    priceMnt: data?.price_mnt ?? 0,
    discountPct: data?.public_discount_pct ?? 0,
  };
}
