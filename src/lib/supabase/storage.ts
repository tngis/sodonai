// Storage facade. Reads/writes now go to Cloudflare R2 (S3-compatible) to cut
// Supabase egress costs; Supabase still backs the database + auth. During the
// migration window, presigning falls back to Supabase Storage for any object
// not yet copied to R2 (see getSignedUrls). The file keeps this path so the
// existing importers (payment.ts, generation.ts) need no changes.
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { r2, UPLOADS_BUCKET, OUTPUTS_BUCKET } from "../r2/client";
import { createAdminClient } from "./admin";

export { UPLOADS_BUCKET, OUTPUTS_BUCKET };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Зөвхөн JPEG, PNG, WEBP зураг оруулна уу.";
  if (file.size > MAX_FILE_SIZE) return "Зургийн хэмжээ 10MB-аас хэтрэхгүй байх ёстой.";
  return null;
}

// Upload a user-provided image to the private uploads bucket.
// Path: {userId}/{orderId}/{index}.{ext}
export async function uploadFile(
  file: File,
  userId: string,
  orderId: string,
  index: number
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${orderId}/${index}.${ext}`;
  // R2 needs a known Content-Length, so buffer the file rather than streaming it.
  const body = new Uint8Array(await file.arrayBuffer());

  await r2().send(
    new PutObjectCommand({
      Bucket: UPLOADS_BUCKET,
      Key: path,
      Body: body,
      ContentType: file.type || "image/jpeg",
      // Raw header value (Supabase's `cacheControl: "3600"` expanded to this).
      CacheControl: "max-age=3600",
    })
  );
  return path;
}

// Upload a profile picture to the private outputs bucket. Stored under a
// dedicated {userId}/profile/ prefix so it's presigned by the same owner check
// as gallery outputs, and so avatar cleanup can target only profile-prefixed
// objects (never a gallery image the user also set as their avatar).
// The timestamp in the key makes each upload a fresh object — presigned URLs
// already vary per request, but a new key also avoids any CDN edge caching.
export async function storeAvatarFile(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/profile/${Date.now()}.${ext}`;
  const body = new Uint8Array(await file.arrayBuffer());

  await r2().send(
    new PutObjectCommand({
      Bucket: OUTPUTS_BUCKET,
      Key: path,
      Body: body,
      ContentType: file.type || "image/jpeg",
      CacheControl: "max-age=3600",
    })
  );
  return path;
}

// Store a generated output image to the private outputs bucket.
// imageData can be a public URL (fetched and re-uploaded) or a base64 data URI.
// Path: {userId}/{generationId}/{index}.{ext}
export async function storeOutputFile(
  imageData: string,
  userId: string,
  generationId: string,
  index: number
): Promise<string> {
  let buffer: ArrayBuffer;
  let contentType = "image/jpeg";

  if (imageData.startsWith("data:")) {
    const [header, b64] = imageData.split(",");
    contentType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    const binary = atob(b64);
    buffer = new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i)).buffer;
  } else {
    const res = await fetch(imageData);
    contentType = res.headers.get("content-type") ?? "image/jpeg";
    buffer = await res.arrayBuffer();
  }

  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${userId}/${generationId}/${index}.${ext}`;

  await r2().send(
    new PutObjectCommand({
      Bucket: OUTPUTS_BUCKET,
      Key: path,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      // Outputs are immutable — keyed by generationId/index and never
      // overwritten — so let the browser/CDN cache them forever. Pairs with the
      // deterministic ("stable") presigned URL from getSignedUrls: a stable URL
      // with no Cache-Control still wouldn't be reused by the browser.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return path;
}

// ── Deterministic ("stable") presigned URLs ──────────────────────────────────
// Gallery/output images are presigned on every page load. With a fresh signing
// time each call, the URL string (incl. its X-Amz-Date/Signature query) changes,
// so the browser HTTP cache — keyed on the full URL — never hits and re-downloads
// every image when you open one and navigate back. Pinning the SigV4 signing
// date to a rounded window makes the URL byte-identical for the same
// (bucket, path) within that window, so the cache finally hits.
//
// INVARIANT: STABLE_WINDOW_MS must be < STABLE_EXPIRY (expressed in ms). A URL
// minted at the very END of a window is still signed as of the window START, so
// its lifetime must outlast the remainder of the window plus real viewing time.
// 1-day window / 7-day expiry → a tail-edge URL is still valid for ~6 more days.
// (7 days = 604800s is also the SigV4 maximum expiry, so don't raise it.)
const STABLE_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day
const STABLE_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days (SigV4 max)

// Start of the current window — used as the fixed SigV4 signing date so repeat
// calls within the window produce the identical URL string.
function stableSigningDate(): Date {
  return new Date(Math.floor(Date.now() / STABLE_WINDOW_MS) * STABLE_WINDOW_MS);
}

// Batch-generate presigned GET URLs for private objects (server-side only).
// Dual-read fallback: objects already in R2 are presigned via R2; anything not
// yet copied falls back to a Supabase signed URL. Remove the fallback once the
// one-time copy is verified complete (then this becomes pure R2).
//
// Per-item resilience: a failed path yields "" instead of rejecting the whole
// batch (the old Supabase createSignedUrls contract — gallery/print render a
// placeholder for ""). Callers that need every URL must check for "".
//
// `stable` (opt-in): deterministic, browser-cacheable URLs for display surfaces
// (see stableSigningDate). It forces the long window expiry and ignores the
// `expiresIn` arg; non-stable callers (e.g. the 900s AI upload reads) are
// unchanged and keep a fresh URL per call.
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600,
  { stable = false }: { stable?: boolean } = {}
): Promise<string[]> {
  const signingDate = stable ? stableSigningDate() : undefined;
  const effectiveExpiry = stable ? STABLE_EXPIRY_SECONDS : expiresIn;

  return Promise.all(
    paths.map((path) =>
      signOne(bucket, path, effectiveExpiry, signingDate).catch((err) => {
        console.error(`getSignedUrls: ${bucket}/${path}: ${err instanceof Error ? err.message : err}`);
        return "";
      })
    )
  );
}

async function signOne(
  bucket: string,
  path: string,
  expiresIn: number,
  signingDate?: Date
): Promise<string> {
  if (await existsInR2(bucket, path)) {
    // signingDate (when provided) pins X-Amz-Date so the presigned URL is
    // deterministic for the same (bucket, path) within the window.
    return presign(
      r2(),
      new GetObjectCommand({ Bucket: bucket, Key: path }),
      signingDate ? { expiresIn, signingDate } : { expiresIn }
    );
  }
  // Transition-only fallback. Bucket names match between R2 and Supabase, so the
  // same `bucket` value works against Supabase Storage. It can't pin the signing
  // time, so these URLs still vary per call — acceptable: nearly everything is in
  // R2 and the fallback is on its way out.
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) {
    throw new Error(`Signed URL failed for ${bucket}/${path}: ${error?.message ?? "not found"}`);
  }
  return data.signedUrl;
}

// HeadObject existence probe. Any failure (404, missing creds, network) routes
// the caller to the Supabase fallback during the migration window.
async function existsInR2(bucket: string, path: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
    return true;
  } catch {
    return false;
  }
}

// Delete private objects from R2 (best-effort batch).
export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await r2().send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
    })
  );

  // Transition-only: objects copied from Supabase still exist there too, so
  // deletion (e.g. account removal) must purge both copies. Best-effort — drop
  // this together with the dual-read fallback once Supabase buckets are emptied.
  try {
    await createAdminClient().storage.from(bucket).remove(paths);
  } catch {
    // Supabase copy already gone / Storage disabled — R2 is the source of truth.
  }
}
