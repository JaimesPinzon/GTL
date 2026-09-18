import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { buildCandlesFromStoredRows, aggregateCandlesByCount, type MarketCandleRow } from "@/app/utils/market/ohlc";
import { buildEmaSeries, buildMacdSeries } from "@/app/utils/market/indicators";
import { getConfigForTimeframe } from "@/app/utils/market/timeframes";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";

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
    const emaPeriod = Number.parseInt(searchParams.get("emaPeriod") ?? "20", 10);
    const macdShortPeriod = Number.parseInt(searchParams.get("macdShortPeriod") ?? "12", 10);
    const macdLongPeriod = Number.parseInt(searchParams.get("macdLongPeriod") ?? "26", 10);
    const macdSignalPeriod = Number.parseInt(searchParams.get("macdSignalPeriod") ?? "9", 10);
    const config = getConfigForTimeframe(timeframe);

    if (!symbol) {
        return NextResponse.json(
            { ok: false, error: "symbol is required" },
            { status: 400, headers: corsHeaders }
        );
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("candles")
            .select(
                "requested_symbol:instrument_id,provider_symbol,interval:timeframe,candle_time:open_time,exchange,currency,open_price,high_price,low_price,close_price,volume"
            )
            .eq("instrument_id", symbol)
            .eq("timeframe", config.providerInterval)
            .order("open_time", { ascending: false })
            .limit(Math.max(limit, 1200));

        if (error) {
            throw error;
        }

        const candles = aggregateCandlesByCount(
            buildCandlesFromStoredRows((data ?? []) as MarketCandleRow[]),
            config.aggregateSize
        ).slice(-limit);

        const candleTimes = candles.map((candle) => candle.time);
        const closes = candles.map((candle) => candle.close);
        const ema = buildEmaSeries(candleTimes, closes, emaPeriod).filter((entry) => entry.time);
        const macdSeries = buildMacdSeries(
            candleTimes,
            closes,
            macdShortPeriod,
            macdLongPeriod,
            macdSignalPeriod
        );

        return NextResponse.json(
            {
                ok: true,
                symbol,
                timeframe,
                emaPeriod,
                data: {
                    ema,
                    macdLine: macdSeries.macdLine.filter((entry) => entry.time),
                    signalLine: macdSeries.signalLine.filter((entry) => entry.time),
                    histogram: macdSeries.histogram.filter((entry) => entry.time),
                },
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Unexpected indicators error",
            },
            { status: 500, headers: corsHeaders }
        );
    }
}


