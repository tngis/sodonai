-- ============================================================
-- aistudio.mn — Physical print orders ("Боднор авах")
-- ------------------------------------------------------------
-- Reuses the existing orders + payments + QPay machinery via an
-- order_kind discriminator, so revenue/admin/payment-polling stay unified.
-- Adds saved delivery addresses and per-order production/delivery tracking.
-- Frame/size catalog lives in code (src/lib/print-catalog.ts), not the DB.
-- ============================================================

-- ── Order kind discriminator ────────────────────────────────
create type public.order_kind as enum ('generation','print');

alter table public.orders
  add column if not exists kind public.order_kind not null default 'generation';

-- Print orders have no preset
alter table public.orders alter column preset_id drop not null;

-- ── Fulfillment status enums ────────────────────────────────
create type public.print_production_status as enum ('pending','printing','framing','ready');
create type public.print_delivery_status   as enum ('pending','shipping','delivered');

-- ============================================================
-- addresses — saved delivery addresses (owner-managed)
-- ============================================================
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  label       text,                         -- "Гэр", "Ажил"
  recipient   text not null,                -- хүлээн авагч
  phone       text not null,
  city        text not null,                -- аймаг/хот
  district    text,                         -- дүүрэг/сум
  khoroo      text,                         -- хороо/баг
  detail      text not null,                -- байр, орц, тоот
  note        text,                         -- нэмэлт тэмдэглэл (заавар)
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.addresses enable row level security;

create policy "addresses: owner read"
  on public.addresses for select using (auth.uid() = user_id);
create policy "addresses: owner insert"
  on public.addresses for insert with check (auth.uid() = user_id);
create policy "addresses: owner update"
  on public.addresses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "addresses: owner delete"
  on public.addresses for delete using (auth.uid() = user_id);

-- ============================================================
-- print_orders — print-specific detail for a print-kind order
-- ============================================================
create table public.print_orders (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  asset_storage_path  text not null,        -- chosen image (outputs bucket path)
  frame_id            text not null,        -- from print-catalog config
  size_id             text not null,        -- from print-catalog config
  -- Address snapshot — immutable even if the saved address is later edited/deleted
  ship_recipient      text not null,
  ship_phone          text not null,
  ship_address        text not null,        -- formatted full address
  production_status   public.print_production_status not null default 'pending',
  delivery_status     public.print_delivery_status   not null default 'pending',
  admin_note          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.print_orders enable row level security;

-- Owners can read their own and create them (during checkout). All status
-- writes happen through the service-role client in admin server actions.
create policy "print_orders: owner read"
  on public.print_orders for select using (auth.uid() = user_id);
create policy "print_orders: owner insert"
  on public.print_orders for insert with check (auth.uid() = user_id);

create trigger set_updated_at_print_orders
  before update on public.print_orders
  for each row execute function public.set_updated_at();
