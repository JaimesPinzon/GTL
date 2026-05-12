import { NextResponse } from "next/server";

import { getProviderFreshnessMs, yahooBaseTimeframeConfigs } from "@/app/utils/market/timeframes";
import { trackedMarketSymbols } from "@/app/utils/market/symbols";
import {
    buildRecentMinuteFetchWindow,
    fetchAndStoreYahooBaseCandles,
} from "@/app/utils/yahoo/base-candles";
import {
    deleteYahooBaseCandlesForSymbol,
    getLatestStoredYahooBaseCandle,
    type YahooCandleBaseInterval,
} from "@/app/utils/yahoo/candles-storage";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const defaultBaseTimeframes = Object.keys(
    yahooBaseTimeframeConfigs
) as YahooCandleBaseInterval[];

function isAuthorized(request: Request) {
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (!cronSecret) {
        return true;
    }

    const authorizationHeader = request.headers.get("authorization")?.trim();
    return authorizationHeader === `Bearer ${cronSecret}`;
}

function parseSymbols(rawSymbols?: string[] | string | null) {
    if (Array.isArray(rawSymbols)) {
        const normalized = rawSymbols.map((symbol) => symbol.trim()).filter(Boolean);
        return normalized.length > 0 ? normalized : [...trackedMarketSymbols];
    }

    if (typeof rawSymbols === "string") {
        const normalized = rawSymbols.split(",").map((symbol) => symbol.trim()).filter(Boolean);
        return normalized.length > 0 ? normalized : [...trackedMarketSymbols];
    }

    return [...trackedMarketSymbols];
}

function parseBaseTimeframes(rawTimeframes?: string[] | string | null) {
    const source = Array.isArray(rawTimeframes)
        ? rawTimeframes
        : typeof rawTimeframes === "string"
          ? rawTimeframes.split(",")
          : defaultBaseTimeframes;

    const normalized = source
        .map((timeframe) => timeframe.trim().toLowerCase())
        .filter((timeframe): timeframe is YahooCandleBaseInterval => timeframe in yahooBaseTimeframeConfigs);

    return normalized.length > 0 ? normalized : defaultBaseTimeframes;
}

function parseUnixDate(value?: string | null) {
    if (!value) {
        return null;
    }

    const timestamp = Math.floor(new Date(value).getTime() / 1000);
    return Number.isFinite(timestamp) ? timestamp : null;
}

async function backfillBaseCandles(
    symbols: string[],
    baseTimeframes: YahooCandleBaseInterval[],
    force: boolean,
    replaceExisting: boolean,
    period1: number | null,
    period2: number | null,
    chunkDays: number | null
) {
    const results = [];

    for (const symbol of symbols) {
        const intervals = [];

        for (const baseTimeframe of baseTimeframes) {
            const config = yahooBaseTimeframeConfigs[baseTimeframe];

            try {
                if (!force) {
                    const latestStored = await getLatestStoredYahooBaseCandle(
                        symbol,
                        baseTimeframe
                    );

                    const latestFetchedAt = latestStored?.fetched_at
                        ? new Date(latestStored.fetched_at).getTime()
                        : null;
                    const isFresh =
                        latestFetchedAt !== null &&
                        Date.now() - latestFetchedAt <
                            getProviderFreshnessMs(config.providerInterval);

                    if (isFresh) {
                        intervals.push({
                            timeframe: baseTimeframe,
                            table: config.tableName,
                            providerInterval: config.providerInterval,
                            range: config.range,
                            status: "skipped_fresh",
                            latestStoredAt: latestStored?.candle_time ?? null,
                            latestFetchedAt: latestStored?.fetched_at ?? null,
                            isClosed: latestStored?.is_final ?? null,
                        });
                        continue;
                    }
                }

                if (replaceExisting) {
                    await deleteYahooBaseCandlesForSymbol(symbol, baseTimeframe);
                }

                const fetchOptions =
                    baseTimeframe === "1m"
                        ? period1 != null && period2 != null
                            ? { period1, period2, chunkDays: chunkDays ?? 8 }
                            : buildRecentMinuteFetchWindow()
                        : period1 != null && period2 != null
                          ? { period1, period2, chunkDays: chunkDays ?? undefined }
                          : {};

                const result = await fetchAndStoreYahooBaseCandles(
                    symbol,
                    baseTimeframe,
                    fetchOptions
                );

                intervals.push({
                    timeframe: baseTimeframe,
                    table: config.tableName,
                    providerInterval: config.providerInterval,
                    range: config.range,
                    status: "seeded",
                    fetched: result.candles.length,
                    insertedOrUpdated: result.insertedOrUpdated,
                    rejected: result.rejected,
                    rejectedReasons: result.rejectedReasons,
                    period1,
                    period2,
                    chunkDays: fetchOptions.chunkDays ?? null,
                });
            } catch (error) {
                intervals.push({
                    timeframe: baseTimeframe,
                    table: config.tableName,
                    providerInterval: config.providerInterval,
                    range: config.range,
                    status: "error",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown Yahoo base candles backfill error",
                });
            }
        }

        results.push({
            symbol,
            intervals,
        });
    }

    return results;
}

export const runtime = "nodejs";

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                ok: false,
                error: "Unauthorized base candles backfill request",
            },
            {
                status: 401,
                headers: corsHeaders,
            }
        );
    }

    try {
        const { searchParams } = new URL(request.url);
        const symbols = parseSymbols(searchParams.get("symbols"));
        const baseTimeframes = parseBaseTimeframes(searchParams.get("timeframes"));
        const force = searchParams.get("force") === "true";
        const replaceExisting = searchParams.get("replaceExisting") === "true";
        const period1 = parseUnixDate(searchParams.get("startDate"));
        const period2 = parseUnixDate(searchParams.get("endDate"));
        const chunkDays = Number.parseInt(searchParams.get("chunkDays") ?? "", 10);
        const results = await backfillBaseCandles(
            symbols,
            baseTimeframes,
            force,
            replaceExisting,
            period1,
            period2,
            Number.isFinite(chunkDays) ? chunkDays : null
        );

        return NextResponse.json(
            {
                ok: true,
                force,
                replaceExisting,
                symbols,
                timeframes: baseTimeframes,
                period1,
                period2,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unexpected base candles backfill error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}

export async function POST(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                ok: false,
                error: "Unauthorized base candles backfill request",
            },
            {
                status: 401,
                headers: corsHeaders,
            }
        );
    }

    try {
        const body = (await request.json().catch(() => ({}))) as {
            symbols?: string[];
            timeframes?: string[];
            force?: boolean;
            replaceExisting?: boolean;
            startDate?: string;
            endDate?: string;
            chunkDays?: number;
        };

        const symbols = parseSymbols(body.symbols);
        const baseTimeframes = parseBaseTimeframes(body.timeframes);
        const force = body.force === true;
        const replaceExisting = body.replaceExisting === true;
        const period1 = parseUnixDate(body.startDate ?? null);
        const period2 = parseUnixDate(body.endDate ?? null);
        const results = await backfillBaseCandles(
            symbols,
            baseTimeframes,
            force,
            replaceExisting,
            period1,
            period2,
            Number.isFinite(body.chunkDays) ? (body.chunkDays ?? null) : null
        );

        return NextResponse.json(
            {
                ok: true,
                force,
                replaceExisting,
                symbols,
                timeframes: baseTimeframes,
                period1,
                period2,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unexpected base candles backfill error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}

