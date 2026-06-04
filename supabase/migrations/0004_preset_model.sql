-- ============================================================
-- Per-preset AI model configuration
-- ------------------------------------------------------------
-- Each preset can use a different AI model. This is a "model internal":
-- it is configured at data-entry time (seed / admin), never chosen by the
-- end user, and is NEVER exposed to the client (excluded from presets_public,
-- which lists its columns explicitly, so these new columns are not surfaced).
-- ============================================================

-- ai_model: identifier of the model to use (e.g. 'flux-kontext', 'restore-v1').
--           NULL falls back to AI_DEFAULT_MODEL in the app.
alter table public.presets add column if not exists ai_model text;

-- Seed placeholder model identifiers for the existing presets.
-- TODO: replace these with your real model identifiers at data-entry time.
update public.presets set ai_model = 'face-preserve-v1' where id in ('fam-3p','fam-2p','bg-id','bg-studio','port-retouch');
update public.presets set ai_model = 'restore-v1'       where id = 'rest-basic';
update public.presets set ai_model = 'colorize-v1'      where id = 'rest-color';
