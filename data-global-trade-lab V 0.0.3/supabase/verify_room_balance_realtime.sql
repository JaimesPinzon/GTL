-- Quick diagnostics for room balance realtime setup.
-- Run in Supabase SQL Editor.

-- 1) RLS must be enabled on both balance tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('room_members', 'room_group_members')
order by c.relname;

-- 2) Required policy presence for authenticated clients.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('room_members', 'room_group_members')
order by tablename, policyname;

-- 3) Required table grants for Data API / supabase-js access.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('room_members', 'room_group_members')
  and grantee in ('authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- 4) Realtime publication membership.
select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('room_members', 'room_group_members')
order by tablename;
