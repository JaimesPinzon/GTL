import { getProviderFreshnessMs } from "@/app/utils/market/timeframes";
import {
    aggregateCandlesByCount,
    buildCandlesFromStoredRows,
    buildCandlesFromTimeSeriesValues,
    mergeStoredCandlesWithLiveCandles,
    type MarketCandleRow,
} from "@/app/utils/market/ohlc";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getTwelveDataTimeSeries } from "@/app/utils/twelvedata/server";
import {
    buildRecentMinuteFetchWindow,
    fetchAndStoreYahooBaseCandles,
    sanitizeBaseCandles,
} from "@/app/utils/yahoo/base-candles";
import {
    YAHOO_CANDLES_TABLE_NAME,
    getLatestStoredYahooBaseCandle,
    type YahooCandleBaseInterval,
} from "@/app/utils/yahoo/candles-storage";

const previewTimeframeConfigs = {
    "1m": { baseInterval: "1m", aggregateSize: 1 },
    "2m": { baseInterval: "1m", aggregateSize: 2 },
    "3m": { baseInterval: "1m", aggregateSize: 3 },
    "4m": { baseInterval: "1m", aggregateSize: 4 },
    "5m": { baseInterval: "5m", aggregateSize: 1 },
    "10m": { baseInterval: "5m", aggregateSize: 2 },
    "15m": { baseInterval: "15m", aggregateSize: 1 },
    "30m": { baseInterval: "15m", aggregateSize: 2 },
    "45m": { baseInterval: "15m", aggregateSize: 3 },
    "1H": { baseInterval: "1h", aggregateSize: 1 },
    "2H": { baseInterval: "1h", aggregateSize: 2 },
    "3H": { baseInterval: "1h", aggregateSize: 3 },
    "4H": { baseInterval: "1h", aggregateSize: 4 },
    "1D": { baseInterval: "1d", aggregateSize: 1 },
    "3D": { baseInterval: "1d", aggregateSize: 3 },
    "5D": { baseInterval: "1d", aggregateSize: 5 },
    "1W": { baseInterval: "1wk", aggregateSize: 1 },
    "1M": { baseInterval: "1mo", aggregateSize: 1 },
    "3M": { baseInterval: "1mo", aggregateSize: 3 },
    "6M": { baseInterval: "1mo", aggregateSize: 6 },
    "1Y": { baseInterval: "1mo", aggregateSize: 12 },
    "3Y": { baseInterval: "1mo", aggregateSize: 36 },
    "5Y": { baseInterval: "1mo", aggregateSize: 60 },
} as const;

export type BaseCandlesPreviewTimeframe = keyof typeof previewTimeframeConfigs;

export function getBaseCandlesPreviewConfig(timeframe: string) {
    return previewTimeframeConfigs[
        timeframe.trim() as BaseCandlesPreviewTimeframe
    ] ?? null;
}

type ReadBaseCandlesInput = {
    symbol: string;
    timeframe: string;
    limit?: number;
    from?: string | null;
    to?: string | null;
};

type ReadStoredRowsInput = {
    symbol: string;
    baseInterval: YahooCandleBaseInterval;
    from?: string | null;
    to?: string | null;
    fetchLimit: number;
};

type StoredBaseRow = {
    instrument_id: string;
    provider_symbol: string;
    timeframe: string;
    open_time: string;
    exchange: string | null;
    currency: string | null;
    open_price: number | string;
    high_price: number | string;
    low_price: number | string;
    close_price: number | string;
    volume: number | string | null;
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

const pendingRefreshByKey = new Map<string, Promise<void>>();

function getTwelveDataIntervalForBase(baseInterval: YahooCandleBaseInterval) {
    switch (baseInterval) {
        case "1m":
            return "1min";
        case "5m":
            return "5min";
        case "15m":
            return "15min";
        case "1h":
            return "1h";
        default:
            return null;
    }
}

function shouldUseLiveTimeSeries(baseInterval: YahooCandleBaseInterval) {
    return getTwelveDataIntervalForBase(baseInterval) !== null;
}

async function refreshBaseCandlesIfNeeded(symbol: string, baseInterval: YahooCandleBaseInterval) {
    const latestStored = await getLatestStoredYahooBaseCandle(symbol, baseInterval);
    const freshnessMs = getProviderFreshnessMs(
        baseInterval === "1h" ? "60m" : baseInterval
    );
    const latestFetchedAt = latestStored?.fetched_at
        ? new Date(latestStored.fetched_at).getTime()
        : null;

    const isFresh =
        latestFetchedAt !== null && Date.now() - latestFetchedAt < freshnessMs;

    if (!isFresh) {
        const options =
            baseInterval === "1m"
                ? buildRecentMinuteFetchWindow()
                : {};
        await fetchAndStoreYahooBaseCandles(symbol, baseInterval, options);
    }
}

function refreshBaseCandlesIfNeededDeduped(symbol: string, baseInterval: YahooCandleBaseInterval) {
    const key = `${symbol}::${baseInterval}`;
    const pending = pendingRefreshByKey.get(key);
    if (pending) {
        return pending;
    }

    const request = refreshBaseCandlesIfNeeded(symbol, baseInterval).finally(() => {
        pendingRefreshByKey.delete(key);
    });

    pendingRefreshByKey.set(key, request);
    return request;
}

async function readStoredRows({
    symbol,
    baseInterval,
    from,
    to,
    fetchLimit,
}: ReadStoredRowsInput) {
    const symbolCandidates = buildSymbolCandidates(symbol);
    if (symbolCandidates.length === 0) {
        return [];
    }

    let query = supabaseAdmin
        .from(YAHOO_CANDLES_TABLE_NAME)
        .select(
            "instrument_id,provider_symbol,timeframe,open_time,exchange,currency,open_price,high_price,low_price,close_price,volume"
        )
        .eq("timeframe", baseInterval)
        .order("open_time", { ascending: false })
        .limit(fetchLimit * Math.max(1, symbolCandidates.length));

    query =
        symbolCandidates.length === 1
            ? query.eq("instrument_id", symbolCandidates[0])
            : query.in("instrument_id", symbolCandidates);

    if (from) {
        query = query.gte("open_time", from);
    }

    if (to) {
        query = query.lte("open_time", to);
    }

    const { data, error } = await query;
    if (error) {
        throw error;
    }

    const symbolRank = new Map(symbolCandidates.map((candidate, index) => [candidate, index]));
    const mergedRowsByTime = new Map<string, { rank: number; row: StoredBaseRow }>();

    (data ?? []).forEach((row) => {
        const rowRank = symbolRank.get(String(row.instrument_id).toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
        const existing = mergedRowsByTime.get(row.open_time);

        if (!existing || rowRank < existing.rank) {
            mergedRowsByTime.set(row.open_time, { rank: rowRank, row });
        }
    });

    const rows = Array.from(mergedRowsByTime.values())
        .map((entry) => entry.row)
        .sort(
            (left, right) =>
                new Date(right.open_time).getTime() - new Date(left.open_time).getTime()
        )
        .slice(0, fetchLimit)
        .map((row) => ({
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
    }));

    return rows as MarketCandleRow[];
}

export async function readBaseCandlesForTimeframe({
    symbol,
    timeframe,
    limit = 300,
    from,
    to,
}: ReadBaseCandlesInput) {
    const config = getBaseCandlesPreviewConfig(timeframe);
    if (!config) {
        throw new Error(`Unsupported base candles preview timeframe: ${timeframe}`);
    }

    const baseInterval = config.baseInterval as YahooCandleBaseInterval;
    const requestedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 5000)) : 300;
    const fetchLimit = Math.max(requestedLimit * config.aggregateSize, requestedLimit);
    const isMinuteBaseInterval = baseInterval === "1m";
    let usedTwelveData = false;
    let liveCandles: ReturnType<typeof buildCandlesFromTimeSeriesValues> = [];

    const liveSeriesPromise = shouldUseLiveTimeSeries(baseInterval)
        ? getTwelveDataTimeSeries(
              symbol,
              getTwelveDataIntervalForBase(baseInterval) ?? "1min",
              Math.min(1500, Math.max(120, requestedLimit * config.aggregateSize))
          )
        : Promise.resolve(null);

    try {
        const liveSeries = await liveSeriesPromise;
        if (liveSeries) {
            liveCandles = buildCandlesFromTimeSeriesValues(
                liveSeries.values ?? [],
                liveSeries.meta?.currency ?? "USD",
                liveSeries.meta?.exchange ?? null
            );
            usedTwelveData = liveCandles.length > 0;
        }
    } catch (liveSeriesError) {
        console.error("initial TwelveData time_series error", {
            symbol,
            baseInterval,
            error: liveSeriesError,
        });
    }

    // Serve stored candles first to keep chart responses fast. A storage failure
    // must not prevent the live TwelveData fallback from serving the chart.
    let rawRows: MarketCandleRow[] = [];

    try {
        rawRows = await readStoredRows({
            symbol,
            baseInterval,
            from,
            to,
            fetchLimit,
        });
    } catch (storageError) {
        console.error("readStoredRows error", {
            symbol,
            baseInterval,
            error: storageError,
        });
    }

    // Prefer the live series immediately when storage is unavailable. Yahoo is
    // still fetched below for persistence, but must not delay the first render.
    if (rawRows.length === 0 && liveCandles.length === 0) {
        try {
            const fetchOptions =
                isMinuteBaseInterval
                    ? buildRecentMinuteFetchWindow()
                    : {};
            await fetchAndStoreYahooBaseCandles(symbol, baseInterval, fetchOptions);

            try {
                rawRows = await readStoredRows({
                    symbol,
                    baseInterval,
                    from,
                    to,
                    fetchLimit,
                });
            } catch (storageError) {
                console.error("readStoredRows after Yahoo fetch error", {
                    symbol,
                    baseInterval,
                    error: storageError,
                });
            }
        } catch (yahooError) {
            console.error("initial fetchAndStoreYahooBaseCandles error", yahooError);
        }
    }

    // If we have very sparse history, proactively backfill once more so initial chart
    // requests can satisfy larger limits (e.g., 500 candles for 1m).
    if (rawRows.length > 0 && rawRows.length < fetchLimit) {
        try {
            const fetchOptions =
                isMinuteBaseInterval
                    ? buildRecentMinuteFetchWindow()
                    : {};
            await fetchAndStoreYahooBaseCandles(symbol, baseInterval, fetchOptions);

            try {
                rawRows = await readStoredRows({
                    symbol,
                    baseInterval,
                    from,
                    to,
                    fetchLimit,
                });
            } catch (storageError) {
                console.error("readStoredRows after Yahoo backfill error", {
                    symbol,
                    baseInterval,
                    error: storageError,
                });
            }
        } catch (yahooBackfillError) {
            console.error("sparse fetchAndStoreYahooBaseCandles backfill error", yahooBackfillError);
        }
    }

    // Keep candles refreshed in background for subsequent requests.
    void refreshBaseCandlesIfNeededDeduped(symbol, baseInterval).catch((error) => {
        console.error("background refreshBaseCandlesIfNeeded error", error);
    });

    let normalizedRows = sanitizeBaseCandles(
        baseInterval,
        buildCandlesFromStoredRows(rawRows)
    );
    // Merge TwelveData live candles for intraday freshness.
    if (liveCandles.length > 0) {
        try {
            normalizedRows = sanitizeBaseCandles(
                baseInterval,
                mergeStoredCandlesWithLiveCandles(normalizedRows, liveCandles)
            );
        } catch (liveSeriesError) {
            console.error("getTwelveDataTimeSeries (base-candles) error", liveSeriesError);
        }
    }

    const candles = aggregateCandlesByCount(
        normalizedRows,
        config.aggregateSize
    ).slice(-requestedLimit);

    return {
        symbol,
        timeframe,
        source: usedTwelveData
            ? rawRows.length > 0
                ? "yahoo_plus_twelvedata"
                : "twelvedata_live_fallback"
            : YAHOO_CANDLES_TABLE_NAME,
        baseInterval: config.baseInterval,
        aggregateSize: config.aggregateSize,
        rowsRead: rawRows.length,
        data: candles,
    };
}

