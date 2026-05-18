-- Fix for signup failures: "Database error creating/saving new user" (unexpected_failure)
-- Run in Supabase SQL Editor on the same project used by the app.
--
-- This recreates `public.handle_new_user` as SECURITY DEFINER with a safe search_path
-- and supports both schemas:
-- 1) profiles has only identity columns
-- 2) profiles still has balance/initial_balance columns

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_balance boolean;
  has_initial_balance boolean;
  role_value text;
  name_value text;
  balance_value numeric(14, 2);
  initial_balance_value numeric(14, 2);
begin
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'balance'
    ),
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'initial_balance'
    )
  into has_balance, has_initial_balance;

  role_value := case
    when lower(coalesce(new.raw_user_meta_data ->> 'role', 'student')) = 'teacher'
      then 'teacher'
    else 'student'
  end;

  name_value := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );

  balance_value := coalesce(
    nullif(new.raw_user_meta_data ->> 'balance', '')::numeric,
    100000
  );

  initial_balance_value := coalesce(
    nullif(new.raw_user_meta_data ->> 'initialBalance', '')::numeric,
    balance_value
  );

  if has_balance and has_initial_balance then
    insert into public.profiles (
      user_id,
      email,
      name,
      role,
      balance,
      initial_balance
    )
    values (
      new.id,
      new.email,
      name_value,
      role_value,
      balance_value,
      initial_balance_value
    )
    on conflict (user_id) do update
    set
      email = excluded.email,
      name = excluded.name,
      role = excluded.role,
      balance = excluded.balance,
      initial_balance = excluded.initial_balance;
  else
    insert into public.profiles (
      user_id,
      email,
      name,
      role
    )
    values (
      new.id,
      new.email,
      name_value,
      role_value
    )
    on conflict (user_id) do update
    set
      email = excluded.email,
      name = excluded.name,
      role = excluded.role;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

commit;

