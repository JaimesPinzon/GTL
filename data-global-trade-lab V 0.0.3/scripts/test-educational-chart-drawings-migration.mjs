import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const migrationUrl = new URL(
  "../supabase/migrations/20260916120000_educational_chart_drawings.sql",
  import.meta.url,
);

const bootstrapSql = `
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create table public.profiles (user_id uuid primary key);
  create table public.rooms (id uuid primary key);
  create table public.room_members (
    id uuid primary key,
    room_id uuid not null references public.rooms(id),
    user_id uuid not null references public.profiles(user_id),
    role_in_room text not null,
    state text not null
  );
  create table public.chart_drawings (
    id uuid primary key,
    user_id uuid not null references public.profiles(user_id),
    symbol text not null,
    timeframe text not null,
    objects jsonb not null default '[]'::jsonb,
    unique (user_id, symbol, timeframe)
  );
  alter table public.chart_drawings enable row level security;
  create policy "chart_drawings_select_own" on public.chart_drawings
    for select to authenticated using ((select auth.uid()) = user_id);
  create policy "chart_drawings_insert_own" on public.chart_drawings
    for insert to authenticated with check ((select auth.uid()) = user_id);
  create policy "chart_drawings_update_own" on public.chart_drawings
    for update to authenticated using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  create policy "chart_drawings_delete_own" on public.chart_drawings
    for delete to authenticated using ((select auth.uid()) = user_id);
`;

test("educational drawing migration is idempotent and installs class security", async () => {
  const database = new PGlite();
  const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
  await database.exec(bootstrapSql);
  await database.exec(migration);
  await database.exec(migration);

  const columns = await database.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'chart_drawings'
  `);
  const columnNames = new Set(columns.rows.map((row) => row.column_name));
  assert.equal(columnNames.has("class_id"), true);
  assert.equal(columnNames.has("visibility"), true);
  assert.equal(columnNames.has("objects"), true);

  const policies = await database.query(`
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'chart_drawings'
  `);
  const policyNames = new Set(policies.rows.map((row) => row.policyname));
  assert.equal(policyNames.has("chart_drawings_select_class"), true);
  assert.equal(policyNames.has("chart_drawings_update_own"), true);

  const indexes = await database.query(`
    select indexname
    from pg_indexes
    where schemaname = 'public' and tablename = 'chart_drawings'
  `);
  assert.equal(
    indexes.rows.some((row) => row.indexname === "chart_drawings_shared_class_symbol_idx"),
    true,
  );

  await database.close();
});
