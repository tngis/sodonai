-- Rewrite `examples` bucket image URLs from Supabase public URLs to the R2
-- public base. The `examples` bucket stores FULL URLs in the DB (unlike
-- uploads/outputs which store relative paths), so the dual-read fallback does
-- not cover these rows — this rewrite is required at cutover.
--
-- The object key (<uuid>.<ext>) is identical in both, so we only swap the prefix.
--
-- BEFORE RUNNING: replace `https://pub-de6aef11c4df4bdc90ba500af0f82768.r2.dev/` below with your real R2
-- public base (the value you put in NEXT_PUBLIC_R2_PUBLIC_BASE_URL).
-- The Supabase prefix is already filled in for project aecvsvhbhvofognnsgdu.
--
-- Run inside a transaction; inspect the affected rows before COMMIT.

begin;

update presets
set example_output = replace(
  example_output,
  'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/',
  'https://pub-de6aef11c4df4bdc90ba500af0f82768.r2.dev/'
)
where example_output like 'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/%';

update presets
set example_before = replace(
  example_before,
  'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/',
  'https://pub-de6aef11c4df4bdc90ba500af0f82768.r2.dev/'
)
where example_before like 'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/%';

update categories
set image_url = replace(
  image_url,
  'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/',
  'https://pub-de6aef11c4df4bdc90ba500af0f82768.r2.dev/'
)
where image_url like 'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/%';

-- example_inputs is a text[] array of full examples URLs. Swap the prefix on the
-- text representation and cast back (array structure is preserved).
update presets
set example_inputs = replace(
  example_inputs::text,
  'https://aecvsvhbhvofognnsgdu.supabase.co/storage/v1/object/public/examples/',
  'https://pub-de6aef11c4df4bdc90ba500af0f82768.r2.dev/'
)::text[]
where example_inputs::text like '%supabase.co%examples%';

-- Sanity check — should now show pub-xxxx.r2.dev URLs and zero remaining
-- supabase.co/...examples URLs:
--   select count(*) from presets    where example_output       like '%supabase.co%examples%';
--   select count(*) from presets    where example_before       like '%supabase.co%examples%';
--   select count(*) from presets    where example_inputs::text like '%supabase.co%examples%';
--   select count(*) from categories where image_url            like '%supabase.co%examples%';

commit;
