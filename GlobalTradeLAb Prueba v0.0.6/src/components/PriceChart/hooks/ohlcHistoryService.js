import { getMarketOhlcFromBackend } from "@/lib/backend-market";
import { HISTORY_CACHE_TTL_MS, HISTORY_LIMIT_BY_TIMEFRAME } from "@/lib/market-timeframes";
import {
  clearPendingOhlcRequest,
  getPendingOhlcRequest,
  readOhlcCacheEntry,
  setPendingOhlcRequest,
  writeOhlcCacheEntry,
} from "./ohlcHistoryCache";
import { normalizeTimestampToUnixSeconds } from "../utils";

export const MAX_CHART_DATA_CACHE_ENTRIES = 24;

export function getHistoryLimit(timeframe) {
  return HISTORY_LIMIT_BY_TIMEFRAME[timeframe] ?? 500;
}

const OHLC_CACHE_VERSION = "v7";

export function buildCacheKey({ symbol, timeframe, limit, from = null, to = null }) {
  return `${OHLC_CACHE_VERSION}::${symbol}::${timeframe}::${limit}::${from ?? "latest"}::${to ?? "latest"}`;
}

export function getCacheTtl(timeframe) {
  return HISTORY_CACHE_TTL_MS[timeframe] ?? 5 * 60 * 1000;
}

export function getRefreshInterval(timeframe) {
  const cacheTtl = getCacheTtl(timeframe);
  return Math.max(60 * 1000, Math.min(cacheTtl, 2 * 60 * 1000));
}

export function getCachedData({ cacheKey, cacheTtl }) {
  const cachedEntry = readOhlcCacheEntry(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  return Date.now() - cachedEntry.timestamp <= cacheTtl ? cachedEntry.data : null;
}

export function normalizeOhlc(ohlcData = []) {
  const series = Array.isArray(ohlcData)
    ? ohlcData
    : Array.isArray(ohlcData?.candles)
      ? ohlcData.candles
      : Array.isArray(ohlcData?.data)
        ? ohlcData.data
        : [];

  return series.map((point) => ({
    ...point,
    time: normalizeTimestampToUnixSeconds(point.time ?? point.timestamp ?? point.date),
  }));
}

export async function fetchOhlc({ symbol, timeframe, limit, from = null, to = null }) {
  return await getMarketOhlcFromBackend({
    symbol,
    timeframe,
    limit,
    from,
    to,
  });
}

export function storeInCache({ cacheKey, data }) {
  writeOhlcCacheEntry(cacheKey, {
    timestamp: Date.now(),
    data,
  }, MAX_CHART_DATA_CACHE_ENTRIES);
}

export async function loadOhlcHistory({
  symbol,
  timeframe,
  limit,
  from = null,
  to = null,
  force = false,
}) {
  const cacheKey = buildCacheKey({ symbol, timeframe, limit, from, to });
  const cacheTtl = getCacheTtl(timeframe);
  const cachedData = force ? null : getCachedData({ cacheKey, cacheTtl });

  if (cachedData) {
    return cachedData;
  }

  const pendingRequest = getPendingOhlcRequest(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const rawOhlc = await fetchOhlc({ symbol, timeframe, limit, from, to });
    const normalizedOhlc = normalizeOhlc(rawOhlc);
    storeInCache({ cacheKey, data: normalizedOhlc });
    return normalizedOhlc;
  })();

  setPendingOhlcRequest(cacheKey, request);

  try {
    return await request;
  } finally {
    clearPendingOhlcRequest(cacheKey);
  }
}

