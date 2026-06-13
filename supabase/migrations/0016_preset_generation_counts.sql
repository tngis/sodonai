-- ============================================================
-- preset_generation_counts — public popularity signal per preset
-- ------------------------------------------------------------
-- The landing page features the most-generated presets overall (Top N).
-- "Generated" = a generation that actually produced output (status='done').
-- The count comes from generations joined to orders (orders holds preset_id).
--
-- generations/orders are owner-scoped via RLS, so the cookieless anon client
-- the catalog uses cannot aggregate across users. This view is intentionally
-- SECURITY DEFINER (security_invoker = false) so it can count across ALL users
-- — but it exposes ONLY the per-preset count, never any row-level or user data.
-- (Contrast presets_public, which stays security_invoker = true precisely
-- because it could otherwise leak sensitive columns; here there is nothing
-- sensitive to leak.)
-- ============================================================

-- Index the FK column the aggregate joins on (Postgres doesn't add it for FKs).
create index if not exists generations_order_idx
  on public.generations (order_id);

create or replace view public.preset_generation_counts
  with (security_invoker = false)
as
  select o.preset_id, count(*)::int as generation_count
  from public.generations g
  join public.orders o on o.id = g.order_id
  where g.status = 'done'
    and o.preset_id is not null
  group by o.preset_id;

grant select on public.preset_generation_counts to anon, authenticated;
