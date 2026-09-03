import { NextResponse } from "next/server";

import { listLastCandleMarketSnapshots } from "@/app/utils/market/last-candle-market";
import { parseTrackedSymbols } from "@/app/utils/market/symbols";
import { refreshTrackedQuotesIfDue } from "@/app/utils/market/quotes-refresh";

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

const getFetchedAtAgeMs = (value: string) => {
    const fetchedAtMs = Date.parse(value);
    if (!Number.isFinite(fetchedAtMs)) {
        return Number.POSITIVE_INFINITY;
    }

    return Date.now() - fetchedAtMs;
};

const shouldAutoRefreshSnapshots = ({
    rows,
    symbols,
    maxAgeMs,
}: {
    rows: Array<{ symbol: string; fetchedAt: string }>;
    symbols: string[];
    maxAgeMs: number;
}) => {
    if (rows.length === 0) {
        return true;
    }

    const normalizedRequestedSymbols = [...new Set(
        symbols
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean)
    )];

    if (normalizedRequestedSymbols.length > 0) {
        const fetchedBySymbol = new Map(
            rows.map((row) => [String(row.symbol || "").trim().toUpperCase(), row])
        );

        for (const symbol of normalizedRequestedSymbols) {
            const row = fetchedBySymbol.get(symbol);
            if (!row) {
                return true;
            }

            if (getFetchedAtAgeMs(row.fetchedAt) > maxAgeMs) {
                return true;
            }
        }

        return false;
    }

    const newestFetchedAtAge = Math.min(
        ...rows.map((row) => getFetchedAtAgeMs(row.fetchedAt))
    );

    return !Number.isFinite(newestFetchedAtAge) || newestFetchedAtAge > maxAgeMs;
};

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawLimit = Number.parseInt(searchParams.get("limit") || "300", 10);
    const source = searchParams.get("source")?.trim() || "twelvedata";
    const rawSymbols = searchParams.get("symbols")?.trim() || "";
    const symbols = rawSymbols
        ? rawSymbols
            .split(",")
            .map((symbol) => symbol.trim())
            .filter(Boolean)
        : parseTrackedSymbols(null);

    try {
        let rows = await listLastCandleMarketSnapshots({
            limit: rawLimit,
            source,
            symbols,
        });
        let refreshInfo: Awaited<ReturnType<typeof refreshTrackedQuotesIfDue>> | null = null;

        if (
            source === "twelvedata" &&
            shouldAutoRefreshSnapshots({
                rows: rows.map((row) => ({ symbol: row.symbol, fetchedAt: row.fetchedAt })),
                symbols,
                maxAgeMs: resolveRefreshIntervalMs(),
            })
        ) {
            refreshInfo = await refreshTrackedQuotesIfDue({
                symbols: symbols.length > 0 ? symbols : undefined,
            });

            rows = await listLastCandleMarketSnapshots({
                limit: rawLimit,
                source,
                symbols,
            });

            if (
                refreshInfo?.skipped &&
                refreshInfo.reason === "refresh_window_locked_or_not_due" &&
                shouldAutoRefreshSnapshots({
                    rows: rows.map((row) => ({ symbol: row.symbol, fetchedAt: row.fetchedAt })),
                    symbols,
                    maxAgeMs: resolveRefreshIntervalMs(),
                })
            ) {
                refreshInfo = await refreshTrackedQuotesIfDue({
                    symbols: symbols.length > 0 ? symbols : undefined,
                    force: true,
                });

                rows = await listLastCandleMarketSnapshots({
                    limit: rawLimit,
                    source,
                    symbols,
                });
            }
        }

        return NextResponse.json(
            {
                ok: true,
                count: rows.length,
                cacheTtlMs: 60000,
                autoRefresh: refreshInfo,
                rows,
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
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unexpected last candle market fetch error",
                rows: [],
            },
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
