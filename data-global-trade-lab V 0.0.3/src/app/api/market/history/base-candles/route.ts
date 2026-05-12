import { NextResponse } from "next/server";

import { readBaseCandlesForTimeframe } from "@/app/utils/yahoo/base-candles-read";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
        const symbols = (searchParams.get("symbols") ?? "")
            .split(",")
            .map((symbol) => symbol.trim())
            .filter(Boolean);
        const timeframe = searchParams.get("timeframe")?.trim() ?? "1D";
        const limit = Number.parseInt(searchParams.get("limit") ?? "300", 10);
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        if (symbols.length === 0) {
            return NextResponse.json(
                { ok: false, error: "symbols is required" },
                { status: 400, headers: corsHeaders }
            );
        }

        const results = await Promise.all(
            symbols.map((symbol) => readBaseCandlesForTimeframe({
                symbol,
                timeframe,
                limit,
                from,
                to,
            }))
        );

        return NextResponse.json(
            {
                ok: true,
                timeframe,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error ? error.message : "Unexpected base candles history error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}
