// Dump the live DB's categories + presets into ../../data/categories/<id>.json,
// matching the existing seed-file format (one file per category, presets nested).
//
// Run from aistudio/:
//   node --env-file=.env.local scripts/dump-categories.mjs
//
// Reads via the service-role key (so internal_prompt and example_output_prompt
// are included — these files are the admin seed source). This OVERWRITES the
// files under data/categories/ with whatever is currently in the DB.
import { writeFileSync, readdirSync } from "node:fs";
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

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "categories");

// Build a preset object in the exact field order the existing files use.
// Omits category_id (implied by file), created_at and public_discount_pct
// (not present in the seed files).
function shapePreset(p) {
  return {
    id: p.id,
    name_mn: p.name_mn,
    name_en: p.name_en,
    description_mn: p.description_mn,
    description_en: p.description_en,
    output_ratio: p.output_ratio,
    steps: p.steps,
    price_mnt: p.price_mnt,
    eta_min: p.eta_min,
    ai_model: p.ai_model,
    internal_prompt: p.internal_prompt,
    example_output_prompt: p.example_output_prompt,
    example_output: p.example_output,
    example_type: p.example_type,
    example_before: p.example_before,
    example_inputs: p.example_inputs ?? [],
    warnings_mn: p.warnings_mn ?? [],
    options: p.options ?? null,
    required_uploads: p.required_uploads ?? null,
    required_min: p.required_min,
    required_max: p.required_max,
    sort_order: p.sort_order,
    is_active: p.is_active,
  };
}

function shapeCategory(c, presets) {
  const out = {
    id: c.id,
    name_mn: c.name_mn,
    name_en: c.name_en,
    description_mn: c.description_mn,
    description_en: c.description_en,
    icon: c.icon,
    image_url: c.image_url ?? null,
    sort_order: c.sort_order,
  };
  // Include aspect_ratio only if the column exists in the DB row.
  if ("aspect_ratio" in c) out.aspect_ratio = c.aspect_ratio ?? null;
  out.presets = presets;
  return out;
}

const [catsRes, presetsRes] = await Promise.all([
  sb.from("categories").select("*").order("sort_order"),
  sb.from("presets").select("*").order("sort_order"),
]);
if (catsRes.error) throw new Error(`categories: ${catsRes.error.message}`);
if (presetsRes.error) throw new Error(`presets: ${presetsRes.error.message}`);

const categories = catsRes.data;
const presets = presetsRes.data;

const existingFiles = new Set(readdirSync(outDir).filter((f) => f.endsWith(".json")));
const writtenFiles = new Set();

for (const cat of categories) {
  const catPresets = presets
    .filter((p) => p.category_id === cat.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(shapePreset);
  const obj = shapeCategory(cat, catPresets);
  const file = `${cat.id}.json`;
  writeFileSync(join(outDir, file), JSON.stringify(obj, null, 2) + "\n");
  writtenFiles.add(file);
  console.log(`✓ ${file}  (${catPresets.length} presets, aspect_ratio=${obj.aspect_ratio ?? "n/a"})`);
}

const stale = [...existingFiles].filter((f) => !writtenFiles.has(f));
if (stale.length) {
  console.log(`\n⚠ Files with no matching DB category (left untouched): ${stale.join(", ")}`);
}
console.log(`\nDone. ${writtenFiles.size} categories written.`);
