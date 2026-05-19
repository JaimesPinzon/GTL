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
import { saveQuoteHistory } from "@/app/utils/twelvedata/history";

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
        const [entry] = await getCachedOrFetchBatchQuotes([symbol]);
        const data = entry?.data ?? null;

        if (!data || !isValidLiveQuote(data)) {
            const latestSnapshotBySymbol = await getLastCandleMarketBySymbols([symbol]);
            const snapshot = latestSnapshotBySymbol.get(symbol.toUpperCase()) || null;

            if (snapshot && Number.isFinite(snapshot.price) && snapshot.price > 0) {
                return NextResponse.json(
                    {
                        ok: true,
                        degraded: true,
                        source: "supabase_snapshot",
                        stale: snapshot.isStale,
                        data: toSnapshotQuotePayload(snapshot),
                        persisted: false,
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
                    error:
                        data?.message ?? `Missing TwelveData payload for ${symbol}`,
                    data: null,
                    persisted: false,
                },
                {
                    headers: corsHeaders,
                }
            );
        }

        let persisted = true;

        try {
            await saveQuoteHistory({
                requestedSymbol: symbol,
                ...data,
            });
            await upsertLastCandleMarketBatch([
                {
                    requestedSymbol: symbol,
                    ...data,
                },
            ]);
        } catch {
            persisted = false;
        }

        return NextResponse.json(
            {
                ok: true,
                data,
                persisted,
                cacheTtlMs: 108000,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unexpected TwelveData error";

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
