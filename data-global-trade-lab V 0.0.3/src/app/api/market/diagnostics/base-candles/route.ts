import { NextResponse } from "next/server";

import { yahooBaseTimeframeConfigs } from "@/app/utils/market/timeframes";
import { trackedMarketSymbols } from "@/app/utils/market/symbols";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import {
    YAHOO_CANDLES_TABLE_NAME,
    type YahooCandleBaseInterval,
} from "@/app/utils/yahoo/candles-storage";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const defaultBaseTimeframes = Object.keys(
    yahooBaseTimeframeConfigs
) as YahooCandleBaseInterval[];

type TableDiagnostics = {
    symbol: string;
    timeframe: YahooCandleBaseInterval;
    table: string;
    providerInterval: string;
    count: number;
    oldestCandleTime: string | null;
    latestCandleTime: string | null;
    latestFetchedAt: string | null;
    oldestProviderSymbol: string | null;
    latestProviderSymbol: string | null;
    closedCandles: number | null;
    openCandles: number | null;
};

function parseSymbols(rawSymbols?: string | null) {
    const normalizedSymbols = rawSymbols
        ?.split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);

    return normalizedSymbols?.length ? normalizedSymbols : [...trackedMarketSymbols];
}

function parseBaseTimeframes(rawTimeframes?: string | null) {
    const source = rawTimeframes
        ? rawTimeframes.split(",")
        : defaultBaseTimeframes;

    const normalized = source
        .map((timeframe) => timeframe.trim().toLowerCase())
        .filter(
            (timeframe): timeframe is YahooCandleBaseInterval =>
                timeframe in yahooBaseTimeframeConfigs
        );

    return normalized.length > 0 ? normalized : defaultBaseTimeframes;
}

async function getTableDiagnostics(
    symbol: string,
    timeframe: YahooCandleBaseInterval
): Promise<TableDiagnostics> {
    const config = yahooBaseTimeframeConfigs[timeframe];

    const [{ count, error: countError }, { data: oldestRows, error: oldestError }, { data: latestRows, error: latestError }] =
        await Promise.all([
            supabaseAdmin
                .from(YAHOO_CANDLES_TABLE_NAME)
                .select("exchange_id", { count: "exact", head: true })
                .eq("instrument_id", symbol)
                .eq("timeframe", timeframe),
            supabaseAdmin
                .from(YAHOO_CANDLES_TABLE_NAME)
                .select("open_time,fetched_at,provider_symbol,is_final")
                .eq("instrument_id", symbol)
                .eq("timeframe", timeframe)
                .order("open_time", { ascending: true })
                .limit(1),
            supabaseAdmin
                .from(YAHOO_CANDLES_TABLE_NAME)
                .select("open_time,fetched_at,provider_symbol,is_final")
                .eq("instrument_id", symbol)
                .eq("timeframe", timeframe)
                .order("open_time", { ascending: false })
                .limit(1),
        ]);

    if (countError) {
        throw countError;
    }

    if (oldestError) {
        throw oldestError;
    }

    if (latestError) {
        throw latestError;
    }

    const oldestRow = oldestRows?.[0] ?? null;
    const latestRow = latestRows?.[0] ?? null;
    const totalCount = count ?? 0;
    const latestIsFinal = latestRow?.is_final;
    const openCandles = latestIsFinal === false && totalCount > 0 ? 1 : 0;
    const closedCandles = totalCount > 0 ? totalCount - openCandles : 0;

    return {
        symbol,
        timeframe,
        table: YAHOO_CANDLES_TABLE_NAME,
        providerInterval: config.providerInterval,
        count: totalCount,
        oldestCandleTime: oldestRow?.open_time ?? null,
        latestCandleTime: latestRow?.open_time ?? null,
        latestFetchedAt: latestRow?.fetched_at ?? null,
        oldestProviderSymbol: oldestRow?.provider_symbol ?? null,
        latestProviderSymbol: latestRow?.provider_symbol ?? null,
        closedCandles,
        openCandles,
    };
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
        const { searchParams } = new URL(request.url);
        const symbols = parseSymbols(searchParams.get("symbols"));
        const timeframes = parseBaseTimeframes(searchParams.get("timeframes"));

        const diagnostics = await Promise.all(
            symbols.map(async (symbol) => ({
                symbol,
                tables: await Promise.all(
                    timeframes.map((timeframe) => getTableDiagnostics(symbol, timeframe))
                ),
            }))
        );

        const totalsByTimeframe = timeframes.map((timeframe) => {
            const rows = diagnostics.flatMap((item) =>
                item.tables.filter((table) => table.timeframe === timeframe)
            );

            return {
                timeframe,
                table: YAHOO_CANDLES_TABLE_NAME,
                symbols: rows.length,
                totalRows: rows.reduce((sum, row) => sum + row.count, 0),
                totalClosedCandles: rows.reduce(
                    (sum, row) => sum + (row.closedCandles ?? 0),
                    0
                ),
                totalOpenCandles: rows.reduce(
                    (sum, row) => sum + (row.openCandles ?? 0),
                    0
                ),
            };
        });

        return NextResponse.json(
            {
                ok: true,
                symbols,
                timeframes,
                totalsByTimeframe,
                diagnostics,
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
                        : "Unexpected base candles diagnostics error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}
