-- ============================================================
-- categories.aspect_ratio
-- ------------------------------------------------------------
-- Each category gets the aspect ratio shared by the majority of
-- its presets (the statistical mode of presets.output_ratio).
-- Ties resolve to the lowest value by sort order. NULL when the
-- category has no presets.
-- ============================================================

alter table public.categories
  add column if not exists aspect_ratio text;

update public.categories c
set aspect_ratio = sub.ratio
from (
  select category_id,
         mode() within group (order by output_ratio) as ratio
  from public.presets
  group by category_id
) sub
where c.id = sub.category_id;
