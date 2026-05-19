import { NextResponse } from "next/server";

import { listLastCandleMarketSnapshots } from "@/app/utils/market/last-candle-market";

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
    const { searchParams } = new URL(request.url);
    const rawLimit = Number.parseInt(searchParams.get("limit") || "300", 10);
    const source = searchParams.get("source")?.trim() || "twelvedata";
    const rawSymbols = searchParams.get("symbols")?.trim() || "";
    const symbols = rawSymbols
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);

    try {
        const rows = await listLastCandleMarketSnapshots({
            limit: rawLimit,
            source,
            symbols,
        });

        return NextResponse.json(
            {
                ok: true,
                count: rows.length,
                cacheTtlMs: 60000,
                rows,
            },
            {
                headers: corsHeaders,
            }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unexpected last candle market fetch error",
                rows: [],
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}
