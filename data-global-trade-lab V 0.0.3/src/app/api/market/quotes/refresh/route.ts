import { NextResponse } from "next/server";

import { refreshTrackedQuotesIfDue } from "@/app/utils/market/quotes-refresh";
import { parseTrackedSymbols } from "@/app/utils/market/symbols";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

async function handleRefresh(request: Request) {
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
        const refreshResult = await refreshTrackedQuotesIfDue({ symbols });

        return NextResponse.json(
            {
                ...refreshResult,
                symbols,
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

export async function GET(request: Request) {
    return handleRefresh(request);
}

export async function POST(request: Request) {
    return handleRefresh(request);
}
