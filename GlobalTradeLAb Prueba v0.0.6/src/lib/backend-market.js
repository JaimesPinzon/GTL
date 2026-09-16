import { getMarketBackendUrl } from "@/lib/env";
import { DEFAULT_TIMEFRAME, HISTORY_CACHE_TTL_MS, toBackendTimeframe } from "@/lib/market-timeframes";
import { getCachedSupabaseAccessToken, supabase } from "@/lib/supabase";
import { ENABLED_MARKET_ASSETS } from "@/lib/market-assets";

const BACKEND_SYMBOL_MAP = Object.fromEntries(
  ENABLED_MARKET_ASSETS.map(({ id, backendSymbol }) => [id, backendSymbol])
);

const MARKET_HISTORY_CACHE_STORAGE_KEY = "gtl:market-history-cache";
const MAX_MARKET_HISTORY_CACHE_ENTRIES = 30;
const marketHistoryCache = new Map();
const pendingMarketHistoryRequests = new Map();
let hasLoadedPersistedHistoryCache = false;

const resolveSupabaseAccessToken = async (accessToken = null) => {
  if (accessToken) return accessToken;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const sessionToken = data?.session?.access_token || getCachedSupabaseAccessToken();
  if (!sessionToken) {
    throw new Error("No authenticated Supabase session is available for drawing persistence");
  }

  return sessionToken;
};

export const getBackendSymbol = (symbol) => BACKEND_SYMBOL_MAP[symbol] ?? null;

const getHistoryCacheKey = (backendSymbols, limit, timeframe) =>
  `${backendSymbols.map((entry) => entry.backendSymbol).join(",")}::${limit}::${timeframe}`;

const getHistoryCacheTtl = (timeframe) => HISTORY_CACHE_TTL_MS[timeframe] ?? 5 * 60 * 1000;

const canUseStorage = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const pruneHistoryCache = () => {
  while (marketHistoryCache.size > MAX_MARKET_HISTORY_CACHE_ENTRIES) {
    const oldestKey = marketHistoryCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    marketHistoryCache.delete(oldestKey);
  }
};

const persistHistoryCache = () => {
  if (!canUseStorage()) {
    return;
  }

  try {
    const serialized = JSON.stringify(Array.from(marketHistoryCache.entries()));
    window.sessionStorage.setItem(MARKET_HISTORY_CACHE_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota or serialization errors.
  }
};

const loadPersistedHistoryCache = () => {
  if (hasLoadedPersistedHistoryCache || !canUseStorage()) {
    return;
  }

  hasLoadedPersistedHistoryCache = true;

  try {
    const rawCache = window.sessionStorage.getItem(MARKET_HISTORY_CACHE_STORAGE_KEY);
    if (!rawCache) {
      return;
    }

    const parsedEntries = JSON.parse(rawCache);
    if (!Array.isArray(parsedEntries)) {
      return;
    }

    parsedEntries.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2) {
        return;
      }

      const [key, value] = entry;
      if (
        typeof key !== "string" ||
        !value ||
        typeof value !== "object" ||
        !Number.isFinite(value.timestamp) ||
        !Array.isArray(value.data)
      ) {
        return;
      }

      marketHistoryCache.set(key, value);
    });

    pruneHistoryCache();
  } catch {
    // Ignore malformed persisted cache payloads.
  }
};

const touchHistoryCacheEntry = (cacheKey, cacheValue) => {
  if (marketHistoryCache.has(cacheKey)) {
    marketHistoryCache.delete(cacheKey);
  }

  marketHistoryCache.set(cacheKey, cacheValue);
  pruneHistoryCache();
  persistHistoryCache();
};

const getCachedHistoryEntry = (cacheKey, timeframe) => {
  loadPersistedHistoryCache();

  const cachedEntry = marketHistoryCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (Date.now() - cachedEntry.timestamp > getHistoryCacheTtl(timeframe)) {
    marketHistoryCache.delete(cacheKey);
    persistHistoryCache();
    return null;
  }

  touchHistoryCacheEntry(cacheKey, cachedEntry);
  return cachedEntry.data;
};

export const clearMarketHistoryCache = (predicate) => {
  if (typeof predicate !== "function") {
    marketHistoryCache.clear();
    pendingMarketHistoryRequests.clear();
    if (canUseStorage()) {
      window.sessionStorage.removeItem(MARKET_HISTORY_CACHE_STORAGE_KEY);
    }
    return;
  }

  Array.from(marketHistoryCache.keys()).forEach((key) => {
    if (predicate(key)) {
      marketHistoryCache.delete(key);
    }
  });

  Array.from(pendingMarketHistoryRequests.keys()).forEach((key) => {
    if (predicate(key)) {
      pendingMarketHistoryRequests.delete(key);
    }
  });

  persistHistoryCache();
};

export const getQuoteFromBackend = async (symbol) => {
  const backendSymbol = getBackendSymbol(symbol);

  if (!backendSymbol) {
    return null;
  }

  const response = await fetch(
    `${getMarketBackendUrl("/api/market/quote")}?symbol=${encodeURIComponent(backendSymbol)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Backend market request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.error || "Market backend returned an error");
  }

  return payload.data;
};

export const getQuotesFromBackend = async (symbols) => {
  const backendSymbols = symbols
    .map((symbol) => ({
      localSymbol: symbol,
      backendSymbol: getBackendSymbol(symbol),
    }))
    .filter((entry) => entry.backendSymbol);

  if (backendSymbols.length === 0) {
    return [];
  }

  const response = await fetch(
    `${getMarketBackendUrl("/api/market/quotes")}?symbols=${encodeURIComponent(
      backendSymbols.map((entry) => entry.backendSymbol).join(",")
    )}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    return backendSymbols.map((entry) => ({
      requestedSymbol: entry.backendSymbol,
      localSymbol: entry.localSymbol,
      ok: false,
      error: `Backend market batch request failed with status ${response.status}`,
    }));
  }

  const payload = await response.json();

  if (!payload?.ok || !Array.isArray(payload.results)) {
    return backendSymbols.map((entry) => ({
      requestedSymbol: entry.backendSymbol,
      localSymbol: entry.localSymbol,
      ok: false,
      error: payload?.error || "Market backend batch returned an error",
    }));
  }

  return payload.results.map((result, index) => ({
    ...result,
    localSymbol: backendSymbols[index]?.localSymbol ?? result.requestedSymbol,
  }));
};

export const getLastCandleMarketFromBackend = async ({ limit = 300, source = "twelvedata" } = {}) => {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 1000) : 300;
  const query = new URLSearchParams({
    limit: String(safeLimit),
    source: String(source || "twelvedata"),
  });
  const response = await fetch(
    `${getMarketBackendUrl("/api/market/last-candle-market")}?${query.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Backend last-candle-market request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (!payload?.ok || !Array.isArray(payload.rows)) {
    throw new Error(payload?.error || "Last candle market backend returned an error");
  }

  return payload.rows;
};

export const getMarketHistoryFromBackend = async (symbols, limit = 300, timeframe = DEFAULT_TIMEFRAME) => {
  loadPersistedHistoryCache();

  const backendSymbols = symbols
    .map((symbol) => ({
      localSymbol: symbol,
      backendSymbol: getBackendSymbol(symbol),
    }))
    .filter((entry) => entry.backendSymbol);

  if (backendSymbols.length === 0) {
    return [];
  }

  const cacheKey = getHistoryCacheKey(backendSymbols, limit, timeframe);
  const cachedData = getCachedHistoryEntry(cacheKey, timeframe);

  if (cachedData) {
    return cachedData;
  }

  const pendingRequest = pendingMarketHistoryRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const response = await fetch(
      `${getMarketBackendUrl("/api/market/history/base-candles")}?symbols=${encodeURIComponent(
        backendSymbols.map((entry) => entry.backendSymbol).join(",")
      )}&limit=${limit}&timeframe=${encodeURIComponent(timeframe)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Backend market history request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.error || "Market history backend returned an error");
    }

    const mappedResults = payload.results.map((result, index) => ({
      ...result,
      localSymbol: backendSymbols[index]?.localSymbol ?? result.requestedSymbol,
    }));

    touchHistoryCacheEntry(cacheKey, {
      timestamp: Date.now(),
      data: mappedResults,
    });

    return mappedResults;
  })();

  pendingMarketHistoryRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingMarketHistoryRequests.delete(cacheKey);
  }
};

export const getMarketOhlcFromBackend = async ({
  symbol,
  timeframe = DEFAULT_TIMEFRAME,
  limit = 300,
  from = null,
  to = null,
}) => {
  const backendSymbol = getBackendSymbol(symbol);

  if (!backendSymbol) {
    return null;
  }

  const searchParams = new URLSearchParams({
    symbol: backendSymbol,
    timeframe,
    limit: String(limit),
  });

  if (from) {
    searchParams.set("from", from);
  }

  if (to) {
    searchParams.set("to", to);
  }

  const endpoint = from || to ? "/api/market/ohlc/base-candles" : "/api/market/ohlc";
  const response = await fetch(
    `${getMarketBackendUrl(endpoint)}?${searchParams.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Backend OHLC request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.error || "Market OHLC backend returned an error");
  }

  return payload.data;
};

export const getMarketIndicatorsFromBackend = async ({
  symbol,
  timeframe = DEFAULT_TIMEFRAME,
  limit = 300,
  emaPeriod = 20,
}) => {
  const backendSymbol = getBackendSymbol(symbol);

  if (!backendSymbol) {
    return null;
  }

  const backendTimeframe = toBackendTimeframe(timeframe);
  const response = await fetch(
    `${getMarketBackendUrl("/api/market/indicators")}?symbol=${encodeURIComponent(
      backendSymbol
    )}&timeframe=${encodeURIComponent(backendTimeframe)}&limit=${limit}&emaPeriod=${emaPeriod}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Backend indicators request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.error || "Market indicators backend returned an error");
  }

  return payload.data;
};

export const getMarketDrawingsFromBackend = async ({
  symbol,
  timeframe = DEFAULT_TIMEFRAME,
  classId = null,
  accessToken = null,
}) => {
  const backendSymbol = getBackendSymbol(symbol) ?? (typeof symbol === "string" ? symbol.trim() : "");

  if (!backendSymbol) {
    return [];
  }

  const resolvedAccessToken = await resolveSupabaseAccessToken(accessToken);

  const backendTimeframe = toBackendTimeframe(timeframe);
  const classQuery = classId ? `&classId=${encodeURIComponent(classId)}` : "";
  const response = await fetch(
    `${getMarketBackendUrl("/api/market/drawings")}?symbol=${encodeURIComponent(
      backendSymbol
    )}&timeframe=${encodeURIComponent(backendTimeframe)}${classQuery}`,
    {
      headers: {
        Authorization: `Bearer ${resolvedAccessToken}`,
      },
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Backend drawings request failed with status ${response.status}`);
  }

  if (!payload.ok) {
    throw new Error(payload.error || "Market drawings backend returned an error");
  }

  return Array.isArray(payload.objects) ? payload.objects : [];
};

export const saveMarketDrawingsToBackend = async ({
  symbol,
  timeframe = DEFAULT_TIMEFRAME,
  classId = null,
  objects = [],
  accessToken = null,
}) => {
  const backendSymbol = getBackendSymbol(symbol) ?? (typeof symbol === "string" ? symbol.trim() : "");

  if (!backendSymbol) {
    return null;
  }

  const resolvedAccessToken = await resolveSupabaseAccessToken(accessToken);

  const backendTimeframe = toBackendTimeframe(timeframe);
  const classQuery = classId ? `&classId=${encodeURIComponent(classId)}` : "";
  const isClearing = !Array.isArray(objects) || objects.length === 0;
  const response = await fetch(
    isClearing
      ? `${getMarketBackendUrl("/api/market/drawings")}?symbol=${encodeURIComponent(
          backendSymbol
        )}&timeframe=${encodeURIComponent(backendTimeframe)}${classQuery}`
      : `${getMarketBackendUrl("/api/market/drawings")}`,
    {
      method: isClearing ? "DELETE" : "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedAccessToken}`,
      },
      body: isClearing
        ? undefined
        : JSON.stringify({
            symbol: backendSymbol,
            timeframe: backendTimeframe,
            classId,
            objects,
          }),
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Backend drawings save failed with status ${response.status}`);
  }

  if (!payload.ok) {
    throw new Error(payload.error || "Market drawings save returned an error");
  }

  return payload;
};

