import "server-only";

import {
    getProviderFreshnessMs,
    yahooBaseTimeframeConfigs,
    type YahooBaseTimeframe,
} from "@/app/utils/market/timeframes";
import { trackedMarketSymbols } from "@/app/utils/market/symbols";
import {
    buildRecentMinuteFetchWindow,
    fetchAndStoreYahooBaseCandles,
} from "@/app/utils/yahoo/base-candles";
import { getLatestStoredYahooBaseCandle } from "@/app/utils/yahoo/candles-storage";
import { fetchAndStoreTwelveDataCandles } from "@/app/utils/market/ohlc";

let warmupPromise: Promise<void> | null = null;
const WARMUP_CONCURRENCY = 3;

async function runTasksWithConcurrency(tasks: Array<() => Promise<void>>) {
    let cursor = 0;
    const workers = Array.from(
        { length: Math.min(WARMUP_CONCURRENCY, tasks.length) },
        async () => {
            while (cursor < tasks.length) {
                const taskIndex = cursor;
                cursor += 1;
                await tasks[taskIndex]();
            }
        }
    );

    await Promise.all(workers);
}

async function warmSymbolTimeframe(symbol: string, timeframe: YahooBaseTimeframe) {
    const config = yahooBaseTimeframeConfigs[timeframe];
    const latestStored = await getLatestStoredYahooBaseCandle(symbol, timeframe);
    const latestFetchedAt = latestStored?.fetched_at
        ? new Date(latestStored.fetched_at).getTime()
        : null;
    const freshnessMs = getProviderFreshnessMs(config.providerInterval);

    if (latestFetchedAt !== null && Date.now() - latestFetchedAt < freshnessMs) {
        return false;
    }

    await fetchAndStoreYahooBaseCandles(
        symbol,
        timeframe,
        timeframe === "1m" ? buildRecentMinuteFetchWindow() : {}
    );
    return true;
}

export function warmTrackedMarketData() {
    if (warmupPromise) {
        return warmupPromise;
    }

    warmupPromise = (async () => {
        const startedAt = Date.now();
        let refreshed = 0;
        let failed = 0;

        const priorityTimeframes = [
            "1m", "5m", "15m", "1h", "1d", "1wk", "1mo", "1y",
        ] as YahooBaseTimeframe[];
        const tasks: Array<() => Promise<void>> = [];

        trackedMarketSymbols.forEach((symbol) => {
            tasks.push(async () => {
                try {
                    await fetchAndStoreTwelveDataCandles(symbol, "1m", 120);
                    refreshed += 1;
                } catch (error) {
                    failed += 1;
                    console.error("market warmup failed", { symbol, timeframe: "1m", provider: "twelvedata", error });
                }
            });
        });

        priorityTimeframes.forEach((timeframe) => {
            trackedMarketSymbols.forEach((symbol) => {
                tasks.push(async () => {
                    try {
                        if (await warmSymbolTimeframe(symbol, timeframe)) {
                            refreshed += 1;
                        }
                    } catch (error) {
                        failed += 1;
                        console.error("market warmup failed", { symbol, timeframe, provider: "yahoo_finance", error });
                    }
                });
            });
        });

        await runTasksWithConcurrency(tasks);

        console.info("market warmup completed", {
            symbols: trackedMarketSymbols.length,
            refreshed,
            failed,
            durationMs: Date.now() - startedAt,
        });
    })().finally(() => {
        warmupPromise = null;
    });

    return warmupPromise;
}
