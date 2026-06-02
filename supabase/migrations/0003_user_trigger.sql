-- ============================================================
-- aistudio.mn — auto-create public.users on auth sign-up
-- ============================================================
-- Supabase creates auth.users on sign-up but not public.users.
-- This trigger bridges the gap so orders.user_id FK never fails.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone, name)
  values (
    new.id,
    coalesce(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Backfill existing auth users who have no public.users row yet
insert into public.users (id, phone, name)
select
  id,
  coalesce(phone, ''),
  coalesce(raw_user_meta_data->>'name', null)
from auth.users
on conflict (id) do nothing;
