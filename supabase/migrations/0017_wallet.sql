-- ============================================================
-- aistudio.mn — Wallet (₮ balance) + QPay top-ups
-- ------------------------------------------------------------
-- Adds a money wallet so users can pay for generations from a
-- prepaid ₮ balance (default) or QPay. The balance is real money,
-- 1:1 with MNT (1 ₮ = 1 unit), so it lines up exactly with
-- orders.amount_mnt / preset price_mnt and refunds are trivial.
--
-- Design (double-entry-style, audit-friendly):
--   * wallets             — one row per user; cached balance to lock on.
--   * wallet_transactions — immutable ledger (+credit / −debit), one row
--                           per movement, idempotency_key UNIQUE.
--   * wallet_topups       — QPay top-up intents; reuse QPay polling, the
--                           "fulfillment" is a wallet credit.
--
-- All balance mutations go through wallet_credit / wallet_debit
-- (SECURITY DEFINER): atomic (row lock), idempotent (idempotency_key),
-- and guarded against negative balance. The app never writes the
-- balance directly — RLS grants owners read-only, writes happen via
-- these functions (called with the service-role/admin client).
-- ============================================================

-- ── New payment provider + ledger entry type ────────────────
-- NOTE: a freshly added enum value can't be USED in the same
-- transaction it's added in. We only add it here and reference it at
-- runtime (app inserts), so this is safe.
alter type public.payment_provider add value if not exists 'wallet';

create type public.wallet_txn_type as enum ('topup','spend','refund','adjustment');

-- ============================================================
-- wallets — per-user cached balance (the row we lock for atomicity)
-- ============================================================
create table public.wallets (
  user_id     uuid primary key references public.users(id) on delete cascade,
  balance_mnt int  not null default 0 check (balance_mnt >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.wallets enable row level security;

-- Owners may read their balance. There is intentionally NO insert/update
-- policy: balance only ever changes through the SECURITY DEFINER functions
-- below (or the service-role client), never via a direct client write.
create policy "wallets: owner read"
  on public.wallets for select using (auth.uid() = user_id);

-- ============================================================
-- wallet_transactions — immutable ledger of every balance movement
-- ============================================================
create table public.wallet_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  amount_mnt      int  not null,            -- + credit (topup/refund), − debit (spend)
  balance_after   int  not null,            -- balance snapshot for history display
  type            public.wallet_txn_type not null,
  order_id        uuid references public.orders(id)   on delete set null,
  payment_id      uuid references public.payments(id) on delete set null,
  idempotency_key text not null unique,     -- e.g. spend:{orderId}, refund:{generationId}, topup:{topUpId}
  note            text,
  created_at      timestamptz not null default now()
);

alter table public.wallet_transactions enable row level security;

create policy "wallet_transactions: owner read"
  on public.wallet_transactions for select using (auth.uid() = user_id);

-- History list: a user's entries, newest first.
create index wallet_transactions_user_idx
  on public.wallet_transactions (user_id, created_at desc);

-- ============================================================
-- wallet_topups — QPay top-up intents (no order; credits the wallet)
-- ============================================================
create table public.wallet_topups (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  qpay_invoice_id text,
  amount_mnt      int  not null check (amount_mnt > 0),
  status          public.payment_status not null default 'pending',
  credited_at     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.wallet_topups enable row level security;

create policy "wallet_topups: owner read"
  on public.wallet_topups for select using (auth.uid() = user_id);
create policy "wallet_topups: owner insert"
  on public.wallet_topups for insert with check (auth.uid() = user_id);

create index wallet_topups_user_idx
  on public.wallet_topups (user_id, created_at desc);

-- ============================================================
-- wallet_credit — add funds (topup / refund / positive adjustment)
-- ------------------------------------------------------------
-- Idempotent on p_idempotency_key: calling twice with the same key is a
-- no-op that returns the already-posted balance. Locks the wallet row so
-- concurrent movements serialize.
-- ============================================================
create or replace function public.wallet_credit(
  p_user            uuid,
  p_amount          int,
  p_type            public.wallet_txn_type,
  p_idempotency_key text,
  p_order           uuid default null,
  p_payment         uuid default null,
  p_note            text default null
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance int;
begin
  if p_amount <= 0 then
    raise exception 'wallet_credit: amount must be positive (got %)', p_amount;
  end if;

  -- Ensure the wallet exists, then take a row lock to serialize movements.
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  perform 1 from public.wallets where user_id = p_user for update;

  -- Idempotency: re-check AFTER the lock so a racing duplicate sees the
  -- committed row and returns its snapshot instead of double-posting.
  select balance_after into v_balance
    from public.wallet_transactions where idempotency_key = p_idempotency_key;
  if found then
    return v_balance;
  end if;

  update public.wallets
     set balance_mnt = balance_mnt + p_amount, updated_at = now()
   where user_id = p_user
   returning balance_mnt into v_balance;

  insert into public.wallet_transactions
    (user_id, amount_mnt, balance_after, type, order_id, payment_id, idempotency_key, note)
  values
    (p_user, p_amount, v_balance, p_type, p_order, p_payment, p_idempotency_key, p_note);

  return v_balance;
end;
$$;

-- ============================================================
-- wallet_debit — spend funds (spend / negative adjustment)
-- ------------------------------------------------------------
-- Idempotent on p_idempotency_key. Raises 'insufficient_funds' (SQLSTATE
-- P0001) when the balance is too low — callers map this to a friendly,
-- "top up or use QPay" path. Locks the wallet row for atomicity.
-- ============================================================
create or replace function public.wallet_debit(
  p_user            uuid,
  p_amount          int,
  p_type            public.wallet_txn_type,
  p_idempotency_key text,
  p_order           uuid default null,
  p_payment         uuid default null,
  p_note            text default null
) returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance  int;
  v_existing int;
begin
  if p_amount <= 0 then
    raise exception 'wallet_debit: amount must be positive (got %)', p_amount;
  end if;

  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance_mnt into v_balance from public.wallets where user_id = p_user for update;

  -- Idempotency: re-check AFTER the lock so a racing duplicate sees the
  -- committed row and returns its snapshot instead of double-spending.
  select balance_after into v_existing
    from public.wallet_transactions where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient_funds' using errcode = 'P0001';
  end if;

  update public.wallets
     set balance_mnt = balance_mnt - p_amount, updated_at = now()
   where user_id = p_user
   returning balance_mnt into v_balance;

  insert into public.wallet_transactions
    (user_id, amount_mnt, balance_after, type, order_id, payment_id, idempotency_key, note)
  values
    (p_user, -p_amount, v_balance, p_type, p_order, p_payment, p_idempotency_key, p_note);

  return v_balance;
end;
$$;

-- Functions run as the definer (postgres); they must not be callable by the
-- anon/authenticated (browser) clients. Revoke the default PUBLIC execute grant
-- so only the service-role/admin client (which the server uses) can invoke them.
revoke all on function public.wallet_credit(uuid,int,public.wallet_txn_type,text,uuid,uuid,text) from public;
revoke all on function public.wallet_debit (uuid,int,public.wallet_txn_type,text,uuid,uuid,text) from public;
grant execute on function public.wallet_credit(uuid,int,public.wallet_txn_type,text,uuid,uuid,text) to service_role;
grant execute on function public.wallet_debit (uuid,int,public.wallet_txn_type,text,uuid,uuid,text) to service_role;

-- ============================================================
-- Auto-create a wallet row when a user is created, and backfill
-- existing users. (Mirrors handle_new_auth_user in 0003; the credit/
-- debit functions also lazily create the row, so this is belt-and-braces.)
-- ============================================================
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_user_created_wallet on public.users;
create trigger on_user_created_wallet
  after insert on public.users
  for each row execute function public.handle_new_user_wallet();

insert into public.wallets (user_id)
select id from public.users
on conflict (user_id) do nothing;
