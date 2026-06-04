-- ============================================================
-- Saved quick-select options for the admin preset form
-- ------------------------------------------------------------
-- Persists the warning / required-upload chips admins reuse across presets.
-- Only the service-role admin client reads/writes these (RLS on, no client policy).
-- ============================================================

create table if not exists public.option_suggestions (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('warning', 'required_upload')),
  value      text not null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

alter table public.option_suggestions enable row level security;
