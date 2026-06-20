-- ============================================================
-- aistudio.mn — Admin order list view (server-side search/pagination)
-- ------------------------------------------------------------
-- Flattens orders + customer + preset + print detail + latest generation into
-- one row per order, with a precomputed lowercased `search` haystack, so the
-- admin orders page can filter/search/paginate in SQL instead of shipping ~500
-- rows (and signing every print thumbnail) to the browser.
--
-- Read ONLY through the service-role admin client. security_invoker = true means
-- it runs with the caller's RLS (defense in depth), and grants are revoked from
-- anon/authenticated so it is never reachable via the public PostgREST API.
-- ============================================================

create or replace view public.admin_order_list
  with (security_invoker = true)
as
select
  o.id,
  o.kind,
  o.status,
  o.amount_mnt,
  o.created_at,
  o.user_id,
  o.preset_id,
  pr.name_mn          as preset_name,
  u.name              as customer_name,
  u.phone             as customer_phone,
  u.email             as customer_email,
  po.id               as print_id,
  po.frame_id,
  po.size_id,
  po.ship_recipient,
  po.ship_phone,
  po.ship_address,
  po.production_status,
  po.delivery_status,
  po.admin_note,
  po.asset_storage_path,
  g.id                as generation_id,
  g.status            as generation_status,
  g.error             as generation_error,
  lower(concat_ws(' ',
    o.id::text, pr.name_mn, u.name, u.phone, u.email,
    po.ship_recipient, po.ship_phone, po.ship_address
  ))                  as search
from public.orders o
  left join public.presets       pr on pr.id = o.preset_id
  left join public.users         u  on u.id  = o.user_id
  left join public.print_orders  po on po.order_id = o.id
  left join lateral (
    select gg.id, gg.status, gg.error
    from public.generations gg
    where gg.order_id = o.id
    order by gg.created_at desc
    limit 1
  ) g on true;

revoke all on public.admin_order_list from anon, authenticated;
