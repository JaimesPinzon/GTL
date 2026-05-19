import { NextResponse } from "next/server";

import {
    getLastCandleMarketBySymbols,
    type LastCandleMarketSnapshot,
    upsertLastCandleMarketBatch,
} from "@/app/utils/market/last-candle-market";
import {
    getCachedOrFetchBatchQuotes,
    type MarketQuotePayload,
} from "@/app/utils/market/quotes-cache";
import { saveQuoteHistoryBatch } from "@/app/utils/twelvedata/history";

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

    const isProviderError = (data: MarketQuotePayload) =>
        data.status === "error" || Boolean(data.code) || Boolean(data.message);

    const isValidLiveQuote = (data: MarketQuotePayload) => {
        if (isProviderError(data)) {
            return false;
        }

        const closePrice = Number.parseFloat(String(data.close ?? ""));
        return Number.isFinite(closePrice) && closePrice > 0;
    };

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
        const quoteResponses = await getCachedOrFetchBatchQuotes(symbols);
        const latestSnapshotsBySymbol = await getLastCandleMarketBySymbols(symbols);
        const successfulLiveQuotes = quoteResponses
            .filter(({ data }) => isValidLiveQuote(data))
            .map(({ requestedSymbol, data }) => ({
                requestedSymbol,
                ...data,
            }));

        let persisted = true;
        try {
            await Promise.all([
                saveQuoteHistoryBatch(successfulLiveQuotes),
                upsertLastCandleMarketBatch(successfulLiveQuotes),
            ]);
        } catch {
            persisted = false;
        }

        const results = quoteResponses.map(({ requestedSymbol, data }) => {
            if (isValidLiveQuote(data)) {
                return {
                    requestedSymbol,
                    ok: true,
                    persisted,
                    source: "twelvedata_live",
                    stale: false,
                    data,
                };
            }

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
                error:
                    data.message ??
                    `Missing TwelveData payload for ${requestedSymbol}`,
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
