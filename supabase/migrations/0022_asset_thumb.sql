-- Add a nullable thumbnail path to gallery assets.
-- NULL means no thumbnail yet (existing rows, or a failed thumb generation).
-- Callers fall back to storage_path (full image) when thumb_path IS NULL.
alter table public.assets add column if not exists thumb_path text;
