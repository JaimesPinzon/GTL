import { NextResponse } from "next/server";

import { getCachedOrFetchBatchQuotes } from "@/app/utils/market/quotes-cache";
import { saveQuoteHistory } from "@/app/utils/twelvedata/history";

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
    const symbol = searchParams.get("symbol")?.trim() ?? "AAPL";

    try {
        const [entry] = await getCachedOrFetchBatchQuotes([symbol]);
        const data = entry?.data ?? null;

        if (!data || data.status === "error" || data.code || data.message) {
            return NextResponse.json(
                {
                    ok: true,
                    degraded: true,
                    error: data?.message ?? `Missing TwelveData payload for ${symbol}`,
                    data: null,
                    persisted: false,
                },
                {
                    headers: corsHeaders,
                }
            );
        }

        let persisted = true;

        try {
            await saveQuoteHistory({
                requestedSymbol: symbol,
                ...data,
            });
        } catch {
            persisted = false;
        }

        return NextResponse.json(
            {
                ok: true,
                data,
                persisted,
                cacheTtlMs: 108000,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unexpected TwelveData error";

        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                error: message,
                data: null,
                persisted: false,
            },
            {
                headers: corsHeaders,
            }
        );
    }
}
