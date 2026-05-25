import "server-only";

import { supabaseAdmin } from "@/app/utils/supabase/admin";

const DEFAULT_SOURCE = "twelvedata";
const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export type MarketQuoteSnapshotInput = {
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
    is_market_open?: boolean | string | number | null;
    percent_change?: string;
    timestamp?: string;
};

export type LastCandleMarketSnapshot = {
    symbol: string;
    source: string;
    providerSymbol: string;
    assetName: string | null;
    exchange: string | null;
    currency: string | null;
    price: number;
    openPrice: number | null;
    highPrice: number | null;
    lowPrice: number | null;
    closePrice: number | null;
    volume: number | null;
    percentChange: number | null;
    isMarketOpen: boolean | null;
    candleTime: string;
    fetchedAt: string;
    marketStatus: string;
    status: string;
    errorMessage: string | null;
    isStale: boolean;
};

type LastCandleMarketRow = {
    symbol: string;
    source: string;
    provider_symbol: string;
    asset_name: string | null;
    exchange: string | null;
    currency: string | null;
    price: number;
    open_price: number | null;
    high_price: number | null;
    low_price: number | null;
    close_price: number | null;
    volume: number | null;
    percent_change: number | null;
    is_market_open: boolean | null;
    candle_time: string;
    fetched_at: string;
    market_status: string;
    status: string;
    error_message: string | null;
};

const normalizeSymbol = (value: unknown) => String(value || "").trim().toUpperCase();

const toNumeric = (value: unknown) => {
    const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
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

const resolveMarketStatus = (isMarketOpen: boolean | null) => {
    if (isMarketOpen === true) {
        return "open";
    }

    if (isMarketOpen === false) {
        return "closed";
    }

    return "unknown";
};

const toIsoTimestamp = (value: unknown, fallbackIso: string) => {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return fallbackIso;
    }

    const directDate = new Date(raw);
    if (Number.isFinite(directDate.getTime())) {
        return directDate.toISOString();
    }

    const normalized = raw.includes("T")
        ? raw
        : `${raw.replace(" ", "T")}Z`;
    const normalizedDate = new Date(normalized);

    if (!Number.isFinite(normalizedDate.getTime())) {
        return fallbackIso;
    }

    return normalizedDate.toISOString();
};

const getStaleThresholdMs = () => {
    const rawValue = Number.parseInt(
        String(process.env.MARKET_LAST_CANDLE_STALE_MS ?? ""),
        10
    );

    if (Number.isFinite(rawValue) && rawValue > 0) {
        return rawValue;
    }

    return DEFAULT_STALE_THRESHOLD_MS;
};

const buildSnapshotRow = (
    quote: MarketQuoteSnapshotInput,
    fetchedAtIso: string
): LastCandleMarketRow | null => {
    const symbol = normalizeSymbol(quote.requestedSymbol);
    if (!symbol) {
        return null;
    }

    const normalizedClose = quote.close ?? quote.price;
    const price = toNumeric(normalizedClose);
    if (!price || price <= 0) {
        return null;
    }

    const providerSymbol = normalizeSymbol(quote.symbol) || symbol;
    const openPrice = toNumeric(quote.open);
    const highPrice = toNumeric(quote.high);
    const lowPrice = toNumeric(quote.low);
    const closePrice = toNumeric(normalizedClose);
    const volume = toNumeric(quote.volume);
    const percentChange = toNumeric(quote.percent_change);
    const candleTimeIso = toIsoTimestamp(quote.timestamp, fetchedAtIso);
    const isMarketOpen = toNullableBoolean(quote.is_market_open);

    return {
        symbol,
        source: DEFAULT_SOURCE,
        provider_symbol: providerSymbol,
        asset_name: quote.name?.trim() || null,
        exchange: quote.exchange?.trim() || null,
        currency: quote.currency?.trim() || null,
        price,
        open_price: openPrice,
        high_price: highPrice,
        low_price: lowPrice,
        close_price: closePrice ?? price,
        volume,
        percent_change: percentChange,
        is_market_open: isMarketOpen,
        candle_time: candleTimeIso,
        fetched_at: fetchedAtIso,
        market_status: resolveMarketStatus(isMarketOpen),
        status: "ok",
        error_message: null,
    };
};

const mapRowToSnapshot = (
    row: LastCandleMarketRow
): LastCandleMarketSnapshot => {
    const fetchedAtMs = Date.parse(row.fetched_at);
    const isStale =
        !Number.isFinite(fetchedAtMs) ||
        Date.now() - fetchedAtMs > getStaleThresholdMs();

    return {
        symbol: row.symbol,
        source: row.source,
        providerSymbol: row.provider_symbol,
        assetName: row.asset_name,
        exchange: row.exchange,
        currency: row.currency,
        price: row.price,
        openPrice: row.open_price,
        highPrice: row.high_price,
        lowPrice: row.low_price,
        closePrice: row.close_price,
        volume: row.volume,
        percentChange: row.percent_change,
        isMarketOpen: row.is_market_open,
        candleTime: row.candle_time,
        fetchedAt: row.fetched_at,
        marketStatus: row.market_status || resolveMarketStatus(row.is_market_open),
        status: row.status,
        errorMessage: row.error_message,
        isStale,
    };
};

const parseTimestampValue = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export async function upsertLastCandleMarketBatch(
    quotes: MarketQuoteSnapshotInput[]
) {
    if (!Array.isArray(quotes) || quotes.length === 0) {
        return;
    }

    const fetchedAtIso = new Date().toISOString();
    const candidateRows = quotes
        .map((quote) => buildSnapshotRow(quote, fetchedAtIso))
        .filter((row): row is LastCandleMarketRow => Boolean(row));

    if (candidateRows.length === 0) {
        return;
    }

    const symbols = [...new Set(candidateRows.map((row) => row.symbol))];

    const { data: existingRows, error: existingError } = await supabaseAdmin
        .from("last_candle_market")
        .select("symbol, source, candle_time, fetched_at")
        .eq("source", DEFAULT_SOURCE)
        .in("symbol", symbols);

    if (existingError) {
        throw existingError;
    }

    const existingByKey = new Map<string, { candle_time: string; fetched_at: string }>();
    (existingRows || []).forEach((row) => {
        const symbol = normalizeSymbol((row as { symbol?: string }).symbol);
        const source = String((row as { source?: string }).source || DEFAULT_SOURCE);
        existingByKey.set(`${symbol}::${source}`, {
            candle_time: String((row as { candle_time?: string }).candle_time || ""),
            fetched_at: String((row as { fetched_at?: string }).fetched_at || ""),
        });
    });

    const rowsToUpsert = candidateRows.filter((row) => {
        const key = `${row.symbol}::${row.source}`;
        const existing = existingByKey.get(key);

        if (!existing) {
            return true;
        }

        const nextCandleTime = parseTimestampValue(row.candle_time);
        const currentCandleTime = parseTimestampValue(existing.candle_time);
        if (nextCandleTime > currentCandleTime) {
            return true;
        }

        if (nextCandleTime < currentCandleTime) {
            return false;
        }

        const nextFetchedAt = parseTimestampValue(row.fetched_at);
        const currentFetchedAt = parseTimestampValue(existing.fetched_at);
        return nextFetchedAt >= currentFetchedAt;
    });

    if (rowsToUpsert.length === 0) {
        return;
    }

    const { error: batchError } = await supabaseAdmin
        .from("last_candle_market")
        .upsert(rowsToUpsert, { onConflict: "symbol,source" });

    if (!batchError) {
        return;
    }

    const rowErrors: string[] = [];
    for (const row of rowsToUpsert) {
        const { error: rowError } = await supabaseAdmin
            .from("last_candle_market")
            .upsert(row, { onConflict: "symbol,source" });

        if (rowError) {
            rowErrors.push(`${row.symbol}: ${rowError.message}`);
        }
    }

    if (rowErrors.length > 0) {
        throw new Error(
            `last_candle_market upsert failed. Batch error: ${batchError.message}. Row errors: ${rowErrors.join(" | ")}`
        );
    }
}

export async function getLastCandleMarketBySymbols(symbols: string[]) {
    const normalizedSymbols = [...new Set(
        symbols
            .map((symbol) => normalizeSymbol(symbol))
            .filter(Boolean)
    )];

    if (normalizedSymbols.length === 0) {
        return new Map<string, LastCandleMarketSnapshot>();
    }

    const { data, error } = await supabaseAdmin
        .from("last_candle_market")
        .select(
            "symbol, source, provider_symbol, asset_name, exchange, currency, price, open_price, high_price, low_price, close_price, volume, percent_change, is_market_open, candle_time, fetched_at, market_status, status, error_message"
        )
        .eq("source", DEFAULT_SOURCE)
        .in("symbol", normalizedSymbols);

    if (error) {
        throw error;
    }

    const snapshots = new Map<string, LastCandleMarketSnapshot>();
    (data || []).forEach((row) => {
        const typedRow = row as LastCandleMarketRow;
        snapshots.set(normalizeSymbol(typedRow.symbol), mapRowToSnapshot(typedRow));
    });

    return snapshots;
}

export async function listLastCandleMarketSnapshots({
    limit = 300,
    source = DEFAULT_SOURCE,
    symbols,
}: {
    limit?: number;
    source?: string;
    symbols?: string[];
} = {}) {
    const normalizedLimit = Number.isFinite(limit)
        ? Math.min(Math.max(Math.trunc(limit), 1), 1000)
        : 300;
    const normalizedSource = String(source || DEFAULT_SOURCE).trim() || DEFAULT_SOURCE;
    const normalizedSymbols = Array.isArray(symbols)
        ? [...new Set(
            symbols
                .map((symbol) => normalizeSymbol(symbol))
                .filter(Boolean)
        )]
        : [];

    let query = supabaseAdmin
        .from("last_candle_market")
        .select(
            "symbol, source, provider_symbol, asset_name, exchange, currency, price, open_price, high_price, low_price, close_price, volume, percent_change, is_market_open, candle_time, fetched_at, market_status, status, error_message"
        )
        .eq("source", normalizedSource)
        .order("fetched_at", { ascending: false })
        .limit(normalizedLimit);

    if (normalizedSymbols.length > 0) {
        query = query.in("symbol", normalizedSymbols);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return (data || []).map((row) => mapRowToSnapshot(row as LastCandleMarketRow));
}
