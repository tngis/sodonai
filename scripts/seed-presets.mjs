// Seed categories + presets from ../../data/categories/*.json into Supabase.
//
// Run from the aistudio/ folder:
//   node --env-file=.env.local scripts/seed-presets.mjs
//
// Uses upsert, so it is safe to run repeatedly (idempotent).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "categories");
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const { presets, ...category } = JSON.parse(readFileSync(join(dataDir, file), "utf8"));

  const { error: catErr } = await sb.from("categories").upsert(category, { onConflict: "id" });
  if (catErr) throw new Error(`category ${category.id}: ${catErr.message}`);

  const rows = (presets ?? []).map((p) => ({ ...p, category_id: category.id }));
  if (rows.length) {
    const { error: preErr } = await sb.from("presets").upsert(rows, { onConflict: "id" });
    if (preErr) throw new Error(`presets in ${category.id}: ${preErr.message}`);
  }

  console.log(`✓ ${category.id} (${rows.length} presets)`);
}

console.log("Done.");
