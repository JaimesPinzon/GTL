import "server-only";

import { upsertLastCandleMarketBatch } from "@/app/utils/market/last-candle-market";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

type QuoteHistoryPayload = {
    requestedSymbol: string;
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
    price?: string;
    close?: string;
    is_market_open?: boolean | string | number | null;
    percent_change?: string;
    timestamp?: string;
};

const toNullableBoolean = (value: unknown) => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        if (value === 1) {
            return true;
        }
        if (value === 0) {
            return false;
        }
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "t", "1", "yes", "y", "on", "open"].includes(normalized)) {
            return true;
        }
        if (["false", "f", "0", "no", "n", "off", "closed"].includes(normalized)) {
            return false;
        }
    }

    return null;
};

const buildQuoteHistoryRow = (quote: QuoteHistoryPayload) => {
    const close = Number.parseFloat((quote.close ?? quote.price ?? "").replace(/,/g, ""));
    const percentChange = Number.parseFloat(quote.percent_change ?? "");

    return {
        requested_symbol: quote.requestedSymbol,
        provider_symbol: quote.symbol ?? quote.requestedSymbol,
        asset_name: quote.name ?? null,
        exchange: quote.exchange ?? null,
        currency: quote.currency ?? null,
        close_price: Number.isFinite(close) ? close : null,
        is_market_open: toNullableBoolean(quote.is_market_open),
        percent_change: Number.isFinite(percentChange) ? percentChange : null,
        provider_timestamp: quote.timestamp ?? null,
        raw_payload: quote,
    };
};

export async function saveQuoteHistory(quote: QuoteHistoryPayload) {
    await saveQuoteHistoryBatch([quote]);
}

export async function saveQuoteHistoryBatch(
    quotes: QuoteHistoryPayload[],
    { syncSnapshot = true }: { syncSnapshot?: boolean } = {}
) {
    if (!Array.isArray(quotes) || quotes.length === 0) {
        return;
    }

    if (syncSnapshot) {
        await upsertLastCandleMarketBatch(quotes);
    }

    const rows = quotes.map(buildQuoteHistoryRow);
    const { error } = await supabaseAdmin.from("quote_history").insert(rows);

    if (error) {
        throw error;
    }
}
