"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";
import { unshareGenerationCore, createShareLinkCore } from "@/lib/showcase-core";

// Newest publicly-shared images across ALL users, for the landing-page marquee.
//
// Visibility is now a per-image property: an asset shows iff is_private=false.
// (The old per-user master switch was removed — sharing/hiding is decided per
// generation, with a discount on share and a repayment on un-share.) assets are
// owner-scoped under RLS, so this aggregate runs on the admin client. It returns
// ONLY presigned image URLs — never user or row-level data — so there is nothing
// sensitive to leak. No auth required: the landing page is public.
export async function getPublicShowcase(limit = 24): Promise<string[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("assets")
    .select("storage_path")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const paths = (data as { storage_path: string }[]).map((r) => r.storage_path);
  const urls = await getSignedUrls(OUTPUTS_BUCKET, paths, 3600);
  // getSignedUrls yields "" for a missing object — drop those.
  return urls.filter(Boolean);
}

// Hide a generation from the public feed — a ONE-WAY, FINAL action.
//
// Sharing can only be opted into at generation time (for the discount). There is
// no re-share: once hidden, an image stays private forever, and an image that was
// never shared can never be made public. So this is the only visibility mutation
// after generation, and it always moves public → unshared.
//
// It repays the discount the share consumed. The discount is read from the
// generation's snapshot (captured at generation time, never recomputed — the
// preset price may have changed since). The repayment is charged FIRST; only on
// success is the image made private, so a failed/insufficient payment leaves it
// shared. Returns the amount charged.
// Thin cookie-auth wrapper around the shared core (mobile uses Bearer via
// src/app/api/generation/[id]/unshare/route.ts).
export async function unshareGeneration(generationId: string): Promise<{ charged: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  const result = await unshareGenerationCore({ supabase, user, generationId });
  revalidatePath("/gallery");
  revalidatePath("/");
  return result;
}

// Turn a generation into a public share link (/s/{token}) for the Facebook
// "link post" loop. Builds a branded OG card once and stores the opaque token on
// the generation. Idempotent: re-sharing the same generation returns the existing
// link (the card lives forever in the public bucket). Returns the absolute URL.
// Thin cookie-auth wrapper around the shared core (mobile uses Bearer via
// src/app/api/generation/[id]/share/route.ts).
export async function createShareLink(generationId: string): Promise<{ url: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return createShareLinkCore({ supabase, user, generationId });
}
