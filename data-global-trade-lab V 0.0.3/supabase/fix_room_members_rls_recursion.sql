-- Fix for: 42P17 infinite recursion detected in policy for relation "room_members"
-- Run this in Supabase SQL Editor.

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

drop policy if exists "rooms_select_accessible" on public.rooms;
create policy "rooms_select_accessible"
on public.rooms
for select
to authenticated
using (
  auth.uid() = created_by
  or public.is_active_room_member(public.rooms.id, auth.uid())
);

drop policy if exists "rooms_update_teacher" on public.rooms;
create policy "rooms_update_teacher"
on public.rooms
for update
to authenticated
using (
  auth.uid() = created_by
  or public.is_active_room_staff(public.rooms.id, auth.uid())
)
with check (
  auth.uid() = created_by
  or public.is_active_room_staff(public.rooms.id, auth.uid())
);

drop policy if exists "room_members_select_accessible" on public.room_members;
create policy "room_members_select_accessible"
on public.room_members
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_active_room_staff(public.room_members.room_id, auth.uid())
);

drop policy if exists "room_members_update_teacher" on public.room_members;
create policy "room_members_update_teacher"
on public.room_members
for update
to authenticated
using (
  public.is_active_room_staff(public.room_members.room_id, auth.uid())
)
with check (
  public.is_active_room_staff(public.room_members.room_id, auth.uid())
);
