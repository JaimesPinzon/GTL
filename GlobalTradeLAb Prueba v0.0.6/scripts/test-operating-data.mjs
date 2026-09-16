import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomAccountResource } from '../src/lib/room-account-resource.js';
import { createModuleLoader } from './helpers/load-module.mjs';

const load = createModuleLoader();
const { latestCandleSnapshot, resolveMarketSnapshot, mergeMarketSnapshot } = load('src/lib/market-price.js');
const { aggregateDataForTimeframe } = load('src/components/PriceChart/utils.js');

// Values and timestamp formats observed in the deployed public API on Sept 14.
const quote = { close: '79727.58', percent_change: '-1.8983', timestamp: '2026-09-04T23:26:58.64185+00:00', stale: true };
const history = [
  { time: '2026-09-14T23:44:00.000Z', open: 78319.296875, high: 78319.296875, low: 78303.9609375, close: 78303.9609375 },
  { time: '2026-09-14T23:45:00.000Z', open: 78303.9609375, high: 78303.9609375, low: 78281.84375, close: 78283.3671875 },
];

test('the deployed stale quote cannot replace newer ISO-dated OHLC', () => {
  const snapshot = resolveMarketSnapshot({ quote, candles: history });
  assert.equal(snapshot.price, 78283.3671875);
  assert.equal(snapshot.source, 'ohlc');
  assert.equal(snapshot.change, null); // Never reuse the old -1.90%.
});

test('timestamps are compared as dates even when the stale flag is absent', () => {
  assert.equal(resolveMarketSnapshot({ quote: { ...quote, stale: false }, candles: history }).price, 78283.3671875);
});

test('a timestamp-less or explicitly stale quote alone is unavailable', () => {
  assert.equal(resolveMarketSnapshot({ quote }), null);
  assert.equal(resolveMarketSnapshot({ quote: { close: 79727.58 } }), null);
});

test('newer chart history drives the panel and last candle at every selected interval', () => {
  const chartSnapshot = latestCandleSnapshot(history);
  const snapshot = resolveMarketSnapshot({ quote, candles: history.slice(0, 1), chartSnapshot });
  for (const timeframe of ['1m', '5m', '1H', '1D']) {
    const rendered = mergeMarketSnapshot(aggregateDataForTimeframe(history, timeframe), snapshot, timeframe);
    assert.equal(rendered.at(-1).close, snapshot.price);
    assert.equal(rendered.at(-1).value, snapshot.price);
  }
});

test('a newer live quote updates only its time bucket and preserves earlier candles', () => {
  const candles = aggregateDataForTimeframe(history, '1m');
  const snapshot = resolveMarketSnapshot({
    candles: history,
    quote: { close: '78290', timestamp: '2026-09-14T23:45:25Z', percent_change: '0.5' },
  });
  const rendered = mergeMarketSnapshot(candles, snapshot, '1m');
  assert.equal(rendered.length, candles.length);
  assert.equal(rendered[0], candles[0]);
  assert.equal(rendered.at(-1).open, candles.at(-1).open);
  assert.equal(rendered.at(-1).close, 78290);
});

test('24-hour change uses a reference from history and the current price', () => {
  const snapshot = resolveMarketSnapshot({ quote, candles: [
    { time: '2026-09-13T23:45:00Z', close: 80000 }, ...history,
  ] });
  assert.equal(snapshot.change, ((78283.3671875 - 80000) / 80000) * 100);
});

const account = (balance, roomId = 'room-1') => ({ id: `rm:${roomId}`, roomId, userId: 'student-1', availableBalance: balance, currency: 'USD' });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('header and form subscribers receive the same account without duplicate fetches', async () => {
  const response = deferred();
  let requests = 0;
  let subscriptions = 0;
  const resource = createRoomAccountResource({
    roomId: 'room-1',
    fetchAccount: () => { requests++; return response.promise; },
    subscribeAccount: () => { subscriptions++; return () => {}; },
  });
  const header = [], form = [];
  resource.subscribe(() => header.push(resource.getSnapshot()));
  resource.subscribe(() => form.push(resource.getSnapshot()));
  resource.start();
  const pending = resource.refresh();
  assert.equal(resource.getSnapshot().status, 'loading');
  assert.equal(resource.getSnapshot().account, null);
  response.resolve(account(10000));
  await pending;
  assert.equal(requests, 1);
  assert.equal(subscriptions, 1);
  assert.equal(header.at(-1), form.at(-1));
  assert.equal(form.at(-1).account.availableBalance, 10000);
  resource.dispose();
});

test('a slow response cannot undo the confirmed post-trade balance', async () => {
  const response = deferred();
  const resource = createRoomAccountResource({ roomId: 'room-1', fetchAccount: () => response.promise, subscribeAccount: () => () => {} });
  resource.seed(account(10000));
  const pending = resource.refresh();
  resource.commit(account(9000));
  response.resolve(account(10000));
  await pending;
  assert.equal(resource.getSnapshot().account.availableBalance, 9000);
});

test('realtime updates propagate zero without restoring initial funds', async () => {
  let emit;
  const resource = createRoomAccountResource({
    roomId: 'room-1', fetchAccount: async () => account(1000),
    subscribeAccount: (_account, callback) => { emit = callback; return () => {}; },
  });
  await resource.refresh();
  emit(account(0));
  resource.seed(account(10000));
  assert.equal(resource.getSnapshot().account.availableBalance, 0);
  assert.equal(resource.getSnapshot().status, 'ready');
});

test('failed account reads expose an error rather than a fictitious zero', async () => {
  const resource = createRoomAccountResource({
    roomId: 'room-1', fetchAccount: async () => { throw new Error('Network error'); }, subscribeAccount: () => () => {},
  });
  await resource.refresh();
  assert.equal(resource.getSnapshot().status, 'error');
  assert.equal(resource.getSnapshot().account, null);
});

test('changing room disposes subscriptions and ignores old responses', async () => {
  const response = deferred();
  let unsubscribed = false;
  const resource = createRoomAccountResource({ roomId: 'room-1', fetchAccount: () => response.promise, subscribeAccount: () => () => { unsubscribed = true; } });
  resource.seed(account(1000));
  resource.start();
  const pending = resource.refresh();
  resource.dispose();
  response.resolve(account(500));
  await pending;
  assert.equal(resource.getSnapshot().account.availableBalance, 1000);
  assert.equal(unsubscribed, true);
});

test('the authenticated account endpoint works even without direct Supabase visibility', async () => {
  const loadAccount = createModuleLoader({
    '@/lib/supabase': { supabase: { from: () => { throw new Error('Direct reads should not run'); } } },
    '@/lib/auth-api': { fetchWithAuth: async () => ({ ok: true, account: account(7500) }) },
  });
  const { fetchResolvedUserRoomAccount } = loadAccount('src/lib/room-balance.js');
  const actual = await fetchResolvedUserRoomAccount({ roomId: 'room-1', userId: 'student-1' });
  assert.equal(actual.availableBalance, 7500);
});

for (const [namespace, table, prefix] of [['rm', 'room_members', 'individual'], ['rgm', 'room_group_members', 'group']]) {
  test(`Realtime ${table} preserves the teacher's total and available balances`, () => {
    let update;
    let watchedTable;
    let released = false;
    const channel = {
      on(_event, filter, callback) { watchedTable = filter.table; update = callback; return channel; },
      subscribe() { return channel; },
    };
    const loader = createModuleLoader({
      '@/lib/supabase': { supabase: { channel: () => channel, removeChannel: () => { released = true; } } },
      '@/lib/auth-api': { fetchWithAuth: () => { throw new Error('Realtime must not start another request'); } },
    });
    const { subscribeToRoomAccount } = loader('src/lib/room-balance.js');
    let snapshot;
    const stop = subscribeToRoomAccount({
      account: { id: `${namespace}:member-1`, roomId: 'room-1', userId: 'teacher-1' },
      onChange: (next) => { snapshot = next; }, refreshOnSubscribe: false, pollIntervalMs: 0,
    });
    update({ eventType: 'UPDATE', new: {
      id: 'member-1', room_id: 'room-1', user_id: 'teacher-1', group_id: 'group-1',
      [`${prefix}_available_balance`]: 10000,
      [`${prefix}_blocked_balance`]: 5000,
      [`${prefix}_total_balance`]: 15000,
      [`${prefix}_currency`]: 'USD',
    } });
    assert.equal(watchedTable, table);
    assert.equal(snapshot.userId, 'teacher-1');
    assert.equal(snapshot.availableBalance, 10000);
    assert.equal(snapshot.totalBalance, 15000);
    stop();
    assert.equal(released, true);
  });
}
