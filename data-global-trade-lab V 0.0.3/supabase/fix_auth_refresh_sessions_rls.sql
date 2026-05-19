-- Fix linter error: rls_disabled_in_public on public.auth_refresh_sessions
-- Run this in Supabase SQL Editor for existing environments.

begin;

alter table if exists public.auth_refresh_sessions enable row level security;

revoke all on table public.auth_refresh_sessions from anon;
revoke all on table public.auth_refresh_sessions from authenticated;

drop policy if exists "auth_refresh_sessions_block_anon" on public.auth_refresh_sessions;
create policy "auth_refresh_sessions_block_anon"
on public.auth_refresh_sessions
for all
to anon
using (false)
with check (false);

drop policy if exists "auth_refresh_sessions_block_authenticated" on public.auth_refresh_sessions;
create policy "auth_refresh_sessions_block_authenticated"
on public.auth_refresh_sessions
for all
to authenticated
using (false)
with check (false);

commit;

