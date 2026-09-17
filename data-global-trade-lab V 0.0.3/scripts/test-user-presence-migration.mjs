import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("user presence migration stores the active class and last connection securely", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.profiles(user_id uuid primary key);
      create table public.rooms(id uuid primary key);
    `);

    const migration = await readFile(
      new URL("../supabase/migrations/20260917043316_add_user_presence.sql", import.meta.url),
      "utf8",
    );
    await database.exec(migration);
    await database.exec(migration);

    const table = await database.query(`
      select rowsecurity
      from pg_tables
      where schemaname = 'public' and tablename = 'user_presence'
    `);
    assert.equal(table.rows[0]?.rowsecurity, true);

    const indexes = await database.query(`
      select indexname
      from pg_indexes
      where schemaname = 'public' and tablename = 'user_presence'
    `);
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    assert.equal(indexNames.has("user_presence_active_room_id_idx"), true);
    assert.equal(indexNames.has("user_presence_last_seen_at_idx"), true);

    const userId = "11111111-1111-4111-8111-111111111111";
    const roomId = "22222222-2222-4222-8222-222222222222";
    await database.exec(`
      insert into public.profiles(user_id) values ('${userId}');
      insert into public.rooms(id) values ('${roomId}');
      insert into public.user_presence(user_id, active_room_id)
      values ('${userId}', '${roomId}')
      on conflict (user_id) do update
      set active_room_id = excluded.active_room_id, last_seen_at = now(), updated_at = now();
    `);
    const presence = await database.query(
      "select active_room_id, last_seen_at from public.user_presence where user_id = $1",
      [userId],
    );
    assert.equal(presence.rows[0]?.active_room_id, roomId);
    assert.ok(presence.rows[0]?.last_seen_at);
  } finally {
    await database.close();
  }
});
