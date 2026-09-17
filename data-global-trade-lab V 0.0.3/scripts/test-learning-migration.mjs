import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("learning migration creates a protected, seeded, indexed content platform", async () => {
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

    const migrationUrl = new URL("../supabase/migrations/20260916234646_learning_platform_backend.sql", import.meta.url);
    const migration = await readFile(migrationUrl, "utf8");
    await database.exec(migration);

    const tables = await database.query(`
      select tablename, rowsecurity
      from pg_tables
      where schemaname = 'public' and tablename like 'learning_%'
      order by tablename
    `);
    assert.equal(tables.rows.length, 20);
    assert.ok(tables.rows.every((row) => row.rowsecurity === true));

    const catalog = await database.query(`
      select
        (select count(*)::int from public.learning_categories) as categories,
        (select count(*)::int from public.learning_courses) as courses,
        (select count(*)::int from public.learning_course_modules) as modules,
        (select count(*)::int from public.learning_lessons) as lessons,
        (select count(*)::int from public.learning_lesson_blocks) as blocks,
        (select count(*)::int from public.learning_paths) as paths
    `);
    assert.deepEqual(catalog.rows[0], {
      categories: 10,
      courses: 8,
      modules: 12,
      lessons: 36,
      blocks: 216,
      paths: 4,
    });

    const indexes = await database.query(`
      select indexname from pg_indexes
      where schemaname = 'public' and indexname in (
        'learning_courses_search_idx',
        'learning_modules_course_position_idx',
        'learning_blocks_lesson_position_idx',
        'learning_user_progress_user_activity_idx',
        'learning_resources_owner_created_idx'
      )
    `);
    assert.equal(indexes.rows.length, 5);

    const directGrants = await database.query(`
      select grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name like 'learning_%'
        and grantee in ('anon', 'authenticated')
    `);
    assert.equal(directGrants.rows.length, 0);

    const serviceGrants = await database.query(`
      select distinct table_name
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name like 'learning_%'
        and grantee = 'service_role'
        and privilege_type = 'SELECT'
    `);
    assert.equal(serviceGrants.rows.length, 20);
  } finally {
    await database.close();
  }
});
