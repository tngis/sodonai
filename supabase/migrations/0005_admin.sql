-- ============================================================
-- aistudio.mn — Admin panel support
-- ------------------------------------------------------------
-- * is_admin flag on users (grant via SQL: update public.users set is_admin = true where ...)
-- * is_active flags so the catalog can be managed without deleting rows
-- * public `examples` bucket for admin-managed preset sample images
-- All admin writes go through the service-role client after an is_admin check,
-- so no table write policies are needed here.
-- ============================================================

-- ── Admin flag ──────────────────────────────────────────────
alter table public.users add column if not exists is_admin boolean not null default false;

-- SECURITY: the "users: owner read/write" RLS policy lets a user update their own
-- row. Without this, a user could self-grant admin via the client API. Column-level
-- privilege revoke blocks writing is_admin from client roles; the service-role client
-- (admin server actions) and the signup trigger (security definer) are unaffected.
revoke insert (is_admin) on public.users from authenticated, anon;
revoke update (is_admin) on public.users from authenticated, anon;

-- ── Active flags for catalog management ─────────────────────
alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.presets    add column if not exists is_active boolean not null default true;

-- ── Recreate the public view to expose is_active ────────────
-- (still excludes internal_prompt and ai_model — never sent to the client).
drop view if exists public.presets_public;
create view public.presets_public
  with (security_invoker = true)
as
  select
    id, category_id, name_mn, name_en, output_ratio, steps,
    price_mnt, eta_min, warnings_mn, example_output, example_inputs,
    options, required_uploads, sort_order, is_active, created_at
  from public.presets;

-- Recreating the view drops its grants; restore public read access.
grant select on public.presets_public to anon, authenticated;

-- ── Public bucket for preset example images ─────────────────
-- Public read (served via public URL); writes happen via the service-role
-- client in admin server actions (bypasses RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('examples', 'examples', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "examples: public read" on storage.objects;
create policy "examples: public read"
  on storage.objects for select
  using (bucket_id = 'examples');
