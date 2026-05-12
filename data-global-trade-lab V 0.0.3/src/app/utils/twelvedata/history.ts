import "server-only";

import { supabaseAdmin } from "@/app/utils/supabase/admin";

type QuoteHistoryPayload = {
    requestedSymbol: string;
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
    close?: string;
    is_market_open?: boolean;
    percent_change?: string;
    timestamp?: string;
};

const buildQuoteHistoryRow = (quote: QuoteHistoryPayload) => {
    const close = Number.parseFloat(quote.close ?? "");
    const percentChange = Number.parseFloat(quote.percent_change ?? "");

    return {
        requested_symbol: quote.requestedSymbol,
        provider_symbol: quote.symbol ?? quote.requestedSymbol,
        asset_name: quote.name ?? null,
        exchange: quote.exchange ?? null,
        currency: quote.currency ?? null,
        close_price: Number.isFinite(close) ? close : null,
        is_market_open: quote.is_market_open ?? null,
        percent_change: Number.isFinite(percentChange) ? percentChange : null,
        provider_timestamp: quote.timestamp ?? null,
        raw_payload: quote,
    };
};

export async function saveQuoteHistory(quote: QuoteHistoryPayload) {
    const { error } = await supabaseAdmin.from("quote_history").insert(
        buildQuoteHistoryRow(quote)
    );

    if (error) {
        throw error;
    }
}

export async function saveQuoteHistoryBatch(quotes: QuoteHistoryPayload[]) {
    if (!Array.isArray(quotes) || quotes.length === 0) {
        return;
    }

    const rows = quotes.map(buildQuoteHistoryRow);
    const { error } = await supabaseAdmin.from("quote_history").insert(rows);

    if (error) {
        throw error;
    }
}
