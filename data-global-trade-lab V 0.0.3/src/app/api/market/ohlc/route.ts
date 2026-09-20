import { after, NextResponse } from "next/server";

import {
    aggregateCandlesByCount,
    fetchAndStoreTwelveDataCandles,
    mergeStoredCandlesWithLiveCandles,
} from "@/app/utils/market/ohlc";
import { getProviderFreshnessMs, getYahooBaseConfig } from "@/app/utils/market/timeframes";
import {
    buildRecentMinuteFetchWindow,
    fetchAndStoreYahooBaseCandles,
} from "@/app/utils/yahoo/base-candles";
import { readBaseCandlesForTimeframe } from "@/app/utils/yahoo/base-candles-read";
import {
    getLatestStoredYahooBaseCandle,
    type YahooCandleBaseInterval,
} from "@/app/utils/yahoo/candles-storage";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function isStoredSnapshotFresh(
    latestStored: Awaited<ReturnType<typeof getLatestStoredYahooBaseCandle>>,
    providerInterval: string
) {
    const fetchedAt = latestStored?.fetched_at
        ? new Date(latestStored.fetched_at).getTime()
        : Number.NaN;

    return (
        Number.isFinite(fetchedAt) &&
        Date.now() - fetchedAt < getProviderFreshnessMs(providerInterval)
    );
}

async function refreshCanonicalCandles({
    symbol,
    baseInterval,
    outputsize,
}: {
    symbol: string;
    baseInterval: YahooCandleBaseInterval;
    outputsize: number;
}) {
    const yahooConfig = getYahooBaseConfig(baseInterval);
    const yahooOptions = {
        ...(baseInterval === "1m" ? buildRecentMinuteFetchWindow() : {}),
        throwOnPersistenceError: false,
    };
    const [yahooResult, twelveDataResult] = await Promise.allSettled([
        fetchAndStoreYahooBaseCandles(symbol, baseInterval, yahooOptions),
        fetchAndStoreTwelveDataCandles(symbol, baseInterval, outputsize, {
            throwOnPersistenceError: false,
        }),
    ]);
    const results = [yahooResult, twelveDataResult];
    const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

    if (failures.length === results.length) {
        throw new Error(`All OHLC providers failed for ${symbol} ${baseInterval}: ${failures.join(" | ")}`);
    }

    if (failures.length > 0) {
        console.warn("partial OHLC refresh", {
            symbol,
            baseInterval,
            providerInterval: yahooConfig?.providerInterval ?? baseInterval,
            failures,
        });
    }

    const yahooCandles = yahooResult.status === "fulfilled"
        ? yahooResult.value.candles.map((candle) => ({
            ...candle,
            value: candle.close,
            currency: candle.currency ?? "USD",
            exchange: candle.exchange ?? null,
        }))
        : [];
    const twelveDataCandles = twelveDataResult.status === "fulfilled" ? twelveDataResult.value : [];
    return mergeStoredCandlesWithLiveCandles(yahooCandles, twelveDataCandles);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "1m";
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "300", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 5000)) : 300;

    if (!symbol) {
        return NextResponse.json(
            { ok: false, error: "symbol is required" },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        let stored = await readBaseCandlesForTimeframe({ symbol, timeframe, limit });
        const baseInterval = stored.baseInterval as YahooCandleBaseInterval;
        const yahooConfig = getYahooBaseConfig(baseInterval);

        if (!yahooConfig) {
            return NextResponse.json(
                { ok: false, error: `Unsupported OHLC timeframe: ${timeframe}` },
                { status: 400, headers: corsHeaders }
            );
        }

        let latestStored: Awaited<ReturnType<typeof getLatestStoredYahooBaseCandle>> = null;
        try {
            latestStored = await getLatestStoredYahooBaseCandle(symbol, baseInterval);
        } catch (error) {
            console.error("OHLC freshness read error", {
                symbol,
                baseInterval,
                error: error instanceof Error ? error.message : error,
            });
        }
        const isFresh = isStoredSnapshotFresh(latestStored, yahooConfig.providerInterval);
        let refreshMode: "fresh" | "background" | "blocking" = "fresh";
        let responseSource: string = stored.source;

        if (stored.data.length > 0 && !isFresh) {
            refreshMode = "background";
            after(async () => {
                try {
                    await refreshCanonicalCandles({
                        symbol,
                        baseInterval,
                        outputsize: Math.min(500, Math.max(60, limit * stored.aggregateSize)),
                    });
                } catch (error) {
                    console.error("background OHLC refresh error", {
                        symbol,
                        timeframe,
                        error: error instanceof Error ? error.message : error,
                    });
                }
            });
        } else if (stored.data.length === 0) {
            refreshMode = "blocking";
            const liveCandles = await refreshCanonicalCandles({
                symbol,
                baseInterval,
                outputsize: Math.min(500, Math.max(60, limit * stored.aggregateSize)),
            });
            stored = await readBaseCandlesForTimeframe({ symbol, timeframe, limit });
            if (stored.data.length === 0 && liveCandles.length > 0) {
                responseSource = "live_providers";
                stored = {
                    ...stored,
                    data: aggregateCandlesByCount(liveCandles, stored.aggregateSize).slice(-limit),
                };
            }
        }

        return NextResponse.json(
            {
                ok: true,
                symbol,
                timeframe,
                source: responseSource,
                baseInterval: stored.baseInterval,
                aggregateSize: stored.aggregateSize,
                refreshMode,
                data: stored.data,
            },
            {
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                    "X-Market-Refresh": refreshMode,
                },
            }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                symbol,
                timeframe,
                data: [],
                error: error instanceof Error ? error.message : "Unexpected OHLC error",
            },
            {
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
