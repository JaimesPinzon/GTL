export type MarketCacheEntry<T> = {
    payload: T;
    timestamp: number;
};

export type MarketCacheStore<T> = Map<string, MarketCacheEntry<T>>;

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function getOrCreateGlobalCache<T>(cacheName: string) {
    const globalCacheStore = globalThis as typeof globalThis & {
        __gtlMarketCaches__?: Record<string, MarketCacheStore<T>>;
    };

    if (!globalCacheStore.__gtlMarketCaches__) {
        globalCacheStore.__gtlMarketCaches__ = {};
    }

    if (!globalCacheStore.__gtlMarketCaches__[cacheName]) {
        globalCacheStore.__gtlMarketCaches__[cacheName] = new Map();
    }

    return globalCacheStore.__gtlMarketCaches__[cacheName];
}

export function touchCacheEntry<T>(
    cacheStore: MarketCacheStore<T>,
    cacheKey: string,
    entry: MarketCacheEntry<T>,
    maxEntries: number
) {
    if (cacheStore.has(cacheKey)) {
        cacheStore.delete(cacheKey);
    }

    cacheStore.set(cacheKey, entry);

    while (cacheStore.size > maxEntries) {
        const oldestKey = cacheStore.keys().next().value;
        if (!oldestKey) {
            break;
        }

        cacheStore.delete(oldestKey);
    }
}

export function getCachedPayload<T>(
    cacheStore: MarketCacheStore<T>,
    cacheKey: string,
    ttlMs: number,
    maxEntries: number
) {
    const cachedEntry = cacheStore.get(cacheKey);

    if (!cachedEntry) {
        return null;
    }

    if (Date.now() - cachedEntry.timestamp > ttlMs) {
        cacheStore.delete(cacheKey);
        return null;
    }

    touchCacheEntry(cacheStore, cacheKey, cachedEntry, maxEntries);
    return cloneJson(cachedEntry.payload);
}

export function setCachedPayload<T>(
    cacheStore: MarketCacheStore<T>,
    cacheKey: string,
    payload: T,
    maxEntries: number
) {
    touchCacheEntry(
        cacheStore,
        cacheKey,
        {
            payload: cloneJson(payload),
            timestamp: Date.now(),
        },
        maxEntries
    );
}
