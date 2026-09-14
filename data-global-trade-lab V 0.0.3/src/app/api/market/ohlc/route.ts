import { NextResponse } from "next/server";

import {
    aggregateCandlesByCount,
    buildCandlesFromStoredRows,
    type MarketCandleRow,
} from "@/app/utils/market/ohlc";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getConfigForTimeframe } from "@/app/utils/market/timeframes";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function buildSymbolCandidates(rawSymbol: string) {
    const normalizedSymbol = rawSymbol.trim().toUpperCase();
    if (!normalizedSymbol) {
        return [];
    }

    return [...new Set([
        normalizedSymbol,
        normalizedSymbol.replace(/\//g, ""),
    ])];
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
        const symbolCandidates = buildSymbolCandidates(symbol);
        const storedCandlesQuery = supabaseAdmin
            .from("candles")
            .select(
                "requested_symbol:instrument_id,provider_symbol,interval:timeframe,candle_time:open_time,exchange,currency,open_price,high_price,low_price,close_price,volume"
            )
            .eq("timeframe", config.providerInterval)
            .order("open_time", { ascending: false })
            .limit(fetchLimit);

        const { data, error } = symbolCandidates.length === 1
            ? await storedCandlesQuery.eq("instrument_id", symbolCandidates[0])
            : await storedCandlesQuery.in("instrument_id", symbolCandidates);

        if (error) {
            console.error("stored OHLC read unavailable; using live providers", error);
        }

        const rawCandles = buildCandlesFromStoredRows(
            (error ? [] : data ?? []) as MarketCandleRow[]
        );
        const candles = aggregateCandlesByCount(rawCandles, config.aggregateSize).slice(-limit);

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



