import { NextResponse } from "next/server";

import { createAuthenticatedSupabaseClient } from "@/app/utils/supabase/auth-user";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type DrawingPoint = {
    time: number;
    price: number;
    logical?: number | null;
};

type DrawingObject = {
    id: number | string;
    type: string;
    points: DrawingPoint[];
};

function getAccessToken(request: Request) {
    const authorization = request.headers.get("authorization") || request.headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || "";
}

async function requireUser(request: Request) {
    const accessToken = getAccessToken(request);

    if (!accessToken) {
        return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders }) };
    }

    const supabase = createAuthenticatedSupabaseClient(accessToken);
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders }) };
    }

    return { user };
}

function sanitizeDrawings(rawObjects: unknown): DrawingObject[] {
    if (!Array.isArray(rawObjects)) {
        return [];
    }

    return rawObjects
        .map((entry) => {
            const object = entry as DrawingObject;
            const type = typeof object?.type === "string" ? object.type.trim() : "";
            const id = typeof object?.id === "number" || typeof object?.id === "string" ? object.id : Date.now();
            const points = Array.isArray(object?.points)
                ? object.points
                      .map((point) => {
                          const time = Number((point as DrawingPoint)?.time);
                          const price = Number((point as DrawingPoint)?.price);
                          const logicalValue = (point as DrawingPoint)?.logical;
                          const logical = Number.isFinite(Number(logicalValue)) ? Number(logicalValue) : null;

                          if (!Number.isFinite(time) || !Number.isFinite(price)) {
                              return null;
                          }

                          return {
                              time: Math.floor(time),
                              price,
                              logical,
                          };
                      })
                      .filter((point): point is NonNullable<typeof point> => point !== null)
                : [];

            if (!type || points.length < 2) {
                return null;
            }

            return { id, type, points };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export const runtime = "nodejs";

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(request: Request) {
    const auth = await requireUser(request);
    if (auth.error) {
        return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "";

    if (!symbol || !timeframe) {
        return NextResponse.json(
            { ok: false, error: "symbol and timeframe are required" },
            { status: 400, headers: corsHeaders }
        );
    }

    const { data, error } = await supabaseAdmin
        .from("chart_drawings")
        .select("objects, updated_at")
        .eq("user_id", auth.user.id)
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .maybeSingle();

    if (error) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }

    return NextResponse.json(
        {
            ok: true,
            symbol,
            timeframe,
            objects: sanitizeDrawings(data?.objects),
            updatedAt: data?.updated_at ?? null,
        },
        { headers: corsHeaders }
    );
}

export async function PUT(request: Request) {
    const auth = await requireUser(request);
    if (auth.error) {
        return auth.error;
    }

    const body = await request.json().catch(() => null);
    const symbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
    const timeframe = typeof body?.timeframe === "string" ? body.timeframe.trim() : "";
    const objects = sanitizeDrawings(body?.objects);

    if (!symbol || !timeframe) {
        return NextResponse.json(
            { ok: false, error: "symbol and timeframe are required" },
            { status: 400, headers: corsHeaders }
        );
    }

    const { error } = await supabaseAdmin.from("chart_drawings").upsert(
        {
            user_id: auth.user.id,
            symbol,
            timeframe,
            objects,
        },
        { onConflict: "user_id,symbol,timeframe" }
    );

    if (error) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }

    return NextResponse.json(
        {
            ok: true,
            symbol,
            timeframe,
            objects,
        },
        { headers: corsHeaders }
    );
}

export async function DELETE(request: Request) {
    const auth = await requireUser(request);
    if (auth.error) {
        return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "";

    if (!symbol || !timeframe) {
        return NextResponse.json(
            { ok: false, error: "symbol and timeframe are required" },
            { status: 400, headers: corsHeaders }
        );
    }

    const { error } = await supabaseAdmin
        .from("chart_drawings")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("symbol", symbol)
        .eq("timeframe", timeframe);

    if (error) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }

    return NextResponse.json(
        { ok: true, symbol, timeframe },
        { headers: corsHeaders }
    );
}

