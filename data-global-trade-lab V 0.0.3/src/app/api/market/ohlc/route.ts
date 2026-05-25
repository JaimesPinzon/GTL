import { NextResponse } from "next/server";

import {
    aggregateCandlesByCount,
    buildCandlesFromStoredRows,
    buildCandlesFromTimeSeriesValues,
    fetchAndStoreYahooCandles,
    mergeStoredCandlesWithLiveCandles,
    type MarketCandleRow,
} from "@/app/utils/market/ohlc";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getTwelveDataTimeSeries } from "@/app/utils/twelvedata/server";
import { getConfigForTimeframe, getProviderFreshnessMs } from "@/app/utils/market/timeframes";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "1M";
    const limit = Number.parseInt(searchParams.get("limit") ?? "300", 10);
    const config = getConfigForTimeframe(timeframe);

    if (!symbol) {
        return NextResponse.json(
            { ok: false, error: "symbol is required" },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        const fetchLimit = Math.max(limit, 1200);
        const { data, error } = await supabaseAdmin
            .from("candles")
            .select(
                "requested_symbol:instrument_id,provider_symbol,interval:timeframe,candle_time:open_time,exchange,currency,open_price,high_price,low_price,close_price,volume"
            )
            .eq("instrument_id", symbol)
            .eq("timeframe", config.providerInterval)
            .order("open_time", { ascending: false })
            .limit(fetchLimit);

        if (error) {
            throw error;
        }

        let rawCandles = buildCandlesFromStoredRows((data ?? []) as MarketCandleRow[]);
        const latestStoredCandle = (data ?? [])[0] as MarketCandleRow | undefined;
        const hasFreshStoredHistory =
            latestStoredCandle &&
            Date.now() - new Date(latestStoredCandle.candle_time).getTime() <
                getProviderFreshnessMs(config.providerInterval);

        if (!hasFreshStoredHistory) {
            try {
                rawCandles = await fetchAndStoreYahooCandles(
                    symbol,
                    config.providerInterval,
                    config.range
                );
            } catch (refreshError) {
                console.error("fetchAndStoreYahooCandles refresh error", refreshError);
            }
        }

        if (shouldUseLiveTimeSeries(config.providerInterval)) {
            try {
                const liveSeries = await getTwelveDataTimeSeries(
                    symbol,
                    getTwelveDataInterval(config.providerInterval) ?? "1min",
                    Math.min(200, Math.max(60, limit * config.aggregateSize))
                );

                const liveCandles = buildCandlesFromTimeSeriesValues(
                    liveSeries.values ?? [],
                    liveSeries.meta?.currency ?? rawCandles[rawCandles.length - 1]?.currency ?? "USD",
                    liveSeries.meta?.exchange ?? rawCandles[rawCandles.length - 1]?.exchange ?? null
                );

                rawCandles = mergeStoredCandlesWithLiveCandles(rawCandles, liveCandles);
            } catch (liveSeriesError) {
                console.error("getTwelveDataTimeSeries error", liveSeriesError);
            }
        }

        let candles = aggregateCandlesByCount(rawCandles, config.aggregateSize).slice(-limit);

        if (candles.length === 0) {
            const fetched = await fetchAndStoreYahooCandles(symbol, config.providerInterval, config.range);
            candles = aggregateCandlesByCount(fetched, config.aggregateSize).slice(-limit);
        }

        return NextResponse.json(
            {
                ok: true,
                symbol,
                timeframe,
                data: candles,
            },
            {
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
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



