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

let warmupPromise: Promise<void> | null = null;

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
        let refreshed = 0;
        let failed = 0;

        for (const symbol of trackedMarketSymbols) {
            for (const timeframe of Object.keys(yahooBaseTimeframeConfigs) as YahooBaseTimeframe[]) {
                try {
                    if (await warmSymbolTimeframe(symbol, timeframe)) {
                        refreshed += 1;
                    }
                } catch (error) {
                    failed += 1;
                    console.error("market warmup failed", { symbol, timeframe, error });
                }
            }
        }

        console.info("market warmup completed", {
            symbols: trackedMarketSymbols.length,
            refreshed,
            failed,
        });
    })();

    return warmupPromise;
}
