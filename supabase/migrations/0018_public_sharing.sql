-- ============================================================
-- Public showcase + image sharing controls
-- ------------------------------------------------------------
-- The landing page shows a wall of real user-generated images, but only with
-- explicit consent. Two gates, both OFF by default (privacy-first):
--   1. users.public_sharing_enabled — a global master switch per user.
--   2. assets.is_private = false    — a per-image "share this one" flag.
-- An image is shown publicly iff the user's master switch is on AND that
-- specific asset is not private.
-- ============================================================

-- Master switch. Default off: nothing is ever shown until the user opts in.
alter table public.users
  add column if not exists public_sharing_enabled boolean not null default false;

-- The showcase reads the newest non-private assets across all users (via the
-- admin client, since assets are owner-scoped under RLS). This partial index
-- keeps that read cheap as the gallery grows.
create index if not exists assets_public_idx
  on public.assets (created_at desc)
  where is_private = false;
