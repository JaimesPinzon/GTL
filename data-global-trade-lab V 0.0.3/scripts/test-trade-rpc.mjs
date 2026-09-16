import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync("supabase/migrations/20260915060215_atomic_room_trading.sql", "utf8");

const setupDatabase = async () => {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    create schema if not exists private;
    create table public.profiles(user_id uuid primary key);
    create table public.rooms(id uuid primary key, state text, end_date date);
    create table public.room_groups(id uuid primary key, room_id uuid, state text);
    create table public.room_members(
      id uuid primary key, room_id uuid, user_id uuid, role_in_room text, state text,
      individual_available_balance numeric, individual_blocked_balance numeric,
      individual_total_balance numeric, individual_currency text,
      individual_realized_pnl numeric default 0, individual_unrealized_pnl numeric default 0,
      individual_equity numeric
    );
    create table public.room_group_members(
      id uuid primary key, group_id uuid, room_id uuid, user_id uuid, role text, state text,
      group_available_balance numeric, group_blocked_balance numeric,
      group_total_balance numeric, group_currency text,
      group_realized_pnl numeric default 0, group_unrealized_pnl numeric default 0,
      group_equity numeric
    );
    create table public.positions(
      id text primary key, user_id uuid, symbol text, type text, amount numeric,
      entry_price numeric, open_date timestamptz, justification text,
      attachment_name text, created_at timestamptz, updated_at timestamptz, room_id uuid
    );
    create table public.transactions(
      id text primary key, user_id uuid, room_id uuid, type text, symbol text,
      amount numeric, price numeric, entry_price numeric, close_price numeric,
      profit_or_loss numeric, date timestamptz, justification text, attachment_name text
    );
    create role anon;
    create role authenticated;
    create role service_role;
  `);
  await db.exec(migration);
  return db;
};

test("execute_room_trade opens a position atomically without updating profiles", async () => {
  const db = await setupDatabase();
  const userId = "11111111-1111-4111-8111-111111111111";
  const roomId = "22222222-2222-4222-8222-222222222222";
  const memberId = "33333333-3333-4333-8333-333333333333";
  const requestId = "44444444-4444-4444-8444-444444444444";

  await db.query("insert into public.profiles(user_id) values ($1)", [userId]);
  await db.query("insert into public.rooms(id, state, end_date) values ($1, 'active', null)", [roomId]);
  await db.query(
    `insert into public.room_members(
      id, room_id, user_id, role_in_room, state, individual_available_balance,
      individual_blocked_balance, individual_total_balance, individual_currency,
      individual_equity
    ) values ($1, $2, $3, 'teacher', 'active', 10000, 5000, 15000, 'USD', 15000)`,
    [memberId, roomId, userId]
  );

  const order = {
    action: "open",
    symbol: "BTCUSD",
    type: "BUY",
    amount: 1000,
    price: 78283.36,
    justification: "test",
  };
  const { rows } = await db.query(
    "select public.execute_room_trade($1, $2, $3, $4::jsonb) as data",
    [userId, roomId, requestId, JSON.stringify(order)]
  );

  const data = rows[0].data;
  assert.equal(data.account.availableBalance, 9000);
  assert.equal(data.account.blockedBalance, 6000);
  assert.equal(data.account.totalBalance, 15000);
  assert.equal(data.positions.length, 1);
  assert.equal(data.positions[0].symbol, "BTCUSD");

  const replay = await db.query(
    "select public.execute_room_trade($1, $2, $3, $4::jsonb) as data",
    [userId, roomId, requestId, JSON.stringify(order)]
  );
  assert.equal(replay.rows[0].data.account.availableBalance, 9000);
  assert.equal(replay.rows[0].data.positions.length, 1);
});
