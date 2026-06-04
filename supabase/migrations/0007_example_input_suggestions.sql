-- ============================================================
-- Extend option_suggestions to also store reusable example-input image URLs.
-- ============================================================

alter table public.option_suggestions drop constraint if exists option_suggestions_kind_check;
alter table public.option_suggestions add constraint option_suggestions_kind_check
  check (kind in ('warning', 'required_upload', 'example_input'));
