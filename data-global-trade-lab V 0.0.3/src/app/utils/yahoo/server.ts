import "server-only";

const YAHOO_FINANCE_BASE_URL = "https://query1.finance.yahoo.com";

type YahooChartMeta = {
    symbol?: string;
    currency?: string;
    exchangeName?: string;
    instrumentType?: string;
    dataGranularity?: string;
    range?: string;
};

type YahooChartQuote = {
    open?: Array<number | null>;
    high?: Array<number | null>;
    low?: Array<number | null>;
    close?: Array<number | null>;
    volume?: Array<number | null>;
};

type YahooChartResult = {
    meta?: YahooChartMeta;
    timestamp?: number[];
    indicators?: {
        quote?: YahooChartQuote[];
    };
};

type YahooChartResponse = {
    chart?: {
        result?: YahooChartResult[];
        error?: {
            code?: string;
            description?: string;
        } | null;
    };
};

const YAHOO_SYMBOL_MAP: Record<string, string> = {
    DJI: "^DJI",
    DJIA: "^DJI",
    SPX: "^GSPC",
    SP500: "^GSPC",
    "BRK.B": "BRK-B",
};

export function toYahooSymbol(symbol: string) {
    const trimmedSymbol = symbol.trim();
    const normalizedSymbol = trimmedSymbol.toUpperCase();

    if (YAHOO_SYMBOL_MAP[normalizedSymbol]) {
        return YAHOO_SYMBOL_MAP[normalizedSymbol];
    }

    if (trimmedSymbol.includes("/")) {
        return trimmedSymbol.replace("/", "-");
    }

    if (trimmedSymbol.includes(".")) {
        return trimmedSymbol.replaceAll(".", "-");
    }

    return trimmedSymbol;
}

function buildYahooChartUrl(
    yahooSymbol: string,
    params: Record<string, string | number>
) {
    const url = new URL(
        `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
        YAHOO_FINANCE_BASE_URL
    );

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });

    url.searchParams.set("includePrePost", "false");
    url.searchParams.set("events", "div,splits");

    return url;
}

async function requestYahooChart(symbol: string, params: Record<string, string | number>) {
    const yahooSymbol = toYahooSymbol(symbol);
    const url = buildYahooChartUrl(yahooSymbol, params);

    let response: Response;

    try {
        response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json,text/plain,*/*",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(12000),
        });
    } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            const descriptor = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join(", ");
            throw new Error(`Yahoo Finance timeout for ${symbol} (${descriptor})`);
        }

        throw error;
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
            errorText || `Yahoo Finance chart request failed with status ${response.status}`
        );
    }

    const payload = (await response.json()) as YahooChartResponse;
    const chart = payload.chart;

    if (chart?.error) {
        throw new Error(chart.error.description ?? "Yahoo Finance returned an error");
    }

    const result = chart?.result?.[0];

    if (!result?.timestamp?.length || !result.indicators?.quote?.[0]) {
        throw new Error("Yahoo Finance returned no historical chart data");
    }

    const quote = result.indicators.quote[0];
    const candles = result.timestamp
        .map((timestamp, index) => {
            const open = quote.open?.[index] ?? null;
            const high = quote.high?.[index] ?? null;
            const low = quote.low?.[index] ?? null;
            const close = quote.close?.[index] ?? null;
            const volume = quote.volume?.[index] ?? null;

            if (open === null || high === null || low === null || close === null) {
                return null;
            }

            return {
                time: new Date(timestamp * 1000).toISOString(),
                open,
                high,
                low,
                close,
                value: close,
                volume,
                currency: result.meta?.currency ?? "USD",
                exchange: result.meta?.exchangeName ?? null,
                providerSymbol: result.meta?.symbol ?? yahooSymbol,
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
        symbol: yahooSymbol,
        meta: result.meta ?? {},
        candles,
    };
}

export async function getYahooHistoricalChart(
    symbol: string,
    interval: string,
    range: string
) {
    return requestYahooChart(symbol, { interval, range });
}

export async function getYahooHistoricalChartByPeriod(
    symbol: string,
    interval: string,
    period1: number,
    period2: number
) {
    return requestYahooChart(symbol, { interval, period1, period2 });
}
