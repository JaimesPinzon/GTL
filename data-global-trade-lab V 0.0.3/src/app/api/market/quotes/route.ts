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
    const rawSymbols = searchParams.get("symbols")?.trim() ?? "AAPL";
    const symbols = rawSymbols
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);

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
        const latestSnapshotsBySymbol = await getLastCandleMarketBySymbols(symbols);
        const results = symbols.map((requestedSymbol) => {
            const snapshot =
                latestSnapshotsBySymbol.get(requestedSymbol.toUpperCase()) || null;

            if (snapshot && Number.isFinite(snapshot.price) && snapshot.price > 0) {
                return {
                    requestedSymbol,
                    ok: true,
                    persisted: false,
                    source: "supabase_snapshot",
                    stale: snapshot.isStale,
                    data: toSnapshotQuotePayload(snapshot),
                };
            }

            return {
                requestedSymbol,
                ok: false,
                source: "supabase_snapshot",
                error: `Missing snapshot payload for ${requestedSymbol}`,
            };
        });

        return NextResponse.json(
            {
                ok: true,
                cacheTtlMs: 108000,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                error:
                    error instanceof Error ? error.message : "Unexpected batch quote error",
                results: symbols.map((requestedSymbol) => ({
                    requestedSymbol,
                    ok: false,
                    error:
                        error instanceof Error ? error.message : "Unexpected batch quote error",
                })),
            },
            {
                headers: corsHeaders,
            }
        );
    }
}
