import { saveMarketCandles } from "@/app/utils/twelvedata/candles";
import { getTwelveDataTimeSeries } from "@/app/utils/twelvedata/server";
import { getYahooHistoricalChart } from "@/app/utils/yahoo/server";

export type QuoteHistoryRow = {
    requested_symbol: string;
    currency: string | null;
    close_price: number | string | null;
    fetched_at: string;
};

export type MarketCandleRow = {
    requested_symbol: string;
    provider_symbol: string;
    interval: string;
    candle_time: string;
    exchange: string | null;
    currency: string | null;
    open_price: number | string;
    high_price: number | string;
    low_price: number | string;
    close_price: number | string;
    volume: number | string | null;
    provider?: string | null;
    fetched_at?: string | null;
};

export type TwelveDataTimeSeriesValue = {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
};

export type OhlcCandle = {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    value: number;
    currency: string;
    exchange: string | null;
};

export function parseNumeric(value: number | string | null | undefined) {
    const numeric =
        typeof value === "number" ? value : Number.parseFloat(value ?? "");
    return Number.isFinite(numeric) ? numeric : null;
}

function normalizeProviderDateTimeToUtcIso(value: string | null | undefined) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    const normalizedInput = trimmedValue.replace(" ", "T");
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedInput);
    const parsedTimestamp = new Date(
        hasExplicitTimezone ? normalizedInput : `${normalizedInput}Z`
    ).getTime();

    if (!Number.isFinite(parsedTimestamp)) {
        return null;
    }

    return new Date(parsedTimestamp).toISOString();
}

function isAlignedProviderCandleTime(value: string) {
    const timestamp = new Date(value);
    if (!Number.isFinite(timestamp.getTime())) {
        return false;
    }

    return timestamp.getUTCSeconds() === 0 && timestamp.getUTCMilliseconds() === 0;
}

export function buildCandlesFromQuoteRows(rows: QuoteHistoryRow[]) {
    const sortedRows = [...rows].sort(
        (left, right) =>
            new Date(left.fetched_at).getTime() - new Date(right.fetched_at).getTime()
    );

    let previousClose: number | null = null;

    return sortedRows
        .map((row) => {
            const close = parseNumeric(row.close_price);

            if (close === null) {
                return null;
            }

            const open = previousClose ?? close;
            const high = Math.max(open, close);
            const low = Math.min(open, close);
            previousClose = close;

            return {
                time: new Date(row.fetched_at).toISOString(),
                open,
                high,
                low,
                close,
                value: close,
                currency: row.currency ?? "USD",
                exchange: null,
            };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function buildCandlesFromTimeSeriesValues(
    values: TwelveDataTimeSeriesValue[],
    currency = "USD",
    exchange: string | null = null
) {
    return [...values]
        .sort((left, right) => {
            const leftTime = normalizeProviderDateTimeToUtcIso(left.datetime);
            const rightTime = normalizeProviderDateTimeToUtcIso(right.datetime);

            return new Date(leftTime ?? 0).getTime() - new Date(rightTime ?? 0).getTime();
        })
        .map((value) => {
            const open = parseNumeric(value.open);
            const high = parseNumeric(value.high);
            const low = parseNumeric(value.low);
            const close = parseNumeric(value.close);
            const normalizedTime = normalizeProviderDateTimeToUtcIso(value.datetime);

            if (
                ![open, high, low, close].every((entry) => entry !== null) ||
                !normalizedTime ||
                !isAlignedProviderCandleTime(normalizedTime)
            ) {
                return null;
            }

            return {
                time: normalizedTime,
                open: open as number,
                high: high as number,
                low: low as number,
                close: close as number,
                value: close as number,
                currency,
                exchange,
            };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function mergeStoredCandlesWithLiveCandles(
    storedCandles: OhlcCandle[],
    liveCandles: OhlcCandle[]
) {
    if (storedCandles.length === 0) {
        return liveCandles;
    }

    const mergedCandles = [...storedCandles];
    const lastStoredCandle = mergedCandles[mergedCandles.length - 1];

    if (!lastStoredCandle) {
        return liveCandles;
    }

    const lastStoredTime = new Date(lastStoredCandle.time).getTime();
    const liveTail = liveCandles.filter(
        (candle) => new Date(candle.time).getTime() >= lastStoredTime
    );

    liveTail.forEach((liveCandle) => {
        const lastMergedIndex = mergedCandles.length - 1;
        const lastMergedCandle = mergedCandles[lastMergedIndex];

        if (!lastMergedCandle) {
            mergedCandles.push(liveCandle);
            return;
        }

        const liveTime = new Date(liveCandle.time).getTime();
        const lastTime = new Date(lastMergedCandle.time).getTime();

        if (liveTime > lastTime) {
            mergedCandles.push(liveCandle);
            return;
        }

        if (liveTime === lastTime) {
            mergedCandles[lastMergedIndex] = {
                ...lastMergedCandle,
                high: Math.max(lastMergedCandle.high, liveCandle.high),
                low: Math.min(lastMergedCandle.low, liveCandle.low),
                close: liveCandle.close,
                value: liveCandle.close,
                currency: liveCandle.currency ?? lastMergedCandle.currency,
                exchange: liveCandle.exchange ?? lastMergedCandle.exchange,
            };
        }
    });

    return mergedCandles;
}

export function mergeStoredCandlesWithQuoteRows(
    storedCandles: OhlcCandle[],
    quoteRows: QuoteHistoryRow[]
) {
    return mergeStoredCandlesWithLiveCandles(storedCandles, buildCandlesFromQuoteRows(quoteRows));
}

export function buildCandlesFromStoredRows(rows: MarketCandleRow[]) {
    const providerPriority = (provider: string | null | undefined) =>
        provider === "twelvedata" ? 2 : provider === "yahoo_finance" ? 1 : 0;
    const candlesByTime = new Map<string, OhlcCandle & { providerPriority: number; fetchedAt: number }>();

    rows.forEach((row) => {
            const open = parseNumeric(row.open_price);
            const high = parseNumeric(row.high_price);
            const low = parseNumeric(row.low_price);
            const close = parseNumeric(row.close_price);
            const normalizedTime = normalizeProviderDateTimeToUtcIso(row.candle_time);

            if (
                ![open, high, low, close].every((value) => value !== null) ||
                !normalizedTime ||
                !isAlignedProviderCandleTime(normalizedTime)
            ) {
                return;
            }

            const candidate = {
                time: normalizedTime,
                open: open as number,
                high: high as number,
                low: low as number,
                close: close as number,
                value: close as number,
                currency: row.currency ?? "USD",
                exchange: row.exchange ?? null,
                providerPriority: providerPriority(row.provider),
                fetchedAt: row.fetched_at ? new Date(row.fetched_at).getTime() : 0,
            };

            const existing = candlesByTime.get(normalizedTime);
            if (
                !existing ||
                candidate.providerPriority > existing.providerPriority ||
                (
                    candidate.providerPriority === existing.providerPriority &&
                    candidate.fetchedAt >= existing.fetchedAt
                )
            ) {
                candlesByTime.set(normalizedTime, candidate);
            }
        });

    return Array.from(candlesByTime.values())
        .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
        .map(({ providerPriority: ignoredPriority, fetchedAt: ignoredFetchedAt, ...candle }) => {
            void ignoredPriority;
            void ignoredFetchedAt;
            return candle;
        });
}

const TWELVE_DATA_INTERVAL_BY_CANDLE_INTERVAL: Record<string, string> = {
    "1m": "1min",
    "2m": "2min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "60m": "1h",
    "1h": "1h",
    "1d": "1day",
    "1wk": "1week",
    "1mo": "1month",
};

export function getTwelveDataIntervalForCandleInterval(interval: string) {
    return TWELVE_DATA_INTERVAL_BY_CANDLE_INTERVAL[interval] ?? null;
}

export async function fetchAndStoreTwelveDataCandles(
    symbol: string,
    candleInterval: string,
    outputsize = 200,
    { throwOnPersistenceError = true }: { throwOnPersistenceError?: boolean } = {}
) {
    const providerInterval = getTwelveDataIntervalForCandleInterval(candleInterval);
    if (!providerInterval) {
        return [];
    }

    const series = await getTwelveDataTimeSeries(symbol, providerInterval, outputsize);
    const candles = buildCandlesFromTimeSeriesValues(
        series.values ?? [],
        series.meta?.currency ?? "USD",
        series.meta?.exchange ?? null
    );

    try {
        await saveMarketCandles(candles.map((candle, index) => ({
            requestedSymbol: symbol,
            providerSymbol: series.meta?.symbol ?? symbol,
            interval: candleInterval,
            candleTime: candle.time,
            exchange: candle.exchange ?? series.meta?.exchange ?? "TWELVEDATA",
            currency: candle.currency,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: null,
            provider: "twelvedata",
            sourceRange: `time_series:${providerInterval}`,
            isFinal: index < candles.length - 1,
        })));
    } catch (error) {
        if (throwOnPersistenceError) {
            throw error;
        }

        console.error("Twelve Data OHLC persistence error", {
            symbol,
            candleInterval,
            error: error instanceof Error ? error.message : error,
        });
    }

    return candles;
}

export function aggregateCandlesByCount(candles: OhlcCandle[], aggregateSize: number) {
    if (aggregateSize <= 1 || candles.length === 0) {
        return candles;
    }

    const aggregated: OhlcCandle[] = [];

    for (let index = 0; index < candles.length; index += aggregateSize) {
        const bucket = candles.slice(index, index + aggregateSize);
        if (bucket.length === 0) {
            continue;
        }

        aggregated.push({
            ...bucket[0],
            time: bucket[0].time,
            open: bucket[0].open,
            high: Math.max(...bucket.map((candle) => candle.high)),
            low: Math.min(...bucket.map((candle) => candle.low)),
            close: bucket[bucket.length - 1].close,
            value: bucket[bucket.length - 1].close,
            currency: bucket[0].currency,
            exchange: bucket[0].exchange ?? null,
        });
    }

    return aggregated;
}

export async function fetchAndStoreYahooCandles(
    symbol: string,
    providerInterval: string,
    range: string
) {
    const yahooChart = await getYahooHistoricalChart(symbol, providerInterval, range);
    const candles = yahooChart.candles;

    if (candles.length === 0) {
        return [];
    }

    try {
        await saveMarketCandles(
            candles.map((candle) => ({
                requestedSymbol: symbol,
                providerSymbol: candle.providerSymbol ?? symbol,
                interval: providerInterval,
                candleTime: candle.time,
                exchange: candle.exchange ?? yahooChart.meta.exchangeName,
                currency: candle.currency,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: parseNumeric(candle.volume),
                provider: "yahoo_finance",
                sourceRange: range,
                isFinal: true,
            }))
        );
    } catch (error) {
        // Keep serving live data even if persistence fails.
        console.error("fetchAndStoreYahooCandles persistence error", {
            symbol,
            providerInterval,
            error: error instanceof Error ? error.message : error,
        });
    }

    return candles;
}
