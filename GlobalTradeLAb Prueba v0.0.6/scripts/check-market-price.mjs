import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createModuleLoader } from './helpers/load-module.mjs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const base = envText.match(/^VITE_MARKET_BACKEND_URL=(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
if (!base) throw new Error('VITE_MARKET_BACKEND_URL is required');
const read = async (path) => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Market API status ${response.status}`);
  return response.json();
};
const [quotes, hourly, minutes] = await Promise.all([
  read('/api/market/quotes?symbols=BTC%2FUSD'),
  read('/api/market/history/base-candles?symbols=BTC%2FUSD&timeframe=1H&limit=48'),
  read('/api/market/ohlc?symbol=BTC%2FUSD&timeframe=1m&limit=120'),
]);
const load = createModuleLoader();
const { latestCandleSnapshot, resolveMarketSnapshot, mergeMarketSnapshot } = load('src/lib/market-price.js');
const { aggregateDataForTimeframe } = load('src/components/PriceChart/utils.js');
const chartData = aggregateDataForTimeframe(minutes.data, '1m');
const entry = quotes.results[0];
const snapshot = resolveMarketSnapshot({
  quote: { ...entry.data, stale: entry.stale },
  candles: hourly.results[0]?.data ?? [],
  chartSnapshot: latestCandleSnapshot(chartData),
});
assert.ok(snapshot, 'No usable market observation');
const rendered = mergeMarketSnapshot(chartData, snapshot, '1m');
assert.equal(rendered.at(-1).close, snapshot.price);
console.log(JSON.stringify({
  backendQuote: { price: entry.data.close, timestamp: entry.data.timestamp, stale: entry.stale },
  selected: { price: snapshot.price, timestamp: new Date(snapshot.time * 1000).toISOString(), source: snapshot.source, change24h: snapshot.change },
  chartClose: rendered.at(-1).close,
  matches: true,
}, null, 2));
