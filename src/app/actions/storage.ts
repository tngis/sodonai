"use server";

import { createClient } from "@/lib/supabase/server";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

// Presign private output images for the signed-in user.
//
// This replaces the old browser-side supabase.storage.createSignedUrls() call:
// R2 can't presign in the browser (presigning needs the secret key), so both
// the presigning and the per-user authorization moved server-side here.
export async function getOutputUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  // Authorize: outputs are keyed {userId}/{generationId}/..., so the first path
  // segment must be the caller's id. Mirrors the old Supabase Storage RLS rule
  // `auth.uid() = (storage.foldername(name))[1]`.
  for (const path of paths) {
    if (path.split("/")[0] !== user.id) throw new Error("Хандах эрхгүй зам.");
  }

  return getSignedUrls(OUTPUTS_BUCKET, paths, 3600);
}
