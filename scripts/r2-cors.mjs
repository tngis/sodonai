// Apply a CORS policy to the private R2 buckets (uploads, outputs).
//
// WHY: the browser loads presigned R2 URLs two different ways.
//   - <img>/<Image> tags are NOT subject to CORS — previews work without this.
//   - fetch() IS subject to CORS — saveImageToDevice() fetches the object to
//     build a Blob (for the download + the mobile share-to-Photos sheet).
// With no CORS rule on the bucket, R2 returns no Access-Control-Allow-Origin,
// so the browser blocks that fetch and downloads fail. This sets the rule.
//
// Run:  node --env-file=.env scripts/r2-cors.mjs
//   Extra origins (e.g. a preview deploy) can be passed as args or via
//   R2_CORS_ORIGINS (comma-separated):
//   node --env-file=.env scripts/r2-cors.mjs https://staging.aistudio.mn
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_UPLOADS_BUCKET = "uploads",
  R2_OUTPUTS_BUCKET = "outputs",
  NEXT_PUBLIC_APP_URL = "https://aistudio.mn",
  R2_CORS_ORIGINS = "",
} = process.env;

for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY })) {
  if (!v) { console.error(`✗ ${k} is not set in .env`); process.exit(1); }
}

// localhost for dev + the production app URL, plus any extra origins from
// R2_CORS_ORIGINS and CLI args. De-duped, trailing slashes stripped.
const origins = [
  "http://localhost:3000",
  NEXT_PUBLIC_APP_URL,
  ...R2_CORS_ORIGINS.split(","),
  ...process.argv.slice(2),
]
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
const AllowedOrigins = [...new Set(origins)];

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// GET/HEAD only — the browser never writes to R2 directly (uploads go through
// server actions). A plain fetch(url) GET is a "simple" request, so no custom
// AllowedHeaders are strictly needed, but "*" keeps it future-proof.
const CORSRules = [
  {
    AllowedOrigins,
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["Content-Length", "Content-Type", "Content-Disposition"],
    MaxAgeSeconds: 3600,
  },
];

let failed = false;

async function apply(label, bucket) {
  try {
    await s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules } }));
    const { CORSRules: got } = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    const ok = got?.[0]?.AllowedOrigins?.length === AllowedOrigins.length;
    console.log(`${ok ? "✓" : "✗"} ${label} (${bucket})  CORS set for: ${got?.[0]?.AllowedOrigins?.join(", ")}`);
    if (!ok) failed = true;
  } catch (e) {
    failed = true;
    console.error(`✗ ${label} (${bucket})  ${e.name}: ${e.message}`);
  }
}

console.log(`Endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
console.log(`Origins:  ${AllowedOrigins.join(", ")}\n`);
await apply("uploads", R2_UPLOADS_BUCKET);
await apply("outputs", R2_OUTPUTS_BUCKET);

console.log(failed ? "\nSome buckets failed — check the errors above." : "\nCORS applied ✅ — retry the download in the app.");
process.exit(failed ? 1 : 0);
