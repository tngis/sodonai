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

  // Stable presigning: returns the same URL string for an object within the
  // current window, so the browser caches the image across gallery visits
  // instead of re-downloading it on every navigation. (expiresIn is ignored in
  // stable mode — the window expiry is used.)
  return getSignedUrls(OUTPUTS_BUCKET, paths, undefined, { stable: true });
}

// Presign thumbnails for already-known output storage paths (e.g. the image a
// print order is framing). Authorizes by owner prefix like getOutputUrls, then
// prefers each asset's thumb_path over the full image so cards load fast.
// Returns a { [storagePath]: signedUrl } map (missing/failed paths are omitted).
export async function getOutputThumbUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  for (const path of paths) {
    if (path.split("/")[0] !== user.id) throw new Error("Хандах эрхгүй зам.");
  }

  const unique = [...new Set(paths)];
  const { data } = await supabase
    .from("assets")
    .select("storage_path, thumb_path")
    .in("storage_path", unique);

  const thumbByStorage = new Map(
    (data ?? []).map((a) => [a.storage_path, a.thumb_path ?? a.storage_path]),
  );
  const signPaths = unique.map((p) => thumbByStorage.get(p) ?? p);
  const signed = await getSignedUrls(OUTPUTS_BUCKET, signPaths, undefined, { stable: true });

  const result: Record<string, string> = {};
  unique.forEach((p, i) => {
    if (signed[i]) result[p] = signed[i];
  });
  return result;
}

// Fetch and presign thumbnail URLs for a list of generation IDs.
// Queries the assets table for the first asset per generation, preferring
// thumb_path over storage_path, and returns a { [genId]: signedUrl } map.
// Used by the notifications panel to show result thumbnails.
export async function getNotificationThumbs(
  genIds: string[]
): Promise<Record<string, string>> {
  if (genIds.length === 0) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from("assets")
    .select("generation_id, storage_path, thumb_path")
    .in("generation_id", genIds)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!data?.length) return {};

  type AssetRow = {
    generation_id: string | null;
    storage_path: string;
    thumb_path: string | null;
  };

  const firstByGen = new Map<string, { path: string }>();
  for (const row of data as AssetRow[]) {
    if (!row.generation_id) continue;
    if (!firstByGen.has(row.generation_id)) {
      firstByGen.set(row.generation_id, {
        path: row.thumb_path ?? row.storage_path,
      });
    }
  }

  const genIdList = [...firstByGen.keys()];
  const paths = genIdList.map((gid) => firstByGen.get(gid)!.path);
  const signed = await getSignedUrls(OUTPUTS_BUCKET, paths, undefined, {
    stable: true,
  });

  const result: Record<string, string> = {};
  genIdList.forEach((gid, i) => {
    if (signed[i]) result[gid] = signed[i];
  });
  return result;
}

// Presign full-image paths AND their thumbnail paths in one call.
// Used by the gallery grid and gallery-picker: the grid shows thumbUrls for
// fast load, the detail view (output page) uses the full-image URL separately.
//
// thumbPath may be null when a thumbnail was not generated (older assets or a
// failed thumb run). In that case thumbUrl is null and callers fall back to url.
export async function getOutputUrlPairs(
  entries: { path: string; thumbPath: string | null }[]
): Promise<{ url: string; thumbUrl: string | null }[]> {
  if (entries.length === 0) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  for (const { path } of entries) {
    if (path.split("/")[0] !== user.id) throw new Error("Хандах эрхгүй зам.");
  }

  const paths = entries.map((e) => e.path);
  const urls = await getSignedUrls(OUTPUTS_BUCKET, paths, undefined, { stable: true });

  // Batch-presign only the non-null thumb paths, then scatter back to positions.
  const thumbBatch: string[] = [];
  const thumbIdxMap: number[] = []; // thumbBatch[i] belongs to entries[thumbIdxMap[i]]
  entries.forEach(({ thumbPath }, i) => {
    if (thumbPath) {
      thumbIdxMap.push(i);
      thumbBatch.push(thumbPath);
    }
  });

  const thumbSigned = thumbBatch.length
    ? await getSignedUrls(OUTPUTS_BUCKET, thumbBatch, undefined, { stable: true })
    : [];

  const thumbUrls: (string | null)[] = entries.map(() => null);
  thumbIdxMap.forEach((entryIdx, batchIdx) => {
    thumbUrls[entryIdx] = thumbSigned[batchIdx] || null;
  });

  return entries.map((_, i) => ({ url: urls[i], thumbUrl: thumbUrls[i] }));
}
