import "server-only";

import { upsertLastCandleMarketBatch } from "@/app/utils/market/last-candle-market";
import {
    acquireMarketQuotesRefreshLock,
    markMarketQuotesRefreshComplete,
    releaseMarketQuotesRefreshLock,
} from "@/app/utils/market/refresh-control";
import { parseTrackedSymbols } from "@/app/utils/market/symbols";
import { saveQuoteHistoryBatch } from "@/app/utils/twelvedata/history";
import { getTwelveDataQuotes } from "@/app/utils/twelvedata/server";

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
    snapshotPersistError: string | null;
    historyPersistError: string | null;
    successfulQuotesCount: number;
    results: Array<{
        requestedSymbol: string;
        ok: boolean;
        error?: string;
    }>;
};

const DEFAULT_REFRESH_INTERVAL_MS = 108000;

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
    force = false,
}: {
    symbols?: string[];
    force?: boolean;
} = {}): Promise<MarketQuotesRefreshResult> {
    const resolvedSymbols = Array.isArray(symbols) && symbols.length > 0
        ? [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))]
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
            snapshotPersistError: null,
            historyPersistError: null,
            successfulQuotesCount: 0,
            results: [],
        };
    }

    const minIntervalMs = resolveRefreshIntervalMs();
    let lockAcquired = true;
    let lockBypassed = false;

    if (!force) {
        try {
            lockAcquired = await acquireMarketQuotesRefreshLock({
                minIntervalMs,
            });
        } catch {
            lockAcquired = true;
            lockBypassed = true;
        }
    }

    if (!lockAcquired) {
        return {
            ok: true,
            skipped: true,
            reason: "refresh_window_locked_or_not_due",
            refreshedAt: new Date().toISOString(),
            symbols: resolvedSymbols,
            lockBypassed,
            persistedSnapshot: false,
            persistedHistory: false,
            snapshotPersistError: null,
            historyPersistError: null,
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
    let snapshotPersistError: string | null = null;
    let historyPersistError: string | null = null;

    try {
        await upsertLastCandleMarketBatch(successfulQuotes);
        if (!lockBypassed && !force) {
            await markMarketQuotesRefreshComplete();
        }
    } catch (error) {
        persistedSnapshot = false;
        snapshotPersistError =
            error instanceof Error
                ? error.message
                : "last_candle_market_upsert_failed";

        if (!lockBypassed && !force) {
            try {
                await releaseMarketQuotesRefreshLock();
            } catch {
                // Ignore unlock error and preserve original snapshot error.
            }
        }
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

    return {
        ok: true,
        skipped: false,
        reason: null,
        refreshedAt: new Date().toISOString(),
        symbols: resolvedSymbols,
        lockBypassed,
        persistedSnapshot,
        persistedHistory,
        snapshotPersistError,
        historyPersistError,
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
