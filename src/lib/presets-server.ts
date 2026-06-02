import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getInternalPrompt(presetId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("presets")
    .select("internal_prompt")
    .eq("id", presetId)
    .single();
  return data?.internal_prompt ?? "";
}
