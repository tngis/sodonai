-- ============================================================
-- Category icons are now Lucide icon names (e.g. 'users'), not emoji.
-- Convert the seeded emoji values; unknown/custom values are left as-is and
-- render a generic glyph (see resolveCategoryIcon in category-icon.tsx).
-- ============================================================

update public.categories set icon = 'users'    where icon = '👨‍👩‍👧‍👦';
update public.categories set icon = 'image'     where icon = '🖼️';
update public.categories set icon = 'palette'   where icon = '🎨';
update public.categories set icon = 'sparkles'  where icon = '✨';
