import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const readSource = (relativePath) =>
    readFileSync(new URL(relativePath, new URL("../", import.meta.url)), "utf8");

test("quote read routes never trigger Twelve Data refreshes", () => {
    const quoteRoute = readSource("src/app/api/market/quote/route.ts");
    const quotesRoute = readSource("src/app/api/market/quotes/route.ts");

    for (const source of [quoteRoute, quotesRoute]) {
        assert.doesNotMatch(source, /refreshTrackedQuotesIfDue/);
        assert.match(source, /getLastCandleMarketBySymbols/);
    }
});

test("the scheduled quote refresh cannot bypass the shared database lock", () => {
    const refreshRoute = readSource("src/app/api/market/quotes/refresh/route.ts");
    const refreshService = readSource("src/app/utils/market/quotes-refresh.ts");

    assert.doesNotMatch(refreshRoute, /forceRefresh|force:/);
    assert.match(refreshRoute, /parseTrackedSymbols\(null\)/);
    assert.doesNotMatch(refreshRoute, /searchParams\.get\("symbols"\)/);
    assert.match(refreshService, /acquireMarketQuotesRefreshLock/);
    assert.match(refreshService, /lockWindowMs:\s*minIntervalMs/);
    assert.match(refreshService, /reason:\s*"refresh_lock_unavailable"/);
    assert.doesNotMatch(refreshService, /lockBypassed\s*=\s*true/);
    assert.doesNotMatch(refreshService, /releaseMarketQuotesRefreshLock/);
});

test("time series requests share an in-flight request and a 108-second cache", () => {
    const twelveDataServer = readSource("src/app/utils/twelvedata/server.ts");
    const historyRoute = readSource("src/app/api/market/history/route.ts");
    const ohlcRoute = readSource("src/app/api/market/ohlc/route.ts");

    assert.match(twelveDataServer, /DEFAULT_TIME_SERIES_TTL_MS\s*=\s*108000/);
    assert.match(twelveDataServer, /pending\.get\(cacheKey\)/);
    assert.match(twelveDataServer, /pending\.set\(cacheKey, request\)/);
    assert.match(twelveDataServer, /cache\.set\(cacheKey, \{ data, fetchedAt: Date\.now\(\) \}\)/);
    for (const source of [historyRoute, ohlcRoute]) {
        assert.match(
            source,
            /shouldUseLiveTimeSeries\(config\.providerInterval\)\s*&&\s*!hasFreshStoredHistory/
        );
    }
});
