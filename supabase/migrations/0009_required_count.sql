-- ============================================================
-- Replace named required-upload slots with a min/max image count.
-- (required_uploads column is kept for legacy data but no longer used.)
-- ============================================================

alter table public.presets add column if not exists required_min int not null default 1;
alter table public.presets add column if not exists required_max int not null default 9;

drop view if exists public.presets_public;
create view public.presets_public
  with (security_invoker = true)
as
  select
    id, category_id, name_mn, name_en, description_mn, description_en,
    output_ratio, steps, price_mnt, eta_min, warnings_mn, example_output,
    example_inputs, options, required_uploads, required_min, required_max,
    sort_order, is_active, created_at
  from public.presets;

grant select on public.presets_public to anon, authenticated;
