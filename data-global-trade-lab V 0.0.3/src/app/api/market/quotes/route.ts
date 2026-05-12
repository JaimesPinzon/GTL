import { NextResponse } from "next/server";

import { getCachedOrFetchBatchQuotes } from "@/app/utils/market/quotes-cache";
import { saveQuoteHistoryBatch } from "@/app/utils/twelvedata/history";

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
    const rawSymbols = searchParams.get("symbols")?.trim() ?? "AAPL";
    const symbols = rawSymbols
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);

    try {
        const quoteResponses = await getCachedOrFetchBatchQuotes(symbols);
        const successfulQuotes = quoteResponses
            .filter(({ data }) => !(data.status === "error" || data.code || data.message))
            .map(({ requestedSymbol, data }) => ({
                requestedSymbol,
                ...data,
            }));

        let persisted = true;
        try {
            await saveQuoteHistoryBatch(successfulQuotes);
        } catch {
            persisted = false;
        }

        const results = quoteResponses.map(({ requestedSymbol, data }) => {
            if (data.status === "error" || data.code || data.message) {
                return {
                    requestedSymbol,
                    ok: false,
                    error: data.message ?? `Missing TwelveData payload for ${requestedSymbol}`,
                };
            }

            return {
                requestedSymbol,
                ok: true,
                persisted,
                data,
            };
        });

        return NextResponse.json(
            {
                ok: true,
                cacheTtlMs: 108000,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: true,
                degraded: true,
                error:
                    error instanceof Error ? error.message : "Unexpected batch quote error",
                results: symbols.map((requestedSymbol) => ({
                    requestedSymbol,
                    ok: false,
                    error:
                        error instanceof Error ? error.message : "Unexpected batch quote error",
                })),
            },
            {
                headers: corsHeaders,
            }
        );
    }
}
