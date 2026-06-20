-- ============================================================
-- 0027_catalog_copy_fixes
-- Mongolian copy fixes for admin-managed catalog rows.
--   * res-001 (preset):     typo «зурагийг» → «зургийг», add trailing period
--   * cat-restoration (cat): «Шаргалтсан» → «Шарласан» (standard spelling)
-- Scoped by primary key; safe to run once in numeric order.
-- ============================================================

update public.presets
set description_mn = 'Хуучны урагдаж халцарсан зургийг сэргээж өнгөт болгох.'
where id = 'res-001';

update public.categories
set description_mn = 'Шарласан, бүдгэрсэн, урагдсан зургийг сайжруулах.'
where id = 'cat-restoration';
