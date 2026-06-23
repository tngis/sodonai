-- ============================================================
-- Public share links — the "post to Facebook" viral loop
-- ------------------------------------------------------------
-- A user can turn one of their generations into a public page at
-- /s/{share_token}. That page carries OpenGraph tags whose og:image is a
-- BRANDED card (stored in the public `examples` bucket), so a Facebook/Messenger
-- link post shows a real preview and clicking it deep-links back into the app
-- with a "make one too" call to action.
--
-- The token is opaque (not the generation UUID) so the public URL never leaks an
-- internal id. generations stays owner-scoped under RLS — the public /s page
-- reads it through the service-role/admin client (image + preset name only, the
-- same "nothing sensitive to leak" reasoning as getPublicShowcase). So no new
-- public RLS policy is added here.
-- ============================================================

alter table public.generations
  add column if not exists share_token text unique;

-- Lookup path for the public page: token → generation.
create index if not exists generations_share_token_idx
  on public.generations (share_token)
  where share_token is not null;
