-- GlobalTradeLab chart drawings.
-- Apply through the backend project's Supabase migration workflow.

create table if not exists public.chart_drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid null,
  market_id text not null,
  symbol text not null,
  drawing_type text not null,
  timeframe_mode text not null default 'all' check (timeframe_mode in ('all', 'single')),
  timeframe text null,
  anchors jsonb not null default '[]'::jsonb check (jsonb_typeof(anchors) = 'array'),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  visibility text not null default 'private' check (visibility in ('private', 'class')),
  is_locked boolean not null default false,
  is_hidden boolean not null default false,
  z_index integer not null default 0,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

-- CREATE TABLE IF NOT EXISTS does not update a table created by an older
-- version of the schema. Add every required column non-destructively before
-- creating indexes or policies. Existing columns and rows are preserved.
alter table if exists public.chart_drawings
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists class_id uuid,
  add column if not exists market_id text,
  add column if not exists symbol text,
  add column if not exists drawing_type text,
  add column if not exists timeframe_mode text default 'all',
  add column if not exists timeframe text,
  add column if not exists anchors jsonb default '[]'::jsonb,
  add column if not exists properties jsonb default '{}'::jsonb,
  add column if not exists visibility text default 'private',
  add column if not exists is_locked boolean default false,
  add column if not exists is_hidden boolean default false,
  add column if not exists z_index integer default 0,
  add column if not exists version integer default 1,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

-- Backfill safe values needed by the new model without deleting legacy data.
update public.chart_drawings
set
  market_id = coalesce(market_id, symbol),
  timeframe_mode = coalesce(timeframe_mode, 'all'),
  anchors = coalesce(anchors, '[]'::jsonb),
  properties = coalesce(properties, '{}'::jsonb),
  visibility = coalesce(visibility, 'private'),
  is_locked = coalesce(is_locked, false),
  is_hidden = coalesce(is_hidden, false),
  z_index = coalesce(z_index, 0),
  version = coalesce(version, 1),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

create index if not exists chart_drawings_owner_symbol_idx
  on public.chart_drawings (user_id, market_id, symbol)
  where deleted_at is null;

create index if not exists chart_drawings_class_symbol_idx
  on public.chart_drawings (class_id, market_id, symbol)
  where deleted_at is null;

create index if not exists chart_drawings_updated_at_idx
  on public.chart_drawings (updated_at);

alter table public.chart_drawings enable row level security;

revoke all on table public.chart_drawings from anon, authenticated;
grant select, insert, update, delete on table public.chart_drawings to authenticated;
grant select, insert, update, delete on table public.chart_drawings to service_role;

drop policy if exists "chart_drawings_select_own" on public.chart_drawings;
create policy "chart_drawings_select_own"
  on public.chart_drawings
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "chart_drawings_insert_own" on public.chart_drawings;
create policy "chart_drawings_insert_own"
  on public.chart_drawings
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "chart_drawings_update_own" on public.chart_drawings;
create policy "chart_drawings_update_own"
  on public.chart_drawings
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "chart_drawings_delete_own" on public.chart_drawings;
create policy "chart_drawings_delete_own"
  on public.chart_drawings
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
