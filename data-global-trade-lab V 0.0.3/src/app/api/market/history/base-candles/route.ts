import { NextResponse } from "next/server";

import { readBaseCandlesForTimeframe } from "@/app/utils/yahoo/base-candles-read";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbols = (searchParams.get("symbols") ?? "")
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);
    const timeframe = searchParams.get("timeframe")?.trim() ?? "1D";
    const limit = Number.parseInt(searchParams.get("limit") ?? "300", 10);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    try {
        if (symbols.length === 0) {
            return NextResponse.json(
                { ok: false, error: "symbols is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        const settledResults = await Promise.allSettled(
            symbols.map((symbol) => readBaseCandlesForTimeframe({
                symbol,
                timeframe,
                limit,
                from,
                to,
            }))
        );

        const results = settledResults.map((entry, index) => {
            const requestedSymbol = symbols[index];

            if (entry.status === "fulfilled") {
                return entry.value;
            }

            return {
                symbol: requestedSymbol,
                timeframe,
                source: "candles",
                baseInterval: null,
                aggregateSize: 1,
                rowsRead: 0,
                data: [],
                degraded: true,
                error:
                    entry.reason instanceof Error
                        ? entry.reason.message
                        : "Unexpected symbol base candles history error",
            };
        });

        return NextResponse.json(
            {
                ok: true,
                timeframe,
                degraded: settledResults.some((entry) => entry.status === "rejected"),
                results,
            },
            {
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                timeframe,
                results: symbols.map((symbol) => ({
                    symbol,
                    timeframe,
                    source: "candles",
                    baseInterval: null,
                    aggregateSize: 1,
                    rowsRead: 0,
                    data: [],
                    degraded: true,
                })),
                error:
                    error instanceof Error ? error.message : "Unexpected base candles history error",
            },
            {
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
