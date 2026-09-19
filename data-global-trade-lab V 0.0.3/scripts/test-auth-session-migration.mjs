import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

const FUNCTION_SIGNATURE =
  "public.rotate_auth_refresh_session(text,text,uuid,text,text,text,text,timestamptz,text,text,integer)";

test("auth refresh rotation is atomic, idempotent, and service-role only", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.profiles(user_id uuid primary key);
      create table public.auth_refresh_sessions (
        id uuid primary key,
        user_id uuid not null references public.profiles(user_id) on delete cascade,
        family_id uuid not null,
        token_hash text not null unique,
        csrf_token_hash text not null,
        user_agent text not null default '',
        ip_address text not null default '',
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now()),
        last_used_at timestamptz not null default timezone('utc', now()),
        expires_at timestamptz not null,
        revoked_at timestamptz,
        revoked_reason text,
        replaced_by_session_id uuid references public.auth_refresh_sessions(id) on delete set null
      );
      alter table public.auth_refresh_sessions enable row level security;
      revoke all on table public.auth_refresh_sessions from anon, authenticated;
      grant select, insert, update on table public.auth_refresh_sessions to service_role;
    `);

    const migration = await readFile(
      new URL("../supabase/migrations/20260919083140_atomic_auth_refresh.sql", import.meta.url),
      "utf8",
    );
    await database.exec(migration);
    await database.exec(migration);

    const userId = "11111111-1111-4111-8111-111111111111";
    const parentId = "22222222-2222-4222-8222-222222222222";
    const familyId = "33333333-3333-4333-8333-333333333333";
    const firstChildId = "44444444-4444-4444-8444-444444444444";
    const losingChildId = "55555555-5555-4555-8555-555555555555";

    await database.query("insert into public.profiles(user_id) values ($1)", [userId]);
    await database.query(
      `insert into public.auth_refresh_sessions (
        id, user_id, family_id, token_hash, csrf_token_hash, expires_at
      ) values ($1, $2, $3, 'parent-hash', 'csrf-hash', now() + interval '1 day')`,
      [parentId, userId, familyId],
    );

    const rotate = (childId, tokenHash, refreshCiphertext, csrfCiphertext) =>
      database.query(
        `select * from public.rotate_auth_refresh_session(
          'parent-hash', 'csrf-hash', $1, $2, 'next-csrf-hash', $3, $4,
          now() + interval '1 day', 'test-agent', '127.0.0.1', 10
        )`,
        [childId, tokenHash, refreshCiphertext, csrfCiphertext],
      );

    const first = await rotate(firstChildId, "first-child-hash", "encrypted-refresh", "encrypted-csrf");
    const replay = await rotate(losingChildId, "losing-child-hash", "losing-refresh", "losing-csrf");

    assert.equal(first.rows[0]?.outcome, "rotated");
    assert.equal(replay.rows[0]?.outcome, "replayed");
    assert.equal(replay.rows[0]?.result_session_id, firstChildId);
    assert.equal(replay.rows[0]?.result_refresh_token_ciphertext, "encrypted-refresh");
    assert.equal(replay.rows[0]?.result_csrf_token_ciphertext, "encrypted-csrf");

    const children = await database.query(
      "select id, revoked_at from public.auth_refresh_sessions where family_id = $1 and id <> $2",
      [familyId, parentId],
    );
    assert.deepEqual(children.rows, [{ id: firstChildId, revoked_at: null }]);

    const privileges = await database.query(
      `select
        has_function_privilege('anon', '${FUNCTION_SIGNATURE}', 'EXECUTE') as anon_can_execute,
        has_function_privilege('authenticated', '${FUNCTION_SIGNATURE}', 'EXECUTE') as authenticated_can_execute,
        has_function_privilege('service_role', '${FUNCTION_SIGNATURE}', 'EXECUTE') as service_can_execute`,
    );
    assert.equal(privileges.rows[0]?.anon_can_execute, false);
    assert.equal(privileges.rows[0]?.authenticated_can_execute, false);
    assert.equal(privileges.rows[0]?.service_can_execute, true);
  } finally {
    await database.close();
  }
});
