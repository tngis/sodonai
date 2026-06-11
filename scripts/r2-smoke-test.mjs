// Quick R2 connectivity check — run BEFORE migrating real data.
// Verifies credentials, bucket names, and write/read/presign/delete on each
// bucket, plus the public URL for `examples`. CORS is browser-only, so it is
// NOT covered here (test download/share in the app for that).
//
// Run:  node --env-file=.env scripts/r2-smoke-test.mjs
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_UPLOADS_BUCKET = "uploads",
  R2_OUTPUTS_BUCKET = "outputs",
  R2_EXAMPLES_BUCKET = "examples",
  NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
} = process.env;

for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY })) {
  if (!v) { console.error(`✗ ${k} is not set in .env`); process.exit(1); }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const Key = `__smoke-test__/${Date.now()}.txt`;
const Body = new TextEncoder().encode("r2 smoke test ok");
let failed = false;

async function check(label, bucket, { isPublic = false } = {}) {
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType: "text/plain" }));
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }));

    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key }), { expiresIn: 60 });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`presigned GET returned ${res.status}`);

    let publicNote = "";
    if (isPublic && NEXT_PUBLIC_R2_PUBLIC_BASE_URL) {
      const pub = `${NEXT_PUBLIC_R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${Key}`;
      const pres = await fetch(pub);
      publicNote = pres.ok ? "  public✓" : `  public✗(${pres.status})`;
      if (!pres.ok) failed = true;
    } else if (isPublic) {
      publicNote = "  (NEXT_PUBLIC_R2_PUBLIC_BASE_URL not set — public not checked)";
    }

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
    console.log(`✓ ${label} (${bucket})  put/head/presign/delete OK${publicNote}`);
  } catch (e) {
    failed = true;
    console.error(`✗ ${label} (${bucket})  ${e.name}: ${e.message}`);
  }
}

console.log(`Endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com\n`);
await check("uploads", R2_UPLOADS_BUCKET);
await check("outputs", R2_OUTPUTS_BUCKET);
await check("examples", R2_EXAMPLES_BUCKET, { isPublic: true });

console.log(failed ? "\nSome checks failed — fix before migrating." : "\nAll good ✅ — ready to copy data.");
process.exit(failed ? 1 : 0);
