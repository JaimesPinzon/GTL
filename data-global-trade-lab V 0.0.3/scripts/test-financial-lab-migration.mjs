import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("the financial lab migration creates an isolated, protected schema", async () => {
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
    `);
    const migrationUrl = new URL("../supabase/migrations/20260916045114_financial_lab_mvp.sql", import.meta.url);
    const migration = (await readFile(migrationUrl, "utf8")).replace(
      "create extension if not exists pgcrypto;",
      "-- pgcrypto is provided by Supabase; PGlite uses the built-in gen_random_uuid"
    );
    await database.exec(migration);
    const tables = await database.query("select tablename, rowsecurity from pg_tables where schemaname = 'public'");
    const labTables = tables.rows.filter((row) => row.tablename.startsWith("lab_"));
    assert.equal(labTables.length, 11);
    assert.ok(labTables.every((row) => row.rowsecurity === true));

    const realDomainNames = new Set(["positions", "transactions", "quote_history", "last_candle_market"]);
    assert.ok(labTables.every((row) => !realDomainNames.has(row.tablename)));
    const baseEvents = await database.query("select count(1)::int as count from public.lab_events where event_kind = 'base'");
    assert.equal(baseEvents.rows[0].count, 4);
  } finally {
    await database.close();
  }
});
