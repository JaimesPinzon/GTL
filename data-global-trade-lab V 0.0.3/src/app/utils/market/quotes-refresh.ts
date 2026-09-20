import "server-only";

import { upsertLastCandleMarketBatch } from "@/app/utils/market/last-candle-market";
import {
    acquireMarketQuotesRefreshLock,
    markMarketQuotesRefreshComplete,
} from "@/app/utils/market/refresh-control";
import { normalizeMarketSymbols, parseTrackedSymbols } from "@/app/utils/market/symbols";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { saveQuoteHistoryBatch } from "@/app/utils/twelvedata/history";
import { getTwelveDataQuotes } from "@/app/utils/twelvedata/server";
import { fetchAndStoreTwelveDataCandles } from "@/app/utils/market/ohlc";

type RefreshableQuote = {
    requestedSymbol: string;
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
    price?: string;
    close?: string;
    open?: string;
    high?: string;
    low?: string;
    volume?: string;
    is_market_open?: boolean;
    percent_change?: string;
    timestamp?: string;
    status?: string;
    code?: number;
    message?: string;
};

export type MarketQuotesRefreshResult = {
    ok: boolean;
    skipped: boolean;
    reason: string | null;
    refreshedAt: string;
    symbols: string[];
    lockBypassed: boolean;
    persistedSnapshot: boolean;
    persistedHistory: boolean;
    persistedCandles: boolean;
    snapshotPersistError: string | null;
    historyPersistError: string | null;
    candlePersistError: string | null;
    successfulQuotesCount: number;
    results: Array<{
        requestedSymbol: string;
        ok: boolean;
        error?: string;
    }>;
};

const DEFAULT_REFRESH_INTERVAL_MS = 108000;
const SNAPSHOT_SOURCE = "twelvedata";

const parseNumeric = (value: unknown) => {
    const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
};

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

const isSuccessfulQuote = (quote: RefreshableQuote) => {
    if (quote.status === "error" || quote.code || quote.message) {
        return false;
    }

    const price = parseNumeric(quote.close ?? quote.price);
    return Number.isFinite(price) && (price as number) > 0;
};

export async function refreshTrackedQuotesIfDue({
    symbols,
}: {
    symbols?: string[];
} = {}): Promise<MarketQuotesRefreshResult> {
    const resolvedSymbols = Array.isArray(symbols) && symbols.length > 0
        ? normalizeMarketSymbols(symbols)
        : parseTrackedSymbols(null);

    if (resolvedSymbols.length === 0) {
        return {
            ok: true,
            skipped: true,
            reason: "no_symbols_configured",
            refreshedAt: new Date().toISOString(),
            symbols: [],
            lockBypassed: false,
            persistedSnapshot: false,
            persistedHistory: false,
            persistedCandles: false,
            snapshotPersistError: null,
            historyPersistError: null,
            candlePersistError: null,
            successfulQuotesCount: 0,
            results: [],
        };
    }

    const minIntervalMs = resolveRefreshIntervalMs();
    let lockAcquired = false;

    try {
        lockAcquired = await acquireMarketQuotesRefreshLock({
            minIntervalMs,
            lockWindowMs: minIntervalMs,
        });
    } catch (error) {
        return {
            ok: false,
            skipped: true,
            reason: "refresh_lock_unavailable",
            refreshedAt: new Date().toISOString(),
            symbols: resolvedSymbols,
            lockBypassed: false,
            persistedSnapshot: false,
            persistedHistory: false,
            persistedCandles: false,
            snapshotPersistError:
                error instanceof Error ? error.message : "refresh_lock_unavailable",
            historyPersistError: null,
            candlePersistError: null,
            successfulQuotesCount: 0,
            results: [],
        };
    }

    if (!lockAcquired) {
        return {
            ok: true,
            skipped: true,
            reason: "refresh_window_locked_or_not_due",
            refreshedAt: new Date().toISOString(),
            symbols: resolvedSymbols,
            lockBypassed: false,
            persistedSnapshot: false,
            persistedHistory: false,
            persistedCandles: false,
            snapshotPersistError: null,
            historyPersistError: null,
            candlePersistError: null,
            successfulQuotesCount: 0,
            results: [],
        };
    }

    const quoteResponses = await getTwelveDataQuotes(resolvedSymbols);
    const successfulQuotes = quoteResponses
        .map(({ requestedSymbol, data }) => {
            const {
                requestedSymbol: ignoredRequestedSymbol,
                ...quoteData
            } = data as RefreshableQuote & { requestedSymbol?: string };
            void ignoredRequestedSymbol;
            return {
                requestedSymbol,
                ...quoteData,
                close: quoteData.close ?? quoteData.price,
            };
        })
        .filter((quote) => isSuccessfulQuote(quote as RefreshableQuote));

    let persistedSnapshot = true;
    let persistedHistory = true;
    let persistedCandles = true;
    let snapshotPersistError: string | null = null;
    let historyPersistError: string | null = null;
    let candlePersistError: string | null = null;

    try {
        await upsertLastCandleMarketBatch(successfulQuotes);
        await markMarketQuotesRefreshComplete();
    } catch (error) {
        persistedSnapshot = false;
        snapshotPersistError =
            error instanceof Error
                ? error.message
                : "last_candle_market_upsert_failed";

        // Keep the lock until its TTL expires. Twelve Data was already called,
        // so an immediate retry would only spend the same credits again.
    }

    try {
        await saveQuoteHistoryBatch(successfulQuotes, { syncSnapshot: false });
    } catch (error) {
        persistedHistory = false;
        historyPersistError =
            error instanceof Error
                ? error.message
                : "quote_history_insert_failed";
    }

    const candleRefreshResults = await Promise.allSettled(
        successfulQuotes.map((quote) =>
            fetchAndStoreTwelveDataCandles(quote.requestedSymbol, "1m", 12)
        )
    );
    const candleFailures = candleRefreshResults
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

    if (candleFailures.length > 0) {
        persistedCandles = false;
        candlePersistError = candleFailures.join(" | ");
    }

    try {
        const symbolsListForSql = `(${resolvedSymbols.map((symbol) => `"${symbol.replace(/"/g, '\\"')}"`).join(",")})`;
        const { error: cleanupError } = await supabaseAdmin
            .from("last_candle_market")
            .delete()
            .eq("source", SNAPSHOT_SOURCE)
            .not("symbol", "in", symbolsListForSql);

        if (cleanupError) {
            historyPersistError = historyPersistError
                ? `${historyPersistError}; snapshot_cleanup_failed: ${cleanupError.message}`
                : `snapshot_cleanup_failed: ${cleanupError.message}`;
        }
    } catch (cleanupUnknownError) {
        const cleanupMessage =
            cleanupUnknownError instanceof Error
                ? cleanupUnknownError.message
                : "snapshot_cleanup_failed";
        historyPersistError = historyPersistError
            ? `${historyPersistError}; ${cleanupMessage}`
            : cleanupMessage;
    }

    return {
        ok: true,
        skipped: false,
        reason: null,
        refreshedAt: new Date().toISOString(),
        symbols: resolvedSymbols,
        lockBypassed: false,
        persistedSnapshot,
        persistedHistory,
        persistedCandles,
        snapshotPersistError,
        historyPersistError,
        candlePersistError,
        successfulQuotesCount: successfulQuotes.length,
        results: quoteResponses.map(({ requestedSymbol, data }) => ({
            requestedSymbol,
            ok: !(data.status === "error" || data.code || data.message),
            error:
                data.status === "error" || data.code || data.message
                    ? data.message ?? "Unexpected TwelveData error"
                    : undefined,
        })),
    };
}
