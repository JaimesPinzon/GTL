import "server-only";

import { supabaseAdmin } from "@/app/utils/supabase/admin";

export const YAHOO_CANDLES_TABLE_NAME = "candles" as const;

export const YAHOO_CANDLE_TABLE_BY_INTERVAL = {
    "1m": YAHOO_CANDLES_TABLE_NAME,
    "5m": YAHOO_CANDLES_TABLE_NAME,
    "15m": YAHOO_CANDLES_TABLE_NAME,
    "1h": YAHOO_CANDLES_TABLE_NAME,
    "1d": YAHOO_CANDLES_TABLE_NAME,
    "1wk": YAHOO_CANDLES_TABLE_NAME,
    "1mo": YAHOO_CANDLES_TABLE_NAME,
    "1y": YAHOO_CANDLES_TABLE_NAME,
} as const;

export type YahooCandleBaseInterval = keyof typeof YAHOO_CANDLE_TABLE_BY_INTERVAL;
export type YahooCandleTableName =
    (typeof YAHOO_CANDLE_TABLE_BY_INTERVAL)[YahooCandleBaseInterval];

export type YahooCandlePayload = {
    requestedSymbol: string;
    providerSymbol: string;
    interval: YahooCandleBaseInterval;
    candleTime: string;
    exchange?: string | null;
    currency?: string | null;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number | null;
    sourceRange: string;
    provider?: string;
    isFinal?: boolean;
};

function buildSymbolCandidates(rawSymbol: string) {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) {
        return [];
    }

    const candidates = new Set<string>([symbol]);
    const compact = symbol.replace(/\//g, "");

    if (compact) {
        candidates.add(compact);
    }

    if (/^[A-Z0-9]{6,}$/.test(compact) && compact.endsWith("USD")) {
        const base = compact.slice(0, -3);
        if (base) {
            candidates.add(`${base}/USD`);
        }
    }

    return [...candidates];
}

function normalizeBucketTime(candleTime: string) {
    const timestamp = new Date(candleTime).getTime();
    if (!Number.isFinite(timestamp)) {
        return null;
    }

    return new Date(timestamp).toISOString();
}

function isValidCandle(payload: YahooCandlePayload) {
    const { open, high, low, close, volume } = payload;

    if (![open, high, low, close].every(Number.isFinite)) {
        return { ok: false, reason: "non_finite_price" };
    }

    if ([open, high, low, close].some((value) => value < 0)) {
        return { ok: false, reason: "negative_price" };
    }

    if (high < open || high < close || high < low) {
        return { ok: false, reason: "high_out_of_bounds" };
    }

    if (low > open || low > close || low > high) {
        return { ok: false, reason: "low_out_of_bounds" };
    }

    if (volume != null && (!Number.isFinite(volume) || volume < 0)) {
        return { ok: false, reason: "negative_or_invalid_volume" };
    }

    const normalizedTime = normalizeBucketTime(payload.candleTime);
    if (!normalizedTime) {
        return { ok: false, reason: "invalid_bucket_time" };
    }

    return { ok: true, normalizedTime };
}

export function getYahooCandleTableName(interval: string) {
    return YAHOO_CANDLE_TABLE_BY_INTERVAL[
        interval as YahooCandleBaseInterval
    ] ?? null;
}

export async function getLatestStoredYahooBaseCandle(
    symbol: string,
    interval: YahooCandleBaseInterval
) {
    const symbolCandidates = buildSymbolCandidates(symbol);
    if (symbolCandidates.length === 0) {
        return null;
    }

    let query = supabaseAdmin
        .from(YAHOO_CANDLES_TABLE_NAME)
        .select("open_time,fetched_at,is_final")
        .eq("timeframe", interval)
        .order("open_time", { ascending: false })
        .limit(1);

    query =
        symbolCandidates.length === 1
            ? query.eq("instrument_id", symbolCandidates[0])
            : query.in("instrument_id", symbolCandidates);

    const { data, error } = await query.maybeSingle<{ open_time: string; fetched_at: string | null; is_final: boolean | null }>();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    return {
        candle_time: data.open_time,
        fetched_at: data.fetched_at,
        is_final: data.is_final,
    };
}

export async function deleteYahooBaseCandlesForSymbol(
    symbol: string,
    interval: YahooCandleBaseInterval
) {
    const symbolCandidates = buildSymbolCandidates(symbol);
    if (symbolCandidates.length === 0) {
        return;
    }

    let query = supabaseAdmin
        .from(YAHOO_CANDLES_TABLE_NAME)
        .delete()
        .eq("timeframe", interval);

    query =
        symbolCandidates.length === 1
            ? query.eq("instrument_id", symbolCandidates[0])
            : query.in("instrument_id", symbolCandidates);

    const { error } = await query;

    if (error) {
        throw error;
    }
}

export async function saveYahooCandlesToBaseTable(candles: YahooCandlePayload[]) {
    if (candles.length === 0) {
        return { insertedOrUpdated: 0, rejected: 0, rejectedReasons: {} as Record<string, number> };
    }

    const rejectedReasons: Record<string, number> = {};
    const fetchedAt = new Date().toISOString();
    const validRows = candles
        .map((candle) => {
            const validation = isValidCandle(candle);
            if (!validation.ok) {
                const reason = validation.reason ?? "invalid_candle";
                rejectedReasons[reason] = (rejectedReasons[reason] ?? 0) + 1;
                return null;
            }

            return {
                exchange_id: candle.exchange ?? "UNKNOWN",
                instrument_id: candle.requestedSymbol,
                timeframe: candle.interval,
                open_time: validation.normalizedTime,
                requested_symbol: candle.requestedSymbol,
                provider_symbol: candle.providerSymbol,
                exchange: candle.exchange ?? null,
                currency: candle.currency ?? null,
                open_price: candle.open,
                high_price: candle.high,
                low_price: candle.low,
                close_price: candle.close,
                volume: candle.volume ?? null,
                provider: candle.provider ?? "yahoo_finance",
                source_range: candle.sourceRange,
                is_final: candle.isFinal ?? true,
                fetched_at: fetchedAt,
            };
        })
        .filter(Boolean);

    if (validRows.length === 0) {
        return {
            insertedOrUpdated: 0,
            rejected: candles.length,
            rejectedReasons,
        };
    }

    const { error } = await supabaseAdmin.from(YAHOO_CANDLES_TABLE_NAME).upsert(validRows, {
        onConflict: "exchange_id,instrument_id,timeframe,open_time",
        ignoreDuplicates: false,
    });

    if (error) {
        throw error;
    }

    return {
        insertedOrUpdated: validRows.length,
        rejected: candles.length - validRows.length,
        rejectedReasons,
    };
}
