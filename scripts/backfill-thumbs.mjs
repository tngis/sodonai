#!/usr/bin/env node
//
// One-time backfill: generate WebP thumbnails for gallery assets that have
// thumb_path = NULL (all rows that existed before migration 0022, or where
// thumbnail generation failed).
//
// Idempotent: only processes assets where thumb_path IS NULL. Safe to re-run.
//
// Required env vars (same as the app's .env):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_OUTPUTS_BUCKET   (optional, default "outputs")
//
// Usage (from the project root):
//   node --env-file=.env scripts/backfill-thumbs.mjs
//   # or: export the env vars, then: node scripts/backfill-thumbs.mjs
//
// Parallelism: CONCURRENCY (default 5) controls simultaneous R2 operations.

import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const OUTPUTS_BUCKET = process.env.R2_OUTPUTS_BUCKET ?? "outputs";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? "5");
const PAGE_SIZE = 100;

// ── Validate env ────────────────────────────────────────────────────────────
for (const [name, val] of [
  ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY],
  ["R2_ACCOUNT_ID", R2_ACCOUNT_ID],
  ["R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID],
  ["R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY],
]) {
  if (!val) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function processAsset(asset) {
  const { id, storage_path } = asset;
  const thumbKey = storage_path.replace(/(\.[^.]+)$/, "_thumb.webp");

  // Fetch the full image from R2
  const getRes = await r2.send(
    new GetObjectCommand({ Bucket: OUTPUTS_BUCKET, Key: storage_path }),
  );
  const inputBuf = await streamToBuffer(getRes.Body);

  // Resize + encode to WebP — same params as storeThumbFile in storage.ts
  const webp = await sharp(inputBuf, { failOn: "none" })
    .rotate()
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();

  // Store thumbnail in R2
  await r2.send(
    new PutObjectCommand({
      Bucket: OUTPUTS_BUCKET,
      Key: thumbKey,
      Body: webp,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  // Update the DB row
  const { error } = await supabase
    .from("assets")
    .update({ thumb_path: thumbKey })
    .eq("id", id);
  if (error) throw new Error(`DB update failed for ${id}: ${error.message}`);

  return thumbKey;
}

async function runBatch(items) {
  const results = { ok: 0, failed: 0 };
  // Process at most CONCURRENCY items at a time
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const slice = items.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (asset) => {
        try {
          const thumbKey = await processAsset(asset);
          console.log(`  ✓ ${asset.storage_path} → ${thumbKey}`);
          results.ok++;
        } catch (err) {
          console.error(`  ✗ ${asset.storage_path}: ${err.message}`);
          results.failed++;
        }
      }),
    );
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────
let page = 0;
let total = { ok: 0, failed: 0 };

console.log(
  `Backfilling thumbnails (bucket: ${OUTPUTS_BUCKET}, concurrency: ${CONCURRENCY})`,
);

while (true) {
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, storage_path")
    .is("thumb_path", null)
    .order("created_at", { ascending: true })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  if (!assets?.length) break;

  console.log(`\nPage ${page + 1}: ${assets.length} asset(s)`);
  const batch = await runBatch(assets);
  total.ok += batch.ok;
  total.failed += batch.failed;
  page++;
}

console.log(`\nDone. ✓ ${total.ok} succeeded · ✗ ${total.failed} failed`);
if (total.failed > 0) process.exit(1);
