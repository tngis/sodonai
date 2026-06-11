import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 (S3-compatible) client — server-only. Never import from a
// "use client" module: the secret access key must never reach the browser.
// (`server-only` makes that a build error rather than a comment.)
//
// Storage moved off Supabase Storage to R2 to cut egress costs; Supabase still
// backs the database + auth. The S3Client is created lazily so a missing env
// var only fails the code paths that actually touch storage (not the whole
// server boot, and not the dual-read fallback while files are still being copied).

let cached: S3Client | null = null;

export function r2(): S3Client {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }

  cached = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cached;
}

// Bucket names — env-overridable so staging/prod can differ, with the existing
// names as defaults so nothing changes if the env vars are unset.
export const UPLOADS_BUCKET = process.env.R2_UPLOADS_BUCKET ?? "uploads";
export const OUTPUTS_BUCKET = process.env.R2_OUTPUTS_BUCKET ?? "outputs";
export const EXAMPLES_BUCKET = process.env.R2_EXAMPLES_BUCKET ?? "examples";

// Public base URL for the public `examples` bucket. Points at the r2.dev URL
// today; swap to a custom CDN domain later by changing this env var only.
export function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_R2_PUBLIC_BASE_URL is not set.");
  return `${base.replace(/\/$/, "")}/${path}`;
}
