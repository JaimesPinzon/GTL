import { NextResponse } from "next/server";

import {
    getLastCandleMarketBySymbols,
    type LastCandleMarketSnapshot,
} from "@/app/utils/market/last-candle-market";
import { refreshTrackedQuotesIfDue } from "@/app/utils/market/quotes-refresh";
import { type MarketQuotePayload } from "@/app/utils/market/quotes-cache";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_REFRESH_INTERVAL_MS = 108000;

const resolveRefreshIntervalMs = () => {
    const raw = Number.parseInt(
        String(process.env.MARKET_QUOTES_REFRESH_TTL_MS ?? ""),
        10
    );

    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }

    return DEFAULT_REFRESH_INTERVAL_MS;
};

const isSnapshotExpired = (snapshot: LastCandleMarketSnapshot | null) => {
    if (!snapshot) {
        return true;
    }

    if (!Number.isFinite(snapshot.price) || snapshot.price <= 0) {
        return true;
    }

    const fetchedAtMs = Date.parse(snapshot.fetchedAt);
    if (!Number.isFinite(fetchedAtMs)) {
        return true;
    }

    return Date.now() - fetchedAtMs > resolveRefreshIntervalMs();
};

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
        let latestSnapshotBySymbol = await getLastCandleMarketBySymbols([symbol]);
        let snapshot = latestSnapshotBySymbol.get(symbol.toUpperCase()) || null;
        let autoRefresh: Awaited<ReturnType<typeof refreshTrackedQuotesIfDue>> | null = null;

        if (isSnapshotExpired(snapshot)) {
            autoRefresh = await refreshTrackedQuotesIfDue({ symbols: [symbol] });
            latestSnapshotBySymbol = await getLastCandleMarketBySymbols([symbol]);
            snapshot = latestSnapshotBySymbol.get(symbol.toUpperCase()) || null;
        }

        if (snapshot && Number.isFinite(snapshot.price) && snapshot.price > 0) {
            return NextResponse.json(
                {
                    ok: true,
                    source: "supabase_snapshot",
                    stale: snapshot.isStale,
                    autoRefresh,
                    data: toSnapshotQuotePayload(snapshot),
                    persisted: false,
                    cacheTtlMs: 108000,
                },
                {
                    headers: {
                        ...corsHeaders,
                        "Cache-Control": "no-store",
                    },
                }
            );
        }

        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                source: "supabase_snapshot",
                error: `Missing snapshot payload for ${symbol}`,
                autoRefresh,
                data: null,
                persisted: false,
            },
            {
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
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
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
