import "server-only";

import { supabaseAdmin } from "@/app/utils/supabase/admin";

type MarketCandlePayload = {
    requestedSymbol: string;
    providerSymbol: string;
    interval: string;
    candleTime: string;
    exchange?: string;
    currency?: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number | null;
};

export async function saveMarketCandles(candles: MarketCandlePayload[]) {
    if (candles.length === 0) {
        return;
    }

    const mappedRows = candles.map((candle) => ({
        exchange_id: candle.exchange ?? "UNKNOWN",
        instrument_id: candle.requestedSymbol,
        timeframe: candle.interval,
        open_time: candle.candleTime,
        requested_symbol: candle.requestedSymbol,
        provider_symbol: candle.providerSymbol,
        exchange: candle.exchange ?? null,
        currency: candle.currency ?? null,
        open_price: candle.open,
        high_price: candle.high,
        low_price: candle.low,
        close_price: candle.close,
        volume: candle.volume ?? null,
    }));

    const { error } = await supabaseAdmin.from("candles").upsert(
        mappedRows,
        {
            onConflict: "exchange_id,instrument_id,timeframe,open_time",
            ignoreDuplicates: false,
        }
    );

    if (error) {
        throw error;
    }

    // Keep a lightweight recent mirror for operational diagnostics/backups.
    const { error: mirrorError } = await supabaseAdmin.from("market_candles").upsert(
        mappedRows.map((row) => ({
            requested_symbol: row.instrument_id,
            provider_symbol: row.provider_symbol,
            interval: row.timeframe,
            candle_time: row.open_time,
            exchange: row.exchange,
            currency: row.currency,
            open_price: row.open_price,
            high_price: row.high_price,
            low_price: row.low_price,
            close_price: row.close_price,
            volume: row.volume,
        })),
        {
            onConflict: "requested_symbol,interval,candle_time",
            ignoreDuplicates: false,
        }
    );

    if (mirrorError) {
        // Do not block chart persistence if the temp mirror fails.
        console.error("saveMarketCandles market_candles mirror error", mirrorError);
    }
}
