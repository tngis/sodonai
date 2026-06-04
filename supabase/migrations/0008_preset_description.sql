-- ============================================================
-- Add a bilingual description to presets.
-- ============================================================

alter table public.presets add column if not exists description_mn text not null default '';
alter table public.presets add column if not exists description_en text not null default '';

-- Recreate the public view to expose the descriptions (still excludes
-- internal_prompt and ai_model — never sent to the client).
drop view if exists public.presets_public;
create view public.presets_public
  with (security_invoker = true)
as
  select
    id, category_id, name_mn, name_en, description_mn, description_en,
    output_ratio, steps, price_mnt, eta_min, warnings_mn, example_output,
    example_inputs, options, required_uploads, sort_order, is_active, created_at
  from public.presets;

grant select on public.presets_public to anon, authenticated;
