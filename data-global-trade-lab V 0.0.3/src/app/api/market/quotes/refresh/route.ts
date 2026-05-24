import { NextResponse } from "next/server";

import { upsertLastCandleMarketBatch } from "@/app/utils/market/last-candle-market";
import {
    acquireMarketQuotesRefreshLock,
    markMarketQuotesRefreshComplete,
    releaseMarketQuotesRefreshLock,
} from "@/app/utils/market/refresh-control";
import { parseTrackedSymbols } from "@/app/utils/market/symbols";
import { saveQuoteHistoryBatch } from "@/app/utils/twelvedata/history";
import { getTwelveDataQuotes } from "@/app/utils/twelvedata/server";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function isAuthorized(request: Request) {
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (!cronSecret) {
        return true;
    }

    const authorizationHeader = request.headers.get("authorization")?.trim();
    return authorizationHeader === `Bearer ${cronSecret}`;
}

export const runtime = "nodejs";

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

async function handleRefresh(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                ok: false,
                error: "Unauthorized refresh request",
            },
            {
                status: 401,
                headers: corsHeaders,
            }
        );
    }

    const { searchParams } = new URL(request.url);
    const symbols = parseTrackedSymbols(searchParams.get("symbols"));
    const minIntervalMs = Number.parseInt(
        String(process.env.MARKET_QUOTES_REFRESH_TTL_MS ?? "108000"),
        10
    );

    try {
        let lockAcquired = true;
        let lockBypassed = false;
        try {
            lockAcquired = await acquireMarketQuotesRefreshLock({
                minIntervalMs:
                    Number.isFinite(minIntervalMs) && minIntervalMs > 0
                        ? minIntervalMs
                        : 108000,
            });
        } catch {
            lockAcquired = true;
            lockBypassed = true;
        }

        if (!lockAcquired) {
            return NextResponse.json(
                {
                    ok: true,
                    skipped: true,
                    reason: "refresh_window_locked_or_not_due",
                    refreshedAt: new Date().toISOString(),
                    symbols,
                    results: [],
                },
                { headers: corsHeaders }
            );
        }

        const quoteResponses = await getTwelveDataQuotes(symbols);
        const successfulQuotes = quoteResponses
            .filter(({ data }) => !(data.status === "error" || data.code || data.message))
            .map(({ requestedSymbol, data }) => ({
                requestedSymbol,
                ...data,
            }));

        let persistedSnapshot = true;
        let persistedHistory = true;
        let snapshotPersistError: string | null = null;
        let historyPersistError: string | null = null;
        try {
            await upsertLastCandleMarketBatch(successfulQuotes);
            if (!lockBypassed) {
                await markMarketQuotesRefreshComplete();
            }
        } catch {
            persistedSnapshot = false;
            snapshotPersistError = "last_candle_market_upsert_failed";
            if (!lockBypassed) {
                await releaseMarketQuotesRefreshLock();
            }
        }

        if (persistedSnapshot) {
            try {
                await saveQuoteHistoryBatch(successfulQuotes);
            } catch {
                persistedHistory = false;
                historyPersistError = "quote_history_insert_failed";
            }
        } else {
            persistedHistory = false;
            historyPersistError = "quote_history_skipped_due_snapshot_failure";
        }

        const results = quoteResponses.map(({ requestedSymbol, data }) => {
            if (data.status === "error" || data.code || data.message) {
                return {
                    requestedSymbol,
                    ok: false,
                    error: data.message ?? "Unexpected TwelveData error",
                };
            }

            return {
                requestedSymbol,
                ok: true,
                persistedSnapshot,
                persistedHistory,
                data,
            };
        });

        return NextResponse.json(
            {
                ok: true,
                refreshedAt: new Date().toISOString(),
                symbols,
                lockBypassed,
                persistedSnapshot,
                persistedHistory,
                snapshotPersistError,
                historyPersistError,
                successfulQuotesCount: successfulQuotes.length,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        try {
            await releaseMarketQuotesRefreshLock();
        } catch {
            // Ignore unlock errors here; original error is more relevant.
        }

        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error ? error.message : "Unexpected scheduled quote refresh error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}

export async function GET(request: Request) {
    return handleRefresh(request);
}

export async function POST(request: Request) {
    return handleRefresh(request);
}
