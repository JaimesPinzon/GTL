import { NextResponse } from "next/server";

import { TIMEZONE_OPTIONS } from "@/app/utils/preferences/timezones";

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

export async function GET() {
    return NextResponse.json(
        {
            ok: true,
            results: TIMEZONE_OPTIONS,
        },
        {
            headers: corsHeaders,
        }
    );
}

