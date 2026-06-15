-- ============================================================
-- Public-sharing discount + per-generation price snapshot
-- ------------------------------------------------------------
-- Sharing a generation to the public feed earns a discount on its price. To
-- stop people from generating cheap (shared) and then quietly un-sharing for
-- free, un-sharing later must repay the discount that was consumed.
--
-- Prices can change over time, so the discount must NOT be recomputed at
-- un-share time. We snapshot the full price, the discount applied, the price
-- actually paid, and the share decision onto the generation row at creation,
-- and replay that exact snapshot when the user un-shares.
-- ============================================================

-- Per-preset discount, as a whole percent (0–100). 0 = no sharing discount.
alter table public.presets
  add column if not exists public_discount_pct integer not null default 0
  check (public_discount_pct between 0 and 100);

-- Recreate the public view so the client (catalog) can read the discount to
-- show the cheaper price on the generate screen. internal_prompt/ai_model stay
-- hidden — security_invoker keeps RLS enforced for the caller.
drop view if exists public.presets_public;
create view public.presets_public
  with (security_invoker = true)
as
  select
    id, category_id, name_mn, name_en, description_mn, description_en,
    output_ratio, steps, price_mnt, public_discount_pct, eta_min, warnings_mn,
    example_output, example_before, example_type,
    example_inputs, options, required_uploads, required_min, required_max,
    sort_order, is_active, created_at
  from public.presets;

grant select on public.presets_public to anon, authenticated;

-- Price snapshot captured when the generation is created. Replayed verbatim on
-- un-share, so it must never be recomputed from the (possibly changed) preset.
--   full_price_mnt  — the preset's full price at generation time
--   discount_mnt    — discount earned by sharing (0 if generated private)
--   paid_price_mnt  — what the user actually paid (full - discount)
--   shared_to_feed  — whether the user opted into the public feed at gen time
alter table public.generations
  add column if not exists full_price_mnt integer,
  add column if not exists discount_mnt   integer not null default 0,
  add column if not exists paid_price_mnt integer,
  add column if not exists shared_to_feed boolean not null default false;
