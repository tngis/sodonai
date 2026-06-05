-- ============================================================
-- Allow categories to use an uploaded image instead of an emoji icon.
-- image_url is optional; when null the UI falls back to the emoji icon.
-- ============================================================

alter table public.categories add column if not exists image_url text;
