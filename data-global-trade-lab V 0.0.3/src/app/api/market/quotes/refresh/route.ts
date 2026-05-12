import { NextResponse } from "next/server";

import { parseTrackedSymbols } from "@/app/utils/market/symbols";
import { saveQuoteHistoryBatch } from "@/app/utils/twelvedata/history";
import { getTwelveDataQuotes } from "@/app/utils/twelvedata/server";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function isAuthorized(request: Request) {
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (!cronSecret) {
        return true;
    }

    const authorizationHeader = request.headers.get("authorization")?.trim();
    return authorizationHeader === `Bearer ${cronSecret}`;
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
                error: "Unauthorized refresh request",
            },
            {
                status: 401,
                headers: corsHeaders,
            }
        );
    }

    const { searchParams } = new URL(request.url);
    const symbols = parseTrackedSymbols(searchParams.get("symbols"));

    try {
        const quoteResponses = await getTwelveDataQuotes(symbols);
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
                    error: data.message ?? "Unexpected TwelveData error",
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
                refreshedAt: new Date().toISOString(),
                symbols,
                results,
            },
            { headers: corsHeaders }
        );
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error:
                    error instanceof Error ? error.message : "Unexpected scheduled quote refresh error",
            },
            {
                status: 500,
                headers: corsHeaders,
            }
        );
    }
}
