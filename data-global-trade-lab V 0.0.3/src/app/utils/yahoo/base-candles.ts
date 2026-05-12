import { parseNumeric } from "@/app/utils/market/ohlc";
import { getYahooHistoricalChart, getYahooHistoricalChartByPeriod } from "@/app/utils/yahoo/server";
import { getYahooBaseConfig } from "@/app/utils/market/timeframes";
import { saveYahooCandlesToBaseTable, type YahooCandleBaseInterval } from "@/app/utils/yahoo/candles-storage";

type RawYahooCandle = {
    time: string;
    providerSymbol?: string | null;
    exchange?: string | null;
    currency?: string | null;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number | string | null;
};

export type YahooBaseFetchOptions = {
    period1?: number;
    period2?: number;
    chunkDays?: number;
};

const COHERENT_TAIL_MAX_GAP_MS: Record<string, number> = {
    "1m": 10 * 24 * 60 * 60 * 1000,
    "5m": 10 * 24 * 60 * 60 * 1000,
    "15m": 10 * 24 * 60 * 60 * 1000,
    "1h": 10 * 24 * 60 * 60 * 1000,
};
const MINUTE_CHUNK_DAYS = 8;
const DAY_SECONDS = 24 * 60 * 60;

function isAlignedToBaseInterval(time: string, baseTimeframe: YahooCandleBaseInterval) {
    const date = new Date(time);
    if (!Number.isFinite(date.getTime())) {
        return false;
    }

    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();
    const minutes = date.getUTCMinutes();

    if (seconds !== 0 || milliseconds !== 0) {
        return false;
    }

    switch (baseTimeframe) {
        case "1m":
            return true;
        case "5m":
            return minutes % 5 === 0;
        case "15m":
            return minutes % 15 === 0;
        case "1h":
            return minutes === 0;
        default:
            return true;
    }
}

function keepCoherentTail<T extends { time: string }>(
    candles: T[],
    maxGapMs: number
) {
    if (candles.length <= 1) {
        return candles;
    }

    const tail: T[] = [candles[candles.length - 1]];

    for (let index = candles.length - 2; index >= 0; index -= 1) {
        const current = candles[index];
        const next = tail[tail.length - 1];
        const gapMs = new Date(next.time).getTime() - new Date(current.time).getTime();

        if (!Number.isFinite(gapMs) || gapMs <= 0 || gapMs > maxGapMs) {
            break;
        }

        tail.push(current);
    }

    return tail.reverse();
}

export function sanitizeBaseCandles<T extends { time: string }>(
    baseTimeframe: YahooCandleBaseInterval,
    candles: T[]
) {
    const sortedCandles = [...candles].sort(
        (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
    );
    const dedupedCandles: T[] = [];

    sortedCandles.forEach((candle) => {
        const candleTime = new Date(candle.time).getTime();
        if (!Number.isFinite(candleTime)) {
            return;
        }

        const lastCandle = dedupedCandles[dedupedCandles.length - 1];
        const lastTime = lastCandle ? new Date(lastCandle.time).getTime() : Number.NaN;

        if (Number.isFinite(lastTime) && lastTime === candleTime) {
            // Keep the latest row when duplicate buckets exist for the same timestamp.
            dedupedCandles[dedupedCandles.length - 1] = candle;
            return;
        }

        dedupedCandles.push(candle);
    });

    if (!baseTimeframe.endsWith("m") && baseTimeframe !== "1h") {
        return dedupedCandles;
    }

    const alignedCandles = dedupedCandles.filter((candle) =>
        isAlignedToBaseInterval(candle.time, baseTimeframe)
    );

    if (alignedCandles.length === 0) {
        return [];
    }

    return keepCoherentTail(
        alignedCandles,
        COHERENT_TAIL_MAX_GAP_MS[baseTimeframe] ?? 10 * 24 * 60 * 60 * 1000
    );
}

function buildYearlyCandles(candles: RawYahooCandle[]) {
    const buckets = new Map<number, RawYahooCandle[]>();

    [...candles]
        .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
        .forEach((candle) => {
            const year = new Date(candle.time).getUTCFullYear();
            const bucket = buckets.get(year) ?? [];
            bucket.push(candle);
            buckets.set(year, bucket);
        });

    return Array.from(buckets.entries()).map(([year, bucket]) => ({
        ...bucket[0],
        time: new Date(Date.UTC(year, 0, 1)).toISOString(),
        open: bucket[0].open,
        high: Math.max(...bucket.map((entry) => entry.high)),
        low: Math.min(...bucket.map((entry) => entry.low)),
        close: bucket[bucket.length - 1].close,
        volume: bucket.reduce((sum, entry) => sum + (parseNumeric(entry.volume) ?? 0), 0),
    }));
}

function normalizeFetchedCandles(
    candles: RawYahooCandle[],
    baseTimeframe: YahooCandleBaseInterval
) {
    return baseTimeframe === "1y"
        ? buildYearlyCandles(candles)
        : sanitizeBaseCandles(baseTimeframe, candles);
}

async function fetchYahooChunkedMinuteCandles(
    symbol: string,
    interval: string,
    period1: number,
    period2: number,
    chunkDays = MINUTE_CHUNK_DAYS
) {
    const chunkSeconds = Math.max(1, chunkDays) * DAY_SECONDS;
    const mergedByTime = new Map<string, RawYahooCandle>();
    let cursor = period1;
    let lastMeta: { exchangeName?: string; currency?: string } = {};

    while (cursor < period2) {
        const chunkEnd = Math.min(cursor + chunkSeconds - 1, period2);
        const yahooChart = await getYahooHistoricalChartByPeriod(
            symbol,
            interval,
            cursor,
            chunkEnd
        );

        lastMeta = yahooChart.meta ?? lastMeta;
        yahooChart.candles.forEach((candle) => {
            mergedByTime.set(candle.time, {
                ...candle,
                volume: parseNumeric(candle.volume),
                exchange: candle.exchange ?? yahooChart.meta.exchangeName ?? null,
                currency: candle.currency ?? yahooChart.meta.currency ?? null,
            });
        });

        cursor = chunkEnd + 1;
    }

    return {
        meta: lastMeta,
        candles: [...mergedByTime.values()].sort(
            (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
        ),
    };
}

export async function fetchAndStoreYahooBaseCandles(
    symbol: string,
    baseTimeframe: YahooCandleBaseInterval,
    options: YahooBaseFetchOptions = {}
) {
    const config = getYahooBaseConfig(baseTimeframe);

    if (!config) {
        throw new Error(`Unsupported Yahoo base timeframe: ${baseTimeframe}`);
    }

    const { period1, period2, chunkDays } = options;

    const yahooData =
        baseTimeframe === "1m" && period1 != null && period2 != null
            ? await fetchYahooChunkedMinuteCandles(
                  symbol,
                  config.providerInterval,
                  period1,
                  period2,
                  chunkDays ?? MINUTE_CHUNK_DAYS
              )
            : period1 != null && period2 != null
              ? await getYahooHistoricalChartByPeriod(
                    symbol,
                    config.providerInterval,
                    period1,
                    period2
                )
              : await getYahooHistoricalChart(symbol, config.providerInterval, config.range);

    const fetchedCandles = yahooData.candles.map((candle) => ({
        ...candle,
        volume: parseNumeric(candle.volume),
        exchange: candle.exchange ?? yahooData.meta.exchangeName ?? null,
        currency: candle.currency ?? yahooData.meta.currency ?? null,
    }));

    const candles = normalizeFetchedCandles(fetchedCandles, baseTimeframe);

    if (candles.length === 0) {
        return {
            candles: [],
            insertedOrUpdated: 0,
            rejected: 0,
            rejectedReasons: {},
        };
    }

    const persistence = await saveYahooCandlesToBaseTable(
        candles.map((candle) => ({
            requestedSymbol: symbol,
            providerSymbol: candle.providerSymbol ?? symbol,
            interval: baseTimeframe,
            candleTime: candle.time,
            exchange: candle.exchange ?? null,
            currency: candle.currency ?? null,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: parseNumeric(candle.volume),
            sourceRange:
                period1 != null && period2 != null
                    ? `period:${period1}-${period2}`
                    : config.range,
            provider: "yahoo_finance",
            isFinal: true,
        }))
    );

    return {
        candles,
        ...persistence,
    };
}

export function buildRecentMinuteFetchWindow(referenceDate = new Date()) {
    const period2 = Math.floor(referenceDate.getTime() / 1000);
    const period1 = period2 - MINUTE_CHUNK_DAYS * DAY_SECONDS;

    return {
        period1,
        period2,
        chunkDays: MINUTE_CHUNK_DAYS,
    };
}
