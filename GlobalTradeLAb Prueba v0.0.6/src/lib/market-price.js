import { getTimeBucketStart, normalizeTimestampToUnixSeconds } from './market-time';

export function candleSnapshot(candle) {
  const time = normalizeTimestampToUnixSeconds(candle?.time ?? candle?.timestamp);
  const price = Number(candle?.close ?? candle?.value);
  return Number.isFinite(time) && Number.isFinite(price) && price > 0
    ? { time, price, currency: candle.currency, source: 'ohlc' }
    : null;
}

export function latestCandleSnapshot(candles = []) {
  return candles.reduce((latest, candle) => {
    const candidate = candleSnapshot(candle);
    return candidate && (!latest || candidate.time >= latest.time) ? candidate : latest;
  }, null);
}

export function resolveMarketSnapshot({ quote, candles = [], chartSnapshot }) {
  const historical = latestCandleSnapshot(candles);
  let latest = chartSnapshot && (!historical || chartSnapshot.time >= historical.time)
    ? chartSnapshot
    : historical;
  const quoted = candleSnapshot({ ...quote, time: quote?.timestamp ?? quote?.time, close: quote?.close ?? quote?.price });
  // A provider explicitly marked stale must never supply an execution price.
  if (quoted && quote?.stale !== true && (!latest || quoted.time > latest.time)) {
    latest = { ...quoted, source: 'quote' };
  }
  if (!latest) return null;

  let change = null;
  const reference = latestCandleSnapshot(candles.filter((candle) => {
    const time = normalizeTimestampToUnixSeconds(candle.time);
    return time != null && time <= latest.time - 86400;
  }));
  if (reference) {
    change = ((latest.price - reference.price) / reference.price) * 100;
  } else if (latest.source === 'quote' && quote?.percent_change != null) {
    const quoteChange = Number(quote.percent_change);
    if (Number.isFinite(quoteChange)) change = quoteChange;
  }
  return { ...latest, change };
}

export function mergeMarketSnapshot(candles, snapshot, timeframe, timezone) {
  if (!snapshot) return candles;
  const time = getTimeBucketStart(snapshot.time, timeframe, timezone);
  const price = Number(snapshot.price);
  if (!Number.isFinite(time) || !Number.isFinite(price) || price <= 0) return candles;
  const last = candles.at(-1);
  if (last && (snapshot.time < last.time || time < last.time)) return candles;
  if (last && time === last.time) {
    return [...candles.slice(0, -1), {
      ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price, value: price,
    }];
  }
  // A quote is one observation, not an OHLC candle. Only a provider time-series
  // response may append a new bar; otherwise a temporary flat candle would alter
  // the scale/indicators and disappear after a reload.
  return candles;
}
