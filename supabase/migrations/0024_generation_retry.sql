-- ============================================================
-- aistudio.mn — Generation retry + payment reconcile support
-- ------------------------------------------------------------
-- * generations.attempt: increments each time an admin re-runs a failed
--   generation. Makes the wallet refund/recharge idempotency keys
--   attempt-aware so the money invariant (charged iff a result was
--   delivered) holds across any number of retries.
-- * payments index: speeds up the reconcile sweep that finds still-pending
--   payments (a confirmed-but-abandoned QPay invoice would otherwise leave
--   the order stuck on `pending` forever).
-- ============================================================

alter table public.generations
  add column if not exists attempt int not null default 0;

create index if not exists payments_status_created_idx
  on public.payments (status, created_at);
