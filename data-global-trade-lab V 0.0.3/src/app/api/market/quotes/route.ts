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

const getSnapshotAgeMs = (snapshot: LastCandleMarketSnapshot | null) => {
    if (!snapshot) {
        return Number.POSITIVE_INFINITY;
    }

    const fetchedAtMs = Date.parse(snapshot.fetchedAt);
    if (!Number.isFinite(fetchedAtMs)) {
        return Number.POSITIVE_INFINITY;
    }

    return Date.now() - fetchedAtMs;
};

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

    const buildResults = (latestSnapshotsBySymbol: Map<string, LastCandleMarketSnapshot>) =>
        symbols.map((requestedSymbol) => {
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

    const shouldAutoRefresh = (latestSnapshotsBySymbol: Map<string, LastCandleMarketSnapshot>) => {
        const maxAgeMs = resolveRefreshIntervalMs();
        return symbols.some((symbol) => {
            const snapshot = latestSnapshotsBySymbol.get(symbol.toUpperCase()) || null;
            if (!snapshot) {
                return true;
            }

            if (!Number.isFinite(snapshot.price) || snapshot.price <= 0) {
                return true;
            }

            return getSnapshotAgeMs(snapshot) > maxAgeMs;
        });
    };

    try {
        let latestSnapshotsBySymbol = await getLastCandleMarketBySymbols(symbols);
        let autoRefresh: Awaited<ReturnType<typeof refreshTrackedQuotesIfDue>> | null = null;

        if (shouldAutoRefresh(latestSnapshotsBySymbol)) {
            autoRefresh = await refreshTrackedQuotesIfDue({ symbols });
            latestSnapshotsBySymbol = await getLastCandleMarketBySymbols(symbols);

            if (
                shouldAutoRefresh(latestSnapshotsBySymbol) &&
                autoRefresh?.skipped &&
                autoRefresh.reason === "refresh_window_locked_or_not_due"
            ) {
                autoRefresh = await refreshTrackedQuotesIfDue({
                    symbols,
                    force: true,
                });
                latestSnapshotsBySymbol = await getLastCandleMarketBySymbols(symbols);
            }
        }

        const results = buildResults(latestSnapshotsBySymbol);

        return NextResponse.json(
            {
                ok: true,
                cacheTtlMs: 108000,
                autoRefresh,
                results,
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
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
