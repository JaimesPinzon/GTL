import "server-only";

import { serverEnv } from "@/app/utils/env";

const TWELVEDATA_BASE_URL = "https://api.twelvedata.com";

type TwelveDataQuoteResponse = {
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
    price?: string;
    close?: string;
    is_market_open?: boolean;
    percent_change?: string;
    timestamp?: string;
    code?: number;
    message?: string;
    status?: string;
};

type TwelveDataBatchQuoteResponse = Record<string, TwelveDataQuoteResponse>;

type TwelveDataTimeSeriesValue = {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
};

type TwelveDataTimeSeriesResponse = {
    meta?: {
        symbol?: string;
        interval?: string;
        exchange?: string;
        currency?: string;
        type?: string;
        timezone?: string;
    };
    values?: TwelveDataTimeSeriesValue[];
    code?: number;
    message?: string;
    status?: string;
};

type TimeSeriesCacheEntry = {
    data: TwelveDataTimeSeriesResponse;
    fetchedAt: number;
};

const DEFAULT_TIME_SERIES_TTL_MS = 108000;
const MAX_TIME_SERIES_CACHE_ENTRIES = 100;

function getTimeSeriesStores() {
    const globalStores = globalThis as typeof globalThis & {
        __gtlTwelveDataTimeSeriesCache__?: Map<string, TimeSeriesCacheEntry>;
        __gtlTwelveDataTimeSeriesPending__?: Map<string, Promise<TwelveDataTimeSeriesResponse>>;
    };

    globalStores.__gtlTwelveDataTimeSeriesCache__ ??= new Map();
    globalStores.__gtlTwelveDataTimeSeriesPending__ ??= new Map();

    return {
        cache: globalStores.__gtlTwelveDataTimeSeriesCache__,
        pending: globalStores.__gtlTwelveDataTimeSeriesPending__,
    };
}

function resolveTimeSeriesTtlMs() {
    const configuredTtl = Number.parseInt(
        String(process.env.TWELVEDATA_TIME_SERIES_TTL_MS ?? ""),
        10
    );

    return Number.isFinite(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_TIME_SERIES_TTL_MS;
}

function pruneTimeSeriesCache(cache: Map<string, TimeSeriesCacheEntry>) {
    while (cache.size > MAX_TIME_SERIES_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) {
            break;
        }
        cache.delete(oldestKey);
    }
}

export async function getTwelveDataQuotes(symbols: string[]) {
    const normalizedSymbols = symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);

    if (normalizedSymbols.length === 0) {
        return [];
    }

    const url = new URL("/quote", TWELVEDATA_BASE_URL);
    url.searchParams.set("symbol", normalizedSymbols.join(","));
    url.searchParams.set("apikey", serverEnv.TWELVEDATA_API_KEY);

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        throw new Error(`TwelveData batch request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as
        | TwelveDataQuoteResponse
        | TwelveDataBatchQuoteResponse;

    if (normalizedSymbols.length === 1) {
        const singlePayload = payload as TwelveDataQuoteResponse;

        if (singlePayload.status === "error" || singlePayload.code || singlePayload.message) {
            throw new Error(singlePayload.message ?? "TwelveData returned an error");
        }

        return [
            {
                requestedSymbol: normalizedSymbols[0],
                data: singlePayload,
            },
        ];
    }

    const globalError = payload as TwelveDataQuoteResponse;
    if (globalError.status === "error" || globalError.code || globalError.message) {
        return normalizedSymbols.map((symbol) => ({
            requestedSymbol: symbol,
            data: {
                status: "error",
                code: globalError.code,
                message:
                    globalError.message ??
                    `TwelveData batch quote error for ${symbol}`,
            },
        }));
    }

    const batchPayload = payload as TwelveDataBatchQuoteResponse;
    const normalizedPayloadEntries = Object.entries(batchPayload).map(
        ([key, value]) => ({
            key,
            normalizedKey: String(key || "").trim().toUpperCase(),
            value,
        })
    );

    return normalizedSymbols.map((symbol) => {
        const directMatch = batchPayload[symbol];
        const normalizedMatch =
            normalizedPayloadEntries.find(
                (entry) =>
                    entry.normalizedKey === symbol ||
                    entry.normalizedKey.startsWith(`${symbol}:`)
            )?.value;
        const data =
            directMatch ??
            normalizedMatch ??
            ({
                status: "error",
                message: `Missing TwelveData payload for ${symbol}`,
            } satisfies TwelveDataQuoteResponse);

        return {
            requestedSymbol: symbol,
            data,
        };
    });
}

export async function getTwelveDataTimeSeries(
    symbol: string,
    interval = "1min",
    outputsize = 300
) {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const normalizedInterval = interval.trim().toLowerCase();
    const normalizedOutputsize = Math.max(1, Math.trunc(outputsize));
    const cacheKey = `${normalizedSymbol}::${normalizedInterval}::${normalizedOutputsize}`;
    const { cache, pending } = getTimeSeriesStores();
    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry && Date.now() - cachedEntry.fetchedAt <= resolveTimeSeriesTtlMs()) {
        cache.delete(cacheKey);
        cache.set(cacheKey, cachedEntry);
        return cachedEntry.data;
    }

    if (cachedEntry) {
        cache.delete(cacheKey);
    }

    const pendingRequest = pending.get(cacheKey);
    if (pendingRequest) {
        return pendingRequest;
    }

    const request = fetchTwelveDataTimeSeries(
        normalizedSymbol,
        normalizedInterval,
        normalizedOutputsize
    )
        .then((data) => {
            cache.set(cacheKey, { data, fetchedAt: Date.now() });
            pruneTimeSeriesCache(cache);
            return data;
        })
        .finally(() => {
            pending.delete(cacheKey);
        });

    pending.set(cacheKey, request);
    return request;
}

async function fetchTwelveDataTimeSeries(
    symbol: string,
    interval: string,
    outputsize: number
) {
    const url = new URL("/time_series", TWELVEDATA_BASE_URL);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", serverEnv.TWELVEDATA_API_KEY);

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        throw new Error(`TwelveData time_series failed with status ${response.status}`);
    }

    const data = (await response.json()) as TwelveDataTimeSeriesResponse;

    if (data.status === "error" || data.code || data.message) {
        throw new Error(data.message ?? "TwelveData time_series returned an error");
    }

    return data;
}
