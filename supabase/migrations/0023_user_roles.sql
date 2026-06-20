-- ============================================================
-- aistudio.mn — User roles (RBAC)
-- ------------------------------------------------------------
-- Replaces the binary `is_admin` flag with a `role` enum so staff
-- access can be scoped. `order_manager` handles print/order fulfillment
-- only (the Захиалга tab); `admin` keeps full access. Normal accounts
-- are `user`.
--
-- `is_admin` is intentionally LEFT IN PLACE for now and dropped in a
-- later migration once all code reads `role` (see auth-admin.ts).
-- ============================================================

create type public.user_role as enum ('user', 'order_manager', 'admin');

alter table public.users
  add column if not exists role public.user_role not null default 'user';

-- Backfill: existing admins keep full access.
update public.users set role = 'admin' where is_admin = true;

-- SECURITY: mirror the is_admin protection. The "users: owner read/write" RLS
-- policy lets a user update their own row, so without this a user could
-- self-grant a staff role via the client API. Column-level revoke blocks
-- writing `role` from client roles; the service-role client (admin server
-- actions) and the signup trigger (security definer) are unaffected.
revoke insert (role) on public.users from authenticated, anon;
revoke update (role) on public.users from authenticated, anon;
