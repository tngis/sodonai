-- ============================================================
-- aistudio.mn — Print order audit log
-- ------------------------------------------------------------
-- Records who changed a print order's production/delivery status or admin note,
-- when, and the before→after values. Meaningful now that fulfillment is shared
-- between `admin` and `order_manager` staff (see 0023_user_roles).
--
-- actor_name is denormalized so history survives a renamed/deleted staff user.
-- Written + read ONLY through the service-role admin client; RLS is enabled with
-- no policies, so anon/authenticated can neither read nor write it.
-- ============================================================

create table public.print_order_events (
  id              uuid primary key default gen_random_uuid(),
  print_order_id  uuid not null references public.print_orders(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  actor_id        uuid references public.users(id) on delete set null,
  actor_name      text,
  field           text not null check (field in ('production', 'delivery', 'note')),
  from_value      text,
  to_value        text,
  created_at      timestamptz not null default now()
);

alter table public.print_order_events enable row level security;

create index print_order_events_print_idx
  on public.print_order_events (print_order_id, created_at desc);
