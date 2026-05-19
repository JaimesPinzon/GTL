-- Backfill missing rows in public.profiles from auth.users
-- Use this when OAuth/signup created users in auth.users but not in profiles.

begin;

with missing_users as (
  select
    au.id as user_id,
    au.email,
    coalesce(nullif(au.raw_user_meta_data ->> 'name', ''), split_part(coalesce(au.email, ''), '@', 1), '') as name,
    case
      when lower(coalesce(au.raw_user_meta_data ->> 'role', 'student')) = 'teacher' then 'teacher'
      else 'student'
    end as role,
    coalesce(nullif(au.raw_user_meta_data ->> 'balance', '')::numeric, 100000) as balance,
    coalesce(
      nullif(au.raw_user_meta_data ->> 'initialBalance', '')::numeric,
      coalesce(nullif(au.raw_user_meta_data ->> 'balance', '')::numeric, 100000)
    ) as initial_balance
  from auth.users au
  left join public.profiles p
    on p.user_id = au.id
  where p.user_id is null
)
insert into public.profiles (
  user_id,
  email,
  name,
  role,
  balance,
  initial_balance
)
select
  mu.user_id,
  mu.email,
  mu.name,
  mu.role,
  mu.balance,
  mu.initial_balance
from missing_users mu
on conflict (user_id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  balance = excluded.balance,
  initial_balance = excluded.initial_balance;

commit;

