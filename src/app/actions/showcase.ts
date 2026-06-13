"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

// Newest publicly-shared images across ALL users, for the landing-page marquee.
//
// Two gates (both default off — see migration 0018): the owning user's master
// switch (users.public_sharing_enabled) AND the per-image flag (is_private=false).
// assets are owner-scoped under RLS, so this aggregate has to run on the admin
// client. It returns ONLY presigned image URLs — never user or row-level data —
// so there is nothing sensitive to leak. No auth required: the landing page is
// public.
export async function getPublicShowcase(limit = 24): Promise<string[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("assets")
    .select("storage_path, users!inner(public_sharing_enabled)")
    .eq("is_private", false)
    // PostgREST inner-join filter on the embedded users row. The generated
    // column union doesn't include dotted foreign columns, so this one is cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("users.public_sharing_enabled" as any, true as any)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const paths = (data as unknown as { storage_path: string }[]).map((r) => r.storage_path);
  const urls = await getSignedUrls(OUTPUTS_BUCKET, paths, 3600);
  // getSignedUrls yields "" for a missing object — drop those.
  return urls.filter(Boolean);
}

// Flip whether every image of a generation is shown in the public showcase.
// Owner-scoped via the regular (RLS) client — the existing "assets: owner
// update" policy only lets a user touch their own rows. `is_private` is the
// per-image gate; the user's master switch still has to be on for anything to
// actually appear (see getPublicShowcase).
export async function setGenerationVisibility(
  generationId: string,
  share: boolean
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const { error } = await supabase
    .from("assets")
    .update({ is_private: !share })
    .eq("generation_id", generationId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/gallery");
  revalidatePath("/");
}
