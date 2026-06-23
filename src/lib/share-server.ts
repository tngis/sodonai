import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl } from "@/lib/r2/client";
import { getShareCardDimensions } from "@/lib/supabase/storage";

export interface SharePageData {
  token: string;
  /** Preset the image was made from, for the "make one too" deep link. */
  presetId: string | null;
  presetName: string | null;
  /** Permanent public URL of the branded OG card (in the examples bucket). */
  cardUrl: string;
  /** OG card pixel size, for an accurate per-preset aspect ratio (null = legacy). */
  width: number | null;
  height: number | null;
}

// Read the public share page's data by its opaque token. generations is
// owner-scoped under RLS, so this runs on the service-role/admin client — but it
// returns ONLY the (already public) card URL + preset name, nothing user- or
// row-sensitive, the same reasoning as getPublicShowcase. Used by both the page
// and its generateMetadata, so the lookup lives in one place.
// cache(): the page renders generateMetadata AND the component, each calling
// this once — cache() dedupes them to a single DB + HEAD round-trip per request.
export const getSharePageData = cache(async (token: string): Promise<SharePageData | null> => {
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

  const dims = await getShareCardDimensions(token);

  return {
    token,
    presetId,
    presetName,
    cardUrl: publicUrl(`share/${token}.jpg`),
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
});
