-- ============================================================
-- Mirror auth.users.email into public.users so the admin panel can
-- show / search customer email without calling the Auth admin API
-- (listUsers) — which fetches every user on every page load.
-- ============================================================

alter table public.users add column if not exists email text;

-- Recreate the sign-up trigger to also copy the email.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone, name, email)
  values (
    new.id,
    coalesce(new.phone, ''),
    coalesce(new.raw_user_meta_data->>'name', null),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Keep email in sync when it changes in auth.users.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute procedure public.handle_auth_user_email_change();

-- Backfill existing rows.
update public.users u
set email = a.email
from auth.users a
where a.id = u.id and u.email is distinct from a.email;
