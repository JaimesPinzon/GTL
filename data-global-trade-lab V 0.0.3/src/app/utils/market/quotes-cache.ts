import { getTwelveDataQuote, getTwelveDataQuotes } from "@/app/utils/twelvedata/server";

export type MarketQuotePayload = {
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
    close?: string;
    is_market_open?: boolean;
    percent_change?: string;
    timestamp?: string;
    code?: number;
    message?: string;
    status?: string;
};

type BatchQuoteEntry = {
    requestedSymbol: string;
    data: MarketQuotePayload;
};

type BatchQuoteCachePayload = {
    entries: BatchQuoteEntry[];
};

const QUOTES_CACHE_TTL_MS = 108 * 1000;
const QUOTES_CACHE_NAME = "twelvedata-batch-quotes-cache";
const QUOTES_PENDING_NAME = "twelvedata-batch-quotes-pending";
const MAX_BATCH_CACHE_ENTRIES = 25;

function getGlobalStore<T>(cacheName: string) {
    const globalCacheStore = globalThis as typeof globalThis & {
        __gtlQuotesCaches__?: Record<string, Map<string, T>>;
    };

    if (!globalCacheStore.__gtlQuotesCaches__) {
        globalCacheStore.__gtlQuotesCaches__ = {};
    }

    if (!globalCacheStore.__gtlQuotesCaches__[cacheName]) {
        globalCacheStore.__gtlQuotesCaches__[cacheName] = new Map();
    }

    return globalCacheStore.__gtlQuotesCaches__[cacheName];
}

function normalizeSymbols(symbols: string[]) {
    return symbols
        .map((symbol) => symbol.trim())
        .filter(Boolean);
}

function buildBatchCacheKey(symbols: string[]) {
    return normalizeSymbols(symbols).join(",");
}

function touchCacheEntry<T>(cacheStore: Map<string, T>, cacheKey: string, entry: T) {
    if (cacheStore.has(cacheKey)) {
        cacheStore.delete(cacheKey);
    }

    cacheStore.set(cacheKey, entry);

    while (cacheStore.size > MAX_BATCH_CACHE_ENTRIES) {
        const oldestKey = cacheStore.keys().next().value;
        if (!oldestKey) {
            break;
        }

        cacheStore.delete(oldestKey);
    }
}

function getBatchCacheStore() {
    return getGlobalStore<{ payload: BatchQuoteCachePayload; timestamp: number }>(QUOTES_CACHE_NAME);
}

function getPendingStore() {
    return getGlobalStore<Promise<BatchQuoteEntry[]>>(QUOTES_PENDING_NAME);
}

function getCachedBatch(symbols: string[]) {
    const cacheStore = getBatchCacheStore();
    const cacheKey = buildBatchCacheKey(symbols);
    const cachedEntry = cacheStore.get(cacheKey);

    if (!cachedEntry) {
        return null;
    }

    if (Date.now() - cachedEntry.timestamp > QUOTES_CACHE_TTL_MS) {
        cacheStore.delete(cacheKey);
        return null;
    }

    touchCacheEntry(cacheStore, cacheKey, cachedEntry);
    return cachedEntry.payload.entries;
}

function setCachedBatch(symbols: string[], entries: BatchQuoteEntry[]) {
    const cacheStore = getBatchCacheStore();
    const cacheKey = buildBatchCacheKey(symbols);

    touchCacheEntry(cacheStore, cacheKey, {
        payload: { entries: JSON.parse(JSON.stringify(entries)) as BatchQuoteEntry[] },
        timestamp: Date.now(),
    });
}

async function fetchBatchQuotes(symbols: string[]) {
    if (symbols.length === 0) {
        return [];
    }

    if (symbols.length === 1) {
        const data = await getTwelveDataQuote(symbols[0]);
        return [{ requestedSymbol: symbols[0], data }];
    }

    return getTwelveDataQuotes(symbols);
}

export async function getCachedOrFetchBatchQuotes(symbols: string[]) {
    const normalizedSymbols = normalizeSymbols(symbols);
    if (normalizedSymbols.length === 0) {
        return [];
    }

    const cachedEntries = getCachedBatch(normalizedSymbols);
    if (cachedEntries) {
        return cachedEntries;
    }

    const pendingStore = getPendingStore();
    const cacheKey = buildBatchCacheKey(normalizedSymbols);
    const pendingRequest = pendingStore.get(cacheKey);

    if (pendingRequest) {
        return pendingRequest;
    }

    const request = fetchBatchQuotes(normalizedSymbols)
        .then((entries) => {
            setCachedBatch(normalizedSymbols, entries);
            return entries;
        })
        .finally(() => {
            pendingStore.delete(cacheKey);
        });

    pendingStore.set(cacheKey, request);
    return request;
}
