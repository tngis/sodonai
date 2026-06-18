"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  storeAvatarFile,
  getSignedUrls,
  removeFiles,
  validateImageFile,
  OUTPUTS_BUCKET,
} from "@/lib/supabase/storage";

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Stored OUTPUTS bucket key, or null. */
  avatarPath: string | null;
  /** Presigned URL for avatarPath, or null. */
  avatarUrl: string | null;
  /** Master switch: are this user's shared images allowed in the public showcase? */
  publicSharingEnabled: boolean;
  isAdmin: boolean;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return { supabase, user };
}

// Presign a single private avatar path. Authorizes the same way as gallery
// outputs: the key's first segment must be the caller's id (mirrors the
// Supabase Storage RLS rule the R2 migration replaced).
//
// Avatars render tiny, but a gallery-set avatar points at the full-resolution
// output (multi-MB PNG). If that asset has a thumbnail, serve the small thumb
// instead. Presigning with `stable: true` makes the URL byte-identical to the
// gallery grid's thumb URL, so the browser reuses one cache entry — the header
// avatar then costs zero extra bytes.
async function signAvatar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
  userId: string,
): Promise<string | null> {
  if (!path) return null;
  if (path.split("/")[0] !== userId) return null;

  let signPath = path;
  const { data: asset } = await supabase
    .from("assets")
    .select("thumb_path")
    .eq("user_id", userId)
    .eq("storage_path", path)
    .maybeSingle();
  if (asset?.thumb_path) signPath = asset.thumb_path;

  const [url] = await getSignedUrls(OUTPUTS_BUCKET, [signPath], undefined, {
    stable: true,
  });
  return url || null;
}

// Best-effort removal of a *previous* avatar's underlying object. Only deletes
// objects under {userId}/profile/ — an avatar set from the gallery points at a
// real gallery asset, which must never be deleted just because it was replaced.
async function cleanupOldAvatar(oldPath: string | null, userId: string) {
  if (oldPath && oldPath.startsWith(`${userId}/profile/`)) {
    await removeFiles(OUTPUTS_BUCKET, [oldPath]);
  }
}

export async function getProfile(): Promise<Profile> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("users")
    .select("name, phone, avatar_url, public_sharing_enabled, is_admin")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    name: data?.name ?? null,
    phone: data?.phone && data.phone !== "" ? data.phone : null,
    email: user.email ?? null,
    avatarPath: data?.avatar_url ?? null,
    avatarUrl: await signAvatar(supabase, data?.avatar_url ?? null, user.id),
    publicSharingEnabled: data?.public_sharing_enabled ?? false,
    isAdmin: data?.is_admin ?? false,
  };
}

// Master switch for the public showcase. When off, none of the user's images
// appear on the landing page regardless of each image's own share flag (see
// getPublicShowcase in actions/showcase.ts).
export async function setPublicSharing(enabled: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("users")
    .update({ public_sharing_enabled: enabled })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateProfileName(name: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Нэр оруулна уу.");
  if (trimmed.length > 80) throw new Error("Нэр хэт урт байна.");

  const { error } = await supabase
    .from("users")
    .update({ name: trimmed })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

// Upload a profile picture from the user's device. Returns the new signed URL.
export async function uploadAvatar(formData: FormData): Promise<string> {
  const { supabase, user } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Зураг сонгоно уу.");
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  const { data: current } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const path = await storeAvatarFile(file, user.id);

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: path })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  await cleanupOldAvatar(current?.avatar_url ?? null, user.id);
  revalidatePath("/profile");

  return (await signAvatar(supabase, path, user.id)) ?? "";
}

// Set the profile picture to one of the user's own gallery images. Reuses the
// existing outputs object (no copy), so cleanup must NOT delete it later.
export async function setAvatarFromGallery(storagePath: string): Promise<string> {
  const { supabase, user } = await requireUser();

  // Authorize: must be the caller's own object, and a real owned asset.
  if (storagePath.split("/")[0] !== user.id) throw new Error("Хандах эрхгүй зам.");
  const { data: asset } = await supabase
    .from("assets")
    .select("id")
    .eq("user_id", user.id)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (!asset) throw new Error("Зураг олдсонгүй.");

  const { data: current } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: storagePath })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  await cleanupOldAvatar(current?.avatar_url ?? null, user.id);
  revalidatePath("/profile");

  return (await signAvatar(supabase, storagePath, user.id)) ?? "";
}

export async function removeAvatar(): Promise<void> {
  const { supabase, user } = await requireUser();

  const { data: current } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  await cleanupOldAvatar(current?.avatar_url ?? null, user.id);
  revalidatePath("/profile");
}
