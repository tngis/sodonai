import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl } from "@/lib/r2/client";

export interface SharePageData {
  token: string;
  /** Preset the image was made from, for the "make one too" deep link. */
  presetId: string | null;
  presetName: string | null;
  /** Permanent public URL of the branded OG card (in the examples bucket). */
  cardUrl: string;
}

// Read the public share page's data by its opaque token. generations is
// owner-scoped under RLS, so this runs on the service-role/admin client — but it
// returns ONLY the (already public) card URL + preset name, nothing user- or
// row-sensitive, the same reasoning as getPublicShowcase. Used by both the page
// and its generateMetadata, so the lookup lives in one place.
export async function getSharePageData(token: string): Promise<SharePageData | null> {
  if (!token) return null;
  const admin = createAdminClient();

  const { data: gen } = await admin
    .from("generations")
    .select("share_token, orders(preset_id)")
    .eq("share_token", token)
    .maybeSingle();
  if (!gen) return null;

  const presetId =
    (gen as { orders: { preset_id: string | null } | null }).orders?.preset_id ?? null;

  let presetName: string | null = null;
  if (presetId) {
    const { data: preset } = await admin
      .from("presets")
      .select("name_mn")
      .eq("id", presetId)
      .maybeSingle();
    presetName = (preset as { name_mn: string } | null)?.name_mn ?? null;
  }

  return { token, presetId, presetName, cardUrl: publicUrl(`share/${token}.jpg`) };
}
