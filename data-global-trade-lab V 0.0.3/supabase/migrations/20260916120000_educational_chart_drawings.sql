-- Educational chart drawings: class sharing, teacher-only publication and
-- read-only access for active class members.

alter table public.chart_drawings
  add column if not exists class_id uuid,
  add column if not exists visibility text not null default 'private',
  add column if not exists objects jsonb not null default '[]'::jsonb;

update public.chart_drawings
set
  visibility = coalesce(visibility, 'private'),
  objects = coalesce(objects, '[]'::jsonb);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chart_drawings'::regclass
      and conname = 'chart_drawings_visibility_check'
  ) then
    alter table public.chart_drawings
      add constraint chart_drawings_visibility_check
      check (visibility in ('private', 'class')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.chart_drawings'::regclass
      and conname = 'chart_drawings_class_id_fkey'
  ) then
    alter table public.chart_drawings
      add constraint chart_drawings_class_id_fkey
      foreign key (class_id) references public.rooms(id) on delete cascade not valid;
  end if;
end
$$;

create unique index if not exists chart_drawings_user_symbol_timeframe_unique
  on public.chart_drawings (user_id, symbol, timeframe);

create index if not exists chart_drawings_shared_class_symbol_idx
  on public.chart_drawings (class_id, symbol, timeframe)
  where visibility = 'class';

create schema if not exists private;

create or replace function private.can_read_class_drawing(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_class_id
      and rm.user_id = (select auth.uid())
      and rm.state = 'active'
  );
$$;

create or replace function private.can_manage_class_drawing(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_class_id
      and rm.user_id = (select auth.uid())
      and rm.role_in_room in ('teacher', 'monitor')
      and rm.state = 'active'
  );
$$;

revoke all on function private.can_read_class_drawing(uuid) from public;
revoke all on function private.can_manage_class_drawing(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_read_class_drawing(uuid) to authenticated;
grant execute on function private.can_manage_class_drawing(uuid) to authenticated;

drop policy if exists "chart_drawings_select_own" on public.chart_drawings;
drop policy if exists "chart_drawings_select_class" on public.chart_drawings;
drop policy if exists "chart_drawings_insert_own" on public.chart_drawings;
drop policy if exists "chart_drawings_update_own" on public.chart_drawings;

create policy "chart_drawings_select_own"
on public.chart_drawings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "chart_drawings_select_class"
on public.chart_drawings
for select
to authenticated
using (
  visibility = 'class'
  and class_id is not null
  and (select private.can_read_class_drawing(class_id))
);

create policy "chart_drawings_insert_own"
on public.chart_drawings
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    visibility = 'private'
    or (
      visibility = 'class'
      and class_id is not null
      and (select private.can_manage_class_drawing(class_id))
    )
  )
);

create policy "chart_drawings_update_own"
on public.chart_drawings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    visibility = 'private'
    or (
      visibility = 'class'
      and class_id is not null
      and (select private.can_manage_class_drawing(class_id))
    )
  )
);
