import { NextResponse } from "next/server";

import { parseTrackedSymbols } from "@/app/utils/market/symbols";
import { saveMarketCandles } from "@/app/utils/twelvedata/candles";
import { getYahooHistoricalChart, toYahooSymbol } from "@/app/utils/yahoo/server";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const defaultSymbols = parseTrackedSymbols(null);

const baseIntervals = [
    { providerInterval: "1m", range: "max" },
    { providerInterval: "2m", range: "max" },
    { providerInterval: "5m", range: "max" },
    { providerInterval: "15m", range: "max" },
    { providerInterval: "30m", range: "max" },
    { providerInterval: "60m", range: "max" },
    { providerInterval: "1d", range: "max" },
    { providerInterval: "1wk", range: "max" },
    { providerInterval: "1mo", range: "max" },
    { providerInterval: "3mo", range: "max" },
] as const;

function parseNumeric(value: number | string | null | undefined) {
    const numeric =
        typeof value === "number" ? value : Number.parseFloat(value ?? "");
    return Number.isFinite(numeric) ? numeric : null;
}

function getProviderFreshnessMs(providerInterval: string) {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const freshnessByInterval: Record<string, number> = {
        "1m": FIVE_MINUTES_MS,
        "2m": FIVE_MINUTES_MS,
        "5m": FIVE_MINUTES_MS,
        "15m": FIVE_MINUTES_MS,
        "30m": FIVE_MINUTES_MS,
        "60m": FIVE_MINUTES_MS,
        "1d": FIVE_MINUTES_MS,
        "1wk": FIVE_MINUTES_MS,
        "1mo": FIVE_MINUTES_MS,
        "3mo": FIVE_MINUTES_MS,
    };

    return freshnessByInterval[providerInterval] ?? FIVE_MINUTES_MS;
}

async function fetchAndStoreYahooCandles(symbol: string, providerInterval: string, range: string) {
    const yahooChart = await getYahooHistoricalChart(symbol, providerInterval, range);
    const candles = yahooChart.candles;

    if (candles.length === 0) {
        return [];
    }

    await saveMarketCandles(
        candles.map((candle) => ({
            requestedSymbol: symbol,
            providerSymbol: candle.providerSymbol ?? toYahooSymbol(symbol),
            interval: providerInterval,
            candleTime: candle.time,
            exchange: candle.exchange ?? yahooChart.meta.exchangeName,
            currency: candle.currency,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: parseNumeric(candle.volume),
        }))
    );

    return candles;
}

async function backfillSymbols(symbols: string[], force: boolean) {
    const results = await Promise.all(
        symbols.map(async (symbol) => {
            const intervals = await Promise.all(
                baseIntervals.map(async (config) => {
                    try {
                        if (!force) {
                            const { data, error } = await supabaseAdmin
                                .from("candles")
                                .select("open_time")
                                .eq("instrument_id", symbol)
                                .eq("timeframe", config.providerInterval)
                                .order("open_time", { ascending: false })
                                .limit(1);

                            if (error) {
                                throw error;
                            }

                            const latestRow = data?.[0];
                            const isFresh =
                                latestRow &&
                                Date.now() - new Date(latestRow.open_time).getTime() <
                                    getProviderFreshnessMs(config.providerInterval);

                            if (isFresh) {
                                return {
                                    interval: config.providerInterval,
                                    range: config.range,
                                    status: "skipped_fresh",
                                };
                            }
                        }

                        const candles = await fetchAndStoreYahooCandles(
                            symbol,
                            config.providerInterval,
                            config.range
                        );

                        return {
                            interval: config.providerInterval,
                            range: config.range,
                            status: "seeded",
                            candles: candles.length,
                        };
                    } catch (error) {
                        return {
                            interval: config.providerInterval,
                            range: config.range,
                            status: "error",
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown Yahoo backfill error",
                        };
                    }
                })
            );

            return {
                symbol,
                intervals,
            };
        })
    );

    return results;
}

function getSymbolsFromSearchParams(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbols = searchParams.get("symbols")?.trim();

    return rawSymbols
        ? rawSymbols
              .split(",")
              .map((symbol) => symbol.trim())
              .filter(Boolean)
        : defaultSymbols;
}

function getForceFromSearchParams(request: Request) {
    const { searchParams } = new URL(request.url);
    return searchParams.get("force") === "true";
}

export const runtime = "nodejs";

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    try {
        const symbols = getSymbolsFromSearchParams(request);
        const force = getForceFromSearchParams(request);
        const results = await backfillSymbols(symbols, force);

        return NextResponse.json(
            {
                ok: true,
                force,
                symbols,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Unexpected market backfill error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = (await request.json().catch(() => ({}))) as {
            symbols?: string[];
            force?: boolean;
        };

        const symbols =
            body.symbols?.map((symbol) => symbol.trim()).filter(Boolean) ?? defaultSymbols;
        const force = body.force === true;
        const results = await backfillSymbols(symbols, force);

        return NextResponse.json(
            {
                ok: true,
                force,
                symbols,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Unexpected market backfill error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}


