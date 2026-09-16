import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("the news MVP migration creates protected, indexed global news tables", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key default gen_random_uuid());
      create table public.profiles(user_id uuid primary key references auth.users(id));
      create table public.rooms(id uuid primary key default gen_random_uuid());
      create table public.activities(
        id uuid primary key default gen_random_uuid(),
        source_news_id uuid,
        source_news_external_id text,
        source_news_snapshot jsonb
      );
    `);
    const migrationUrl = new URL("../supabase/migrations/20260916175100_news_mvp.sql", import.meta.url);
    const migration = await readFile(migrationUrl, "utf8");
    await database.exec(migration);

    const tables = await database.query(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public' and tablename like '%news%'
      order by tablename
    `);
    assert.deepEqual(
      tables.rows.map((row) => row.tablename),
      ["news_alert_deliveries", "news_articles", "news_assets", "news_class_shares", "news_event_clusters", "news_topics", "user_news_alerts", "user_news_read", "user_saved_news"]
    );
    assert.ok(tables.rows.every((row) => row.rowsecurity === true));

    const indexes = await database.query(`
      select indexname from pg_indexes
      where schemaname = 'public' and indexname in (
        'news_articles_published_cursor_idx',
        'news_articles_search_idx',
        'news_assets_symbol_news_idx',
        'user_saved_news_user_created_idx'
      )
    `);
    assert.equal(indexes.rows.length, 4);

    const calendar = await database.query("select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'economic_events'");
    assert.equal(calendar.rows[0].rowsecurity, true);

    const directGrants = await database.query(`
      select grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'news_articles'
        and grantee in ('anon', 'authenticated')
    `);
    assert.equal(directGrants.rows.length, 0);
  } finally {
    await database.close();
  }
});
