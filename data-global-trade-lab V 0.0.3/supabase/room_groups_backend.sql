-- Room groups architecture for GTL
-- Run this script in Supabase SQL editor after base schema.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

drop function if exists public.is_active_room_member(uuid, uuid);
create function public.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
      and rm.state = 'active'
  );
$$;

drop function if exists public.is_active_room_staff(uuid, uuid);
create function public.is_active_room_staff(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.rooms r
      where r.id = p_room_id
        and r.created_by = p_user_id
    )
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = p_room_id
        and rm.user_id = p_user_id
        and rm.role_in_room in ('teacher', 'monitor')
        and rm.state = 'active'
    );
$$;

drop function if exists public.is_active_group_member(uuid, uuid);
create function public.is_active_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_group_members rgm
    where rgm.group_id = p_group_id
      and rgm.user_id = p_user_id
      and rgm.state = 'active'
  );
$$;

drop function if exists public.can_access_room_groups(uuid, uuid);
create function public.can_access_room_groups(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(public.is_active_room_member(p_room_id, p_user_id), false)
    or exists (
      select 1
      from public.room_group_members rgm
      where rgm.room_id = p_room_id
        and rgm.user_id = p_user_id
        and rgm.state = 'active'
    );
$$;

drop function if exists public.can_manage_room_groups(uuid, uuid);
create function public.can_manage_room_groups(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.is_active_room_staff(p_room_id, p_user_id), false);
$$;

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table if not exists public.room_groups (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null,
  description text default '',
  max_members integer check (max_members is null or max_members > 0),
  state text not null default 'active' check (state in ('active', 'archived', 'deleted')),
  created_by uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_groups_room_idx
  on public.room_groups (room_id, created_at desc);

create index if not exists room_groups_state_idx
  on public.room_groups (room_id, state, updated_at desc);

create table if not exists public.room_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.room_groups (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  state text not null default 'active' check (state in ('active', 'removed')),
  unique (group_id, user_id)
);

create unique index if not exists room_group_members_unique_active_user_per_room
  on public.room_group_members (room_id, user_id)
  where state = 'active';

create unique index if not exists room_group_members_unique_active_user_per_group
  on public.room_group_members (group_id, user_id)
  where state = 'active';

create index if not exists room_group_members_group_idx
  on public.room_group_members (group_id, state, joined_at desc);

-- ---------------------------------------------------------------------------
-- Activity model extensions
-- ---------------------------------------------------------------------------

alter table public.activities
  add column if not exists submission_mode text not null default 'individual'
    check (submission_mode in ('individual', 'group')),
  add column if not exists group_mode text not null default 'none'
    check (group_mode in ('none', 'separate_groups', 'visible_groups')),
  add column if not exists max_group_members integer
    check (max_group_members is null or max_group_members > 0),
  add column if not exists allow_self_enrollment boolean not null default false,
  add column if not exists portfolio_mode text not null default 'individual'
    check (portfolio_mode in ('individual', 'group'));

alter table public.activity_submissions
  add column if not exists room_id uuid references public.rooms (id) on delete cascade,
  add column if not exists group_id uuid references public.room_groups (id) on delete set null,
  add column if not exists submitted_by uuid references public.profiles (user_id) on delete set null;

update public.activity_submissions s
set room_id = a.room_id
from public.activities a
where a.id = s.activity_id
  and s.room_id is null;

alter table public.activity_submissions
  alter column room_id set not null;

update public.activity_submissions
set submitted_by = user_id
where submitted_by is null;

alter table public.activity_submissions
  alter column submitted_by set not null;

alter table public.activity_submissions
  alter column user_id drop not null;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_activity_id_user_id_key;

create unique index if not exists activity_submissions_unique_user_target
  on public.activity_submissions (activity_id, user_id)
  where user_id is not null;

create unique index if not exists activity_submissions_unique_group_target
  on public.activity_submissions (activity_id, group_id)
  where group_id is not null;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_target_check;

alter table public.activity_submissions
  add constraint activity_submissions_target_check
  check (
    (user_id is not null and group_id is null)
    or (user_id is null and group_id is not null)
  );

-- Group grades support (without breaking existing user grades)
alter table public.activity_grades
  add column if not exists group_id uuid references public.room_groups (id) on delete set null;

alter table public.activity_grades
  alter column user_id drop not null;

alter table public.activity_grades
  drop constraint if exists activity_grades_activity_id_user_id_key;

create unique index if not exists activity_grades_unique_user_target
  on public.activity_grades (activity_id, user_id)
  where user_id is not null;

create unique index if not exists activity_grades_unique_group_target
  on public.activity_grades (activity_id, group_id)
  where group_id is not null;

alter table public.activity_grades
  drop constraint if exists activity_grades_target_check;

alter table public.activity_grades
  add constraint activity_grades_target_check
  check (
    (user_id is not null and group_id is null)
    or (user_id is null and group_id is not null)
  );

-- ---------------------------------------------------------------------------
-- Portfolio/account ownership extensions (compatible with existing table)
-- ---------------------------------------------------------------------------

alter table public.student_sim_accounts
  add column if not exists owner_type text not null default 'user'
    check (owner_type in ('user', 'group')),
  add column if not exists owner_group_id uuid references public.room_groups (id) on delete cascade;

alter table public.student_sim_accounts
  alter column user_id drop not null;

update public.student_sim_accounts
set owner_type = 'user'
where owner_type is null;

alter table public.student_sim_accounts
  drop constraint if exists student_sim_accounts_owner_target_check;

alter table public.student_sim_accounts
  add constraint student_sim_accounts_owner_target_check
  check (
    (owner_type = 'user' and user_id is not null and owner_group_id is null)
    or (owner_type = 'group' and owner_group_id is not null and user_id is null)
  );

create unique index if not exists student_sim_accounts_unique_group_owner
  on public.student_sim_accounts (room_id, owner_group_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists room_groups_set_updated_at on public.room_groups;
create trigger room_groups_set_updated_at
before update on public.room_groups
for each row
execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RLS for room_groups
-- ---------------------------------------------------------------------------

alter table public.room_groups enable row level security;
alter table public.room_group_members enable row level security;

drop policy if exists "room_groups_select_accessible" on public.room_groups;
create policy "room_groups_select_accessible"
on public.room_groups
for select
to authenticated
using (public.can_access_room_groups(public.room_groups.room_id, auth.uid()));

drop policy if exists "room_groups_insert_teacher" on public.room_groups;
create policy "room_groups_insert_teacher"
on public.room_groups
for insert
to authenticated
with check (
  auth.uid() = created_by
  and public.can_manage_room_groups(public.room_groups.room_id, auth.uid())
);

drop policy if exists "room_groups_update_teacher" on public.room_groups;
create policy "room_groups_update_teacher"
on public.room_groups
for update
to authenticated
using (public.can_manage_room_groups(public.room_groups.room_id, auth.uid()))
with check (public.can_manage_room_groups(public.room_groups.room_id, auth.uid()));

drop policy if exists "room_groups_delete_teacher" on public.room_groups;
create policy "room_groups_delete_teacher"
on public.room_groups
for delete
to authenticated
using (public.can_manage_room_groups(public.room_groups.room_id, auth.uid()));

drop policy if exists "room_group_members_select_accessible" on public.room_group_members;
create policy "room_group_members_select_accessible"
on public.room_group_members
for select
to authenticated
using (
  auth.uid() = public.room_group_members.user_id
  or public.can_access_room_groups(public.room_group_members.room_id, auth.uid())
);

drop policy if exists "room_group_members_insert_teacher" on public.room_group_members;
create policy "room_group_members_insert_teacher"
on public.room_group_members
for insert
to authenticated
with check (
  public.can_manage_room_groups(public.room_group_members.room_id, auth.uid())
);

drop policy if exists "room_group_members_update_teacher" on public.room_group_members;
create policy "room_group_members_update_teacher"
on public.room_group_members
for update
to authenticated
using (public.can_manage_room_groups(public.room_group_members.room_id, auth.uid()))
with check (public.can_manage_room_groups(public.room_group_members.room_id, auth.uid()));

drop policy if exists "room_group_members_delete_teacher" on public.room_group_members;
create policy "room_group_members_delete_teacher"
on public.room_group_members
for delete
to authenticated
using (public.can_manage_room_groups(public.room_group_members.room_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Update activity / grade / submission policies to support groups
-- ---------------------------------------------------------------------------

drop policy if exists "activities_select_room_members" on public.activities;
create policy "activities_select_room_members"
on public.activities
for select
to authenticated
using (public.is_active_room_member(public.activities.room_id, auth.uid()));

drop policy if exists "activities_insert_teacher" on public.activities;
create policy "activities_insert_teacher"
on public.activities
for insert
to authenticated
with check (
  auth.uid() = created_by
  and public.is_active_room_staff(public.activities.room_id, auth.uid())
);

drop policy if exists "activities_update_teacher" on public.activities;
create policy "activities_update_teacher"
on public.activities
for update
to authenticated
using (public.is_active_room_staff(public.activities.room_id, auth.uid()))
with check (public.is_active_room_staff(public.activities.room_id, auth.uid()));

drop policy if exists "activity_submissions_select_accessible" on public.activity_submissions;
create policy "activity_submissions_select_accessible"
on public.activity_submissions
for select
to authenticated
using (
  auth.uid() = submitted_by
  or auth.uid() = user_id
  or (group_id is not null and public.is_active_group_member(group_id, auth.uid()))
  or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
);

drop policy if exists "activity_submissions_insert_self" on public.activity_submissions;
create policy "activity_submissions_insert_self"
on public.activity_submissions
for insert
to authenticated
with check (
  auth.uid() = submitted_by
  and public.is_active_room_member(public.activity_submissions.room_id, auth.uid())
  and (
    (user_id is not null and user_id = auth.uid() and group_id is null)
    or (
      user_id is null
      and group_id is not null
      and (
        public.is_active_group_member(group_id, auth.uid())
        or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
      )
    )
  )
);

drop policy if exists "activity_submissions_update_accessible" on public.activity_submissions;
create policy "activity_submissions_update_accessible"
on public.activity_submissions
for update
to authenticated
using (
  auth.uid() = submitted_by
  or auth.uid() = user_id
  or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
)
with check (
  auth.uid() = submitted_by
  or auth.uid() = user_id
  or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
);

drop policy if exists "activity_grades_select_accessible" on public.activity_grades;
create policy "activity_grades_select_accessible"
on public.activity_grades
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = graded_by
  or (group_id is not null and public.is_active_group_member(group_id, auth.uid()))
  or exists (
    select 1
    from public.activities a
    where a.id = public.activity_grades.activity_id
      and public.is_active_room_staff(a.room_id, auth.uid())
  )
);

drop policy if exists "activity_grades_insert_teacher" on public.activity_grades;
create policy "activity_grades_insert_teacher"
on public.activity_grades
for insert
to authenticated
with check (
  auth.uid() = graded_by
  and exists (
    select 1
    from public.activities a
    where a.id = public.activity_grades.activity_id
      and public.is_active_room_staff(a.room_id, auth.uid())
  )
);
