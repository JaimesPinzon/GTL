import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("news phase 3 adds protected insights and traceable lab events", async () => {
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
      create table public.activities(id uuid primary key default gen_random_uuid());
    `);
    const lab = (await readFile(new URL("../supabase/migrations/20260916045114_financial_lab_mvp.sql", import.meta.url), "utf8"))
      .replace("create extension if not exists pgcrypto;", "-- provided by PGlite");
    const news = await readFile(new URL("../supabase/migrations/20260916175100_news_mvp.sql", import.meta.url), "utf8");
    const phase3 = await readFile(new URL("../supabase/migrations/20260916190714_news_phase3.sql", import.meta.url), "utf8");
    await database.exec(lab);
    await database.exec(news);
    await database.exec(phase3);

    const tables = await database.query(`select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('news_impact_snapshots','news_ai_explanations','user_news_daily_digests') order by tablename`);
    assert.equal(tables.rows.length, 3);
    assert.ok(tables.rows.every((row) => row.rowsecurity === true));

    const columns = await database.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'lab_events' and column_name like 'source_news%' order by column_name`);
    assert.deepEqual(columns.rows.map((row) => row.column_name), ["source_news_external_id", "source_news_id", "source_news_snapshot"]);

    const grants = await database.query(`select grantee from information_schema.role_table_grants where table_schema = 'public' and table_name = 'news_ai_explanations' and grantee in ('anon','authenticated')`);
    assert.equal(grants.rows.length, 0);

    await database.exec(`insert into public.news_impact_snapshots (external_news_id, symbol, published_at, timeframe) values ('provider:item-1', 'SPY', now(), 'mixed')`);
    await assert.rejects(
      database.exec(`insert into public.news_impact_snapshots (external_news_id, symbol, published_at, timeframe) values ('provider:item-1', 'SPY', now(), 'mixed')`),
      /unique/i,
    );
  } finally {
    await database.close();
  }
});
