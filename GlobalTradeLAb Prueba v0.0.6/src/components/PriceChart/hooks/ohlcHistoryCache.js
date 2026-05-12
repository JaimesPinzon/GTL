const cacheStore = new Map();
const pendingRequestsStore = new Map();

let activeCacheScope = "anonymous";

export function ensureOhlcCacheScope(scopeKey) {
  const nextScope = scopeKey || "anonymous";

  if (activeCacheScope === nextScope) {
    return;
  }

  activeCacheScope = nextScope;
  cacheStore.clear();
  pendingRequestsStore.clear();
}

export function getOhlcCacheStore() {
  return cacheStore;
}

export function getOhlcPendingRequestsStore() {
  return pendingRequestsStore;
}

export function getScopedCacheKey(cacheKey) {
  return `${activeCacheScope}::${cacheKey}`;
}

export function readOhlcCacheEntry(cacheKey) {
  const scopedKey = getScopedCacheKey(cacheKey);
  const entry = cacheStore.get(scopedKey);

  if (!entry) {
    return null;
  }

  cacheStore.delete(scopedKey);
  cacheStore.set(scopedKey, entry);
  return entry;
}

export function writeOhlcCacheEntry(cacheKey, entry, maxEntries) {
  const scopedKey = getScopedCacheKey(cacheKey);

  if (cacheStore.has(scopedKey)) {
    cacheStore.delete(scopedKey);
  }

  cacheStore.set(scopedKey, entry);

  while (cacheStore.size > maxEntries) {
    const oldestKey = cacheStore.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cacheStore.delete(oldestKey);
  }
}

export function deleteOhlcCacheEntry(cacheKey) {
  cacheStore.delete(getScopedCacheKey(cacheKey));
}

export function getPendingOhlcRequest(cacheKey) {
  return pendingRequestsStore.get(getScopedCacheKey(cacheKey)) ?? null;
}

export function setPendingOhlcRequest(cacheKey, request) {
  pendingRequestsStore.set(getScopedCacheKey(cacheKey), request);
}

export function clearPendingOhlcRequest(cacheKey) {
  pendingRequestsStore.delete(getScopedCacheKey(cacheKey));
}

export function invalidateOhlcCacheBySymbol(symbol) {
  for (const key of [...cacheStore.keys()]) {
    if (key.includes(`::${symbol}::`)) {
      cacheStore.delete(key);
    }
  }

  for (const key of [...pendingRequestsStore.keys()]) {
    if (key.includes(`::${symbol}::`)) {
      pendingRequestsStore.delete(key);
    }
  }
}

export function clearOhlcCache() {
  cacheStore.clear();
  pendingRequestsStore.clear();
}
