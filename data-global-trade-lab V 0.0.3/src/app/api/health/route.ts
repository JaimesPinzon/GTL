import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json(
        {
            ok: true,
            service: "data-global-trade-lab",
            timestamp: new Date().toISOString(),
        },
        { status: 200 }
    );
}

