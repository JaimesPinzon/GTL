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
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "1D";
    const limit = Number.parseInt(searchParams.get("limit") ?? "300", 10);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    try {
        if (!symbol) {
            return NextResponse.json(
                { ok: false, error: "symbol is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        const result = await readBaseCandlesForTimeframe({
            symbol,
            timeframe,
            limit,
            from,
            to,
        });

        return NextResponse.json(
            {
                ok: true,
                ...result,
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
                symbol,
                timeframe,
                source: "candles",
                baseInterval: null,
                aggregateSize: 1,
                rowsRead: 0,
                data: [],
                error:
                    error instanceof Error ? error.message : "Unexpected base candles OHLC error",
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
