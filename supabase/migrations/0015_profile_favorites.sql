-- ============================================================
-- aistudio.mn — User profile picture + favorite presets
-- ------------------------------------------------------------
-- * users.avatar_url: storage path of the profile picture. Holds an OUTPUTS
--   bucket key — either an uploaded image at {userId}/profile/... or a path
--   reused from the user's own gallery asset. Presigned on read like any other
--   private output (see getOutputUrls / the owner path-prefix check).
-- * favorites: presets a user has starred. Owner-managed, like addresses.
-- ============================================================

-- ── Profile picture ─────────────────────────────────────────
alter table public.users add column if not exists avatar_url text;

-- ============================================================
-- favorites — presets a user marked as favorite (owner-managed)
-- ============================================================
create table if not exists public.favorites (
  user_id    uuid not null references public.users(id) on delete cascade,
  preset_id  text not null references public.presets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, preset_id)
);

alter table public.favorites enable row level security;

create policy "favorites: owner read"
  on public.favorites for select using (auth.uid() = user_id);
create policy "favorites: owner insert"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites: owner delete"
  on public.favorites for delete using (auth.uid() = user_id);

-- Lookup by user, newest first (profile favorites list).
create index if not exists favorites_user_idx
  on public.favorites (user_id, created_at desc);
