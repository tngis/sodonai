-- ============================================================
-- Let admins choose how a preset's example output is shown:
--   'single'        → one example image
--   'before_after'  → draggable before/after comparison slider
-- example_output stays the main / "after" image; example_before holds
-- the "before" image used only in before_after mode.
-- ============================================================

alter table public.presets add column if not exists example_type text not null default 'single';
alter table public.presets add column if not exists example_before text;

-- Backfill existing behaviour: the category page previously rendered a
-- before/after slider whenever a preset had exactly one example input
-- (using that input as the "before"). Preserve that for old data.
update public.presets
set example_type = 'before_after',
    example_before = example_inputs[1]
where coalesce(array_length(example_inputs, 1), 0) = 1
  and example_type = 'single';

-- Recreate the public view to expose the new columns
-- (still excludes internal_prompt and ai_model).
drop view if exists public.presets_public;
create view public.presets_public
  with (security_invoker = true)
as
  select
    id, category_id, name_mn, name_en, description_mn, description_en,
    output_ratio, steps, price_mnt, eta_min, warnings_mn,
    example_output, example_before, example_type,
    example_inputs, options, required_uploads, required_min, required_max,
    sort_order, is_active, created_at
  from public.presets;

grant select on public.presets_public to anon, authenticated;
