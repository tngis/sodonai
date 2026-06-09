-- ============================================================
-- example_output_prompt: a self-contained prompt used to generate a
-- preset's EXAMPLE output image WITHOUT any reference upload.
-- Derived from internal_prompt but with the "preserve identity from the
-- uploaded photo" clause removed, a "Mongolian faced ..." subject clause
-- prepended, and an aspect-ratio clause appended.
--
-- Like internal_prompt, this is an internal generation prompt and is
-- intentionally NOT exposed through presets_public (the client view lists
-- its columns explicitly, so no view change is required).
-- ============================================================

alter table public.presets add column if not exists example_output_prompt text;
