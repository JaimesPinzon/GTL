import { NextResponse } from "next/server";

import { getTwelveDataQuote, getTwelveDataTimeSeries } from "@/app/utils/twelvedata/server";
import { saveQuoteHistory } from "@/app/utils/twelvedata/history";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getCachedPayload, getOrCreateGlobalCache, setCachedPayload } from "@/app/utils/market/cache";
import { buildCandlesFromQuoteRows, buildCandlesFromStoredRows, buildCandlesFromTimeSeriesValues, aggregateCandlesByCount, fetchAndStoreYahooCandles, mergeStoredCandlesWithLiveCandles, type MarketCandleRow, type OhlcCandle, type QuoteHistoryRow } from "@/app/utils/market/ohlc";
import { getConfigForTimeframe, getProviderFreshnessMs } from "@/app/utils/market/timeframes";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_HISTORY_CACHE_ENTRIES = 50;
const historyResponseCache = getOrCreateGlobalCache<HistorySuccessPayload>("history-response-cache");

const backfillConfigs = [
    { providerInterval: "1m", range: "max" },
    { providerInterval: "2m", range: "max" },
    { providerInterval: "5m", range: "max" },
    { providerInterval: "15m", range: "max" },
    { providerInterval: "30m", range: "max" },
    { providerInterval: "60m", range: "max" },
    { providerInterval: "1d", range: "max" },
    { providerInterval: "1wk", range: "max" },
    { providerInterval: "1mo", range: "max" },
    { providerInterval: "3mo", range: "max" },
] as const;

type HistorySuccessPayload = {
    ok: true;
    results: unknown[];
};

function buildHistoryCacheKey(symbols: string[], timeframe: string, limit: number) {
    return `${symbols.join(",")}::${timeframe}::${limit}`;
}

function getHistoryResponseTtlMs(providerInterval: string) {
    return Math.max(30 * 1000, Math.floor(getProviderFreshnessMs(providerInterval) / 2));
}

function buildJsonResponse(body: unknown, cacheStatus: "HIT" | "MISS") {
    return NextResponse.json(body, {
        headers: {
            ...corsHeaders,
            "X-Cache": cacheStatus,
        },
    });
}

function getTwelveDataInterval(providerInterval: string) {
    switch (providerInterval) {
        case "1m":
            return "1min";
        case "2m":
            return "2min";
        case "5m":
            return "5min";
        case "15m":
            return "15min";
        case "30m":
            return "30min";
        case "60m":
            return "1h";
        default:
            return null;
    }
}

function shouldUseLiveTimeSeries(providerInterval: string) {
    return ["1m", "2m", "5m", "15m", "30m", "60m"].includes(providerInterval);
}

async function backfillSymbolHistory(symbol: string) {
    await Promise.allSettled(
        backfillConfigs.map(async (config) => {
            const { data, error } = await supabaseAdmin
                .from("candles")
                .select("open_time")
                .eq("instrument_id", symbol)
                .eq("timeframe", config.providerInterval)
                .order("open_time", { ascending: false })
                .limit(1);

            if (error) {
                throw error;
            }

            const latestRow = data?.[0];
            const isFresh =
                latestRow &&
                Date.now() - new Date(latestRow.open_time).getTime() <
                    getProviderFreshnessMs(config.providerInterval);

            if (isFresh) {
                return;
            }

            await fetchAndStoreYahooCandles(symbol, config.providerInterval, config.range);
        })
    );
}

async function refreshSpecificIntervalIfNeeded(
    symbol: string,
    providerInterval: string,
    range: string,
    latestStoredTime?: string
) {
    const isFresh =
        latestStoredTime &&
        Date.now() - new Date(latestStoredTime).getTime() <
            getProviderFreshnessMs(providerInterval);

    if (isFresh) {
        return null;
    }

    return fetchAndStoreYahooCandles(symbol, providerInterval, range);
}

export const runtime = "nodejs";

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbols = searchParams.get("symbols")?.trim() ?? "AAPL";
    const requestedTimeframe = searchParams.get("timeframe")?.trim() ?? "1M";
    const config = getConfigForTimeframe(requestedTimeframe);
    const limit = Number.parseInt(searchParams.get("limit") ?? "300", 10);
    const symbols = rawSymbols
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);
    const cacheKey = buildHistoryCacheKey(symbols, requestedTimeframe, limit);

    const cachedPayload = getCachedPayload(
        historyResponseCache,
        cacheKey,
        getHistoryResponseTtlMs(config.providerInterval),
        MAX_HISTORY_CACHE_ENTRIES
    );
    if (cachedPayload) {
        return buildJsonResponse(cachedPayload, "HIT");
    }

    try {
        const fetchLimit = Math.max(limit * Math.max(symbols.length, 1), limit);

        const [quoteHistoryResponse, storedCandlesResponse] = await Promise.all([
            supabaseAdmin
                .from("quote_history")
                .select("requested_symbol,currency,close_price,fetched_at")
                .in("requested_symbol", symbols)
                .order("fetched_at", { ascending: false })
                .limit(fetchLimit),
            supabaseAdmin
                .from("candles")
                .select(
                    "requested_symbol:instrument_id,provider_symbol,interval:timeframe,candle_time:open_time,exchange,currency,open_price,high_price,low_price,close_price,volume"
                )
                .in("instrument_id", symbols)
                .eq("timeframe", config.providerInterval)
                .order("open_time", { ascending: false })
                .limit(fetchLimit),
        ]);

        if (quoteHistoryResponse.error) {
            throw quoteHistoryResponse.error;
        }

        if (storedCandlesResponse.error) {
            throw storedCandlesResponse.error;
        }

        const rows = (quoteHistoryResponse.data ?? []) as QuoteHistoryRow[];
        const storedCandles = (storedCandlesResponse.data ?? []) as MarketCandleRow[];

        const results = await Promise.all(
            symbols.map(async (symbol) => {
                let symbolStoredRows = storedCandles.filter(
                    (row) => row.requested_symbol === symbol
                );
                const latestStoredCandle = symbolStoredRows[0];
                const hasFreshStoredHistory =
                    latestStoredCandle &&
                    Date.now() - new Date(latestStoredCandle.candle_time).getTime() <
                        getProviderFreshnessMs(config.providerInterval);

                try {
                    if (!hasFreshStoredHistory) {
                        try {
                            const refreshedCandles = await refreshSpecificIntervalIfNeeded(
                                symbol,
                                config.providerInterval,
                                config.range,
                                latestStoredCandle?.candle_time
                            );

                            if (Array.isArray(refreshedCandles) && refreshedCandles.length > 0) {
                                symbolStoredRows = refreshedCandles.map((candle) => ({
                                    requested_symbol: symbol,
                                    provider_symbol: symbol,
                                    interval: config.providerInterval,
                                    candle_time: candle.time,
                                    exchange: candle.exchange ?? null,
                                    currency: candle.currency ?? "USD",
                                    open_price: candle.open,
                                    high_price: candle.high,
                                    low_price: candle.low,
                                    close_price: candle.close,
                                    volume: candle.volume ?? null,
                                }));
                            }
                        } catch (refreshError) {
                            console.error("refreshSpecificIntervalIfNeeded error", {
                                symbol,
                                interval: config.providerInterval,
                                error: refreshError instanceof Error ? refreshError.message : refreshError,
                            });
                        }
                    }

                    let liveSeriesCandles: OhlcCandle[] = [];

                    if (shouldUseLiveTimeSeries(config.providerInterval)) {
                        try {
                            const liveSeries = await getTwelveDataTimeSeries(
                                symbol,
                                getTwelveDataInterval(config.providerInterval) ?? "1min",
                                Math.min(200, Math.max(60, limit * config.aggregateSize))
                            );

                            liveSeriesCandles = buildCandlesFromTimeSeriesValues(
                                liveSeries.values ?? [],
                                liveSeries.meta?.currency ?? "USD",
                                liveSeries.meta?.exchange ?? null
                            );
                        } catch (liveSeriesError) {
                            console.error("getTwelveDataTimeSeries error", {
                                symbol,
                                interval: config.providerInterval,
                                error: liveSeriesError instanceof Error ? liveSeriesError.message : liveSeriesError,
                            });
                        }
                    }

                    const storedOutput = aggregateCandlesByCount(
                        mergeStoredCandlesWithLiveCandles(
                            buildCandlesFromStoredRows(symbolStoredRows),
                            liveSeriesCandles
                        ),
                        config.aggregateSize
                    ).slice(-limit);
                    const hasStoredOutput = storedOutput.length > 0;

                    if (hasStoredOutput) {
                        return {
                            requestedSymbol: symbol,
                            ok: true,
                            timeframe: requestedTimeframe,
                            source: liveSeriesCandles.length > 0 ? "candles_live_series" : "candles",
                            backfillScheduled: false,
                            data: storedOutput,
                        };
                    }

                    const timeSeriesCandles = await fetchAndStoreYahooCandles(
                        symbol,
                        config.providerInterval,
                        config.range
                    );

                    const outputCandles = aggregateCandlesByCount(
                        timeSeriesCandles,
                        config.aggregateSize
                    ).slice(-limit);

                    if (outputCandles.length > 0) {
                        const latestCandle = outputCandles[outputCandles.length - 1];

                        try {
                            const quote = await getTwelveDataQuote(symbol);
                            await saveQuoteHistory({
                                requestedSymbol: symbol,
                                ...quote,
                            });
                        } catch {
                            const closeAsString = latestCandle.close.toString();
                            try {
                                await saveQuoteHistory({
                                    requestedSymbol: symbol,
                                    symbol,
                                    currency: latestCandle.currency,
                                    close: closeAsString,
                                    timestamp: latestCandle.time,
                                });
                            } catch {
                                // Ignore persistence problems and still return the live candles.
                            }
                        }
                    }

                    return {
                        requestedSymbol: symbol,
                        ok: outputCandles.length > 0,
                        timeframe: requestedTimeframe,
                        source:
                            symbolStoredRows.length >= Math.min(limit, 50) && hasFreshStoredHistory
                                ? "candles"
                                : "yahoo_finance",
                        backfillScheduled: true,
                        data: outputCandles,
                    };
                } catch (error) {
                    const symbolRows = rows
                        .filter((row) => row.requested_symbol === symbol)
                        .slice(-limit);
                    const fallbackCandles = buildCandlesFromQuoteRows(symbolRows);

                    return {
                        requestedSymbol: symbol,
                        ok: fallbackCandles.length > 0,
                        timeframe: requestedTimeframe,
                        source: "quote_history_fallback",
                        debugError:
                            error instanceof Error
                                ? error.message
                                : "Unknown Yahoo Finance history error",
                        data: fallbackCandles,
                    };
                }
            })
        );

        void Promise.allSettled(symbols.map((symbol) => backfillSymbolHistory(symbol))).catch(
            (error) => {
                console.error("backfillSymbolHistory batch error", error);
            }
        );

        const responsePayload: HistorySuccessPayload = {
            ok: true,
            results,
        };

        setCachedPayload(
            historyResponseCache,
            cacheKey,
            responsePayload,
            MAX_HISTORY_CACHE_ENTRIES
        );

        return buildJsonResponse(responsePayload, "MISS");
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error ? error.message : "Unexpected market history error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}



