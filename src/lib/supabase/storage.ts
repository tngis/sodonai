// Storage facade. All reads/writes go to Cloudflare R2 (S3-compatible) to cut
// Supabase egress costs; Supabase still backs the database + auth. (The R2
// migration is complete — the old Supabase Storage dual-read/dual-delete
// fallback has been removed.)
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { r2, UPLOADS_BUCKET, OUTPUTS_BUCKET, EXAMPLES_BUCKET, publicUrl } from "../r2/client";

export { UPLOADS_BUCKET, OUTPUTS_BUCKET, EXAMPLES_BUCKET };

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

// Generate and store a grid thumbnail for an AI output image.
// Path: {userId}/{generationId}/{index}_thumb.webp
// Resizes to fit within 640×640 (no upscale), encodes to WebP quality 90.
// Throws on failure — callers should catch and fall back to thumb_path = null.
export async function storeThumbFile(
  imageData: string,
  userId: string,
  generationId: string,
  index: number
): Promise<string> {
  let inputBuf: Buffer;

  if (imageData.startsWith("data:")) {
    const [, b64] = imageData.split(",");
    inputBuf = Buffer.from(b64, "base64");
  } else {
    const res = await fetch(imageData);
    if (!res.ok) throw new Error(`Thumb fetch failed: ${res.status}`);
    inputBuf = Buffer.from(await res.arrayBuffer());
  }

  const webp = await sharp(inputBuf, { failOn: "none" })
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();

  const path = `${userId}/${generationId}/${index}_thumb.webp`;

  await r2().send(
    new PutObjectCommand({
      Bucket: OUTPUTS_BUCKET,
      Key: path,
      Body: webp,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return path;
}

// Build a BRANDED share card for the public /s/{token} page and store it in the
// PUBLIC examples bucket, returning a permanent public URL (Facebook's crawler
// needs a stable, non-expiring og:image — a presigned URL would expire and FB
// caches it). The card is the output image (max 1200px, aspect kept) with an
// "aistudio.mn" pill composited into the bottom-right corner — the same brand
// watermark the direct social shares carry. The owner's own download stays clean.
// imageData: a presigned output URL or a base64 data URI.
export async function storeShareCard(imageData: string, token: string): Promise<string> {
  let inputBuf: Buffer;
  if (imageData.startsWith("data:")) {
    const [, b64] = imageData.split(",");
    inputBuf = Buffer.from(b64, "base64");
  } else {
    const res = await fetch(imageData);
    if (!res.ok) throw new Error(`Share card fetch failed: ${res.status}`);
    inputBuf = Buffer.from(await res.arrayBuffer());
  }

  // Resize first so the badge is sized against the final pixels.
  const { data: resized, info } = await sharp(inputBuf, { failOn: "none" })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  // A full-canvas transparent SVG with a rounded pill in the bottom-right. Sizes
  // scale with the image so it reads on both small and large outputs.
  const fs = Math.max(20, Math.round(width * 0.032));
  const padX = Math.round(fs * 0.7);
  const padY = Math.round(fs * 0.45);
  const margin = Math.round(width * 0.025);
  // Plain "aistudio.mn" with the generic `sans-serif` family: sharp renders SVG
  // text through fontconfig, where system-ui / decorative glyphs may be missing
  // on the deploy host — basic Latin in sans-serif is always available.
  const label = "aistudio.mn";
  const pillW = Math.round(fs * 0.62 * label.length) + padX * 2;
  const pillH = fs + padY * 2;
  const x = width - pillW - margin;
  const y = height - pillH - margin;
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${x}" y="${y}" width="${pillW}" height="${pillH}" rx="${Math.round(pillH / 2)}"
            fill="rgba(0,0,0,0.55)"/>
      <text x="${x + pillW / 2}" y="${y + pillH / 2}" fill="#ffffff"
            font-family="sans-serif" font-weight="700"
            font-size="${fs}" text-anchor="middle" dominant-baseline="central">${label}</text>
    </svg>`,
  );

  const body = await sharp(resized)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  const path = `share/${token}.jpg`;
  await r2().send(
    new PutObjectCommand({
      Bucket: EXAMPLES_BUCKET,
      Key: path,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrl(path);
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

// Batch-generate presigned GET URLs for private R2 objects (server-side only).
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
  // signingDate (when provided) pins X-Amz-Date so the presigned URL is
  // deterministic for the same (bucket, path) within the window.
  return presign(
    r2(),
    new GetObjectCommand({ Bucket: bucket, Key: path }),
    signingDate ? { expiresIn, signingDate } : { expiresIn }
  );
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
}
