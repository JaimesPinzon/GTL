import { NextResponse } from "next/server";

import {
    getLastCandleMarketBySymbols,
    type LastCandleMarketSnapshot,
} from "@/app/utils/market/last-candle-market";
import { type MarketQuotePayload } from "@/app/utils/market/quotes-cache";

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
    const symbol = searchParams.get("symbol")?.trim() ?? "AAPL";

    const toSnapshotQuotePayload = (
        snapshot: LastCandleMarketSnapshot
    ): MarketQuotePayload => ({
        symbol: snapshot.providerSymbol || snapshot.symbol,
        name: snapshot.assetName ?? undefined,
        exchange: snapshot.exchange ?? undefined,
        currency: snapshot.currency ?? undefined,
        close: String(snapshot.price),
        is_market_open:
            typeof snapshot.isMarketOpen === "boolean"
                ? snapshot.isMarketOpen
                : undefined,
        percent_change:
            Number.isFinite(snapshot.percentChange ?? NaN)
                ? String(snapshot.percentChange)
                : undefined,
        timestamp: snapshot.candleTime,
    });

    try {
        const latestSnapshotBySymbol = await getLastCandleMarketBySymbols([symbol]);
        const snapshot = latestSnapshotBySymbol.get(symbol.toUpperCase()) || null;

        if (snapshot && Number.isFinite(snapshot.price) && snapshot.price > 0) {
            return NextResponse.json(
                {
                    ok: true,
                    source: "supabase_snapshot",
                    stale: snapshot.isStale,
                    data: toSnapshotQuotePayload(snapshot),
                    persisted: false,
                    cacheTtlMs: 108000,
                },
                {
                    headers: corsHeaders,
                }
            );
        }

        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                source: "supabase_snapshot",
                error: `Missing snapshot payload for ${symbol}`,
                data: null,
                persisted: false,
            },
            {
                headers: corsHeaders,
            }
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unexpected snapshot quote error";

        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                error: message,
                data: null,
                persisted: false,
            },
            {
                headers: corsHeaders,
            }
        );
    }
}
