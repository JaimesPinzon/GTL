import "server-only";

import { serverEnv } from "@/app/utils/env";

const TWELVEDATA_BASE_URL = "https://api.twelvedata.com";

type TwelveDataQuoteResponse = {
    symbol?: string;
    name?: string;
    exchange?: string;
    currency?: string;
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

export async function getTwelveDataQuote(symbol: string) {
    const url = new URL("/quote", TWELVEDATA_BASE_URL);
    url.searchParams.set("symbol", symbol);
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
        throw new Error(`TwelveData request failed with status ${response.status}`);
    }

    const data = (await response.json()) as TwelveDataQuoteResponse;

    if (data.status === "error" || data.code || data.message) {
        throw new Error(data.message ?? "TwelveData returned an error");
    }

    return data;
}

export async function getTwelveDataQuotes(symbols: string[]) {
    const normalizedSymbols = symbols
        .map((symbol) => symbol.trim())
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

    return normalizedSymbols.map((symbol) => {
        const data = (payload as TwelveDataBatchQuoteResponse)?.[symbol] ?? {
            status: "error",
            message: `Missing TwelveData payload for ${symbol}`,
        };

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
