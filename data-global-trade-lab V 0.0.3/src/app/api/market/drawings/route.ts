import { NextResponse } from "next/server";

import { canManageRoom } from "@/app/api/rooms/_shared";
import { createAuthenticatedSupabaseClient } from "@/app/utils/supabase/auth-user";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type JsonObject = Record<string, unknown>;
type DrawingPoint = {
    time: number;
    price: number;
    logical: number | null;
    candleIndex: number | null;
    snapSource: string | null;
};

function asObject(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function optionalText(value: unknown, maximumLength = 200): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().slice(0, maximumLength);
    return normalized || null;
}

function toBoolean(value: unknown, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
    }
    return value == null ? fallback : Boolean(value);
}

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

    // The GTL access token is the canonical browser session. Keep the Supabase
    // token fallback so frontend/backend deployments can be rolled out safely.
    try {
        const user = await getAuthenticatedUser(accessToken);
        return { user };
    } catch {
        // Fall through to validate a legacy/direct Supabase access token.
    }

    const supabase = createAuthenticatedSupabaseClient(accessToken);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders }) };
    }

    return { user };
}

function sanitizePoint(rawPoint: unknown): DrawingPoint | null {
    const point = asObject(rawPoint);
    const time = Number(point.time);
    const price = Number(point.price);
    if (!Number.isFinite(time) || !Number.isFinite(price)) return null;
    const logical = Number(point.logical ?? point.candleIndex);
    const candleIndex = Number(point.candleIndex ?? point.logical);
    return {
        time: Math.floor(time),
        price,
        logical: Number.isFinite(logical) ? logical : null,
        candleIndex: Number.isFinite(candleIndex) ? candleIndex : null,
        snapSource: optionalText(point.snapSource, 40),
    };
}

function sanitizeDrawing(rawEntry: unknown): JsonObject | null {
    const entry = asObject(rawEntry);
    const type = optionalText(entry.type, 80);
    const rawAnchors = Array.isArray(entry.anchors)
        ? entry.anchors
        : Array.isArray(entry.points)
          ? entry.points
          : [];
    const anchors = rawAnchors.map(sanitizePoint).filter((point): point is DrawingPoint => point !== null);
    if (!type || anchors.length === 0) return null;

    const id = typeof entry.id === "string" || typeof entry.id === "number"
        ? entry.id
        : crypto.randomUUID();
    const timeframeScope = asObject(entry.timeframeScope);
    const state = asObject(entry.state);
    const ownership = asObject(entry.ownership);
    const education = asObject(entry.education);
    const fibonacci = entry.fibonacci == null ? null : asObject(entry.fibonacci);
    const position = entry.position == null ? null : asObject(entry.position);

    return {
        id,
        type,
        name: optionalText(entry.name, 160) || "",
        symbol: optionalText(entry.symbol, 80) || "",
        marketId: optionalText(entry.marketId, 80) || optionalText(entry.symbol, 80) || "",
        timeframeScope: {
            mode: timeframeScope.mode === "single" ? "single" : "all",
            timeframe: optionalText(timeframeScope.timeframe, 40),
        },
        anchors,
        style: asObject(entry.style),
        fibonacci,
        position,
        state: {
            locked: toBoolean(state.locked),
            hidden: toBoolean(state.hidden),
            selected: false,
        },
        ownership: {
            ownerId: optionalText(ownership.ownerId, 80),
            visibility: ownership.visibility === "class" ? "class" : "private",
            classId: optionalText(ownership.classId, 80),
        },
        education: {
            explanation: typeof education.explanation === "string" ? education.explanation.slice(0, 2000) : "",
            showExplanation: toBoolean(education.showExplanation, true),
            activityId: optionalText(education.activityId, 160),
            historicalEventId: optionalText(education.historicalEventId, 160),
            isTemplate: toBoolean(education.isTemplate),
            readOnly: toBoolean(education.readOnly),
        },
        zIndex: Number.isFinite(Number(entry.zIndex)) ? Number(entry.zIndex) : 0,
        version: Math.max(1, Number.isFinite(Number(entry.version)) ? Number(entry.version) : 1),
        createdAt: optionalText(entry.createdAt, 80),
        updatedAt: optionalText(entry.updatedAt, 80),
    };
}

function sanitizeDrawings(rawObjects: unknown): JsonObject[] {
    if (!Array.isArray(rawObjects)) return [];
    return rawObjects
        .slice(0, 1000)
        .map(sanitizeDrawing)
        .filter((entry): entry is JsonObject => entry !== null);
}

async function hasActiveRoomMembership(userId: string, classId: string) {
    const { data, error } = await supabaseAdmin
        .from("room_members")
        .select("id")
        .eq("room_id", classId)
        .eq("user_id", userId)
        .eq("state", "active")
        .maybeSingle();
    return !error && Boolean(data);
}

function markOwnedDrawing(drawing: JsonObject, userId: string) {
    return {
        ...drawing,
        ownership: {
            ...asObject(drawing.ownership),
            ownerId: userId,
        },
        education: {
            ...asObject(drawing.education),
            readOnly: false,
        },
    };
}

function markSharedDrawing(drawing: JsonObject, ownerId: string, classId: string) {
    return {
        ...drawing,
        ownership: {
            ...asObject(drawing.ownership),
            ownerId,
            visibility: "class",
            classId,
        },
        education: {
            ...asObject(drawing.education),
            readOnly: true,
        },
        state: {
            ...asObject(drawing.state),
            locked: true,
            selected: false,
        },
    };
}

function isSchemaCompatibilityError(error: { code?: string; message?: string } | null) {
    return Boolean(error && (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        /class_id|visibility/i.test(error.message || "")
    ));
}

export const runtime = "nodejs";

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "";
    const requestedClassId = searchParams.get("classId")?.trim() ?? "";

    if (!symbol || !timeframe) {
        return NextResponse.json({ ok: false, error: "symbol and timeframe are required" }, { status: 400, headers: corsHeaders });
    }

    const { data: ownRow, error: ownError } = await supabaseAdmin
        .from("chart_drawings")
        .select("objects, updated_at")
        .eq("user_id", auth.user.id)
        .eq("symbol", symbol)
        .eq("timeframe", timeframe)
        .maybeSingle();

    if (ownError) {
        return NextResponse.json({ ok: false, error: ownError.message }, { status: 500, headers: corsHeaders });
    }

    const ownObjects = sanitizeDrawings(ownRow?.objects).map((drawing) => markOwnedDrawing(drawing, auth.user.id));
    let sharedObjects: JsonObject[] = [];

    if (requestedClassId && await hasActiveRoomMembership(auth.user.id, requestedClassId)) {
        const { data: sharedRows, error: sharedError } = await supabaseAdmin
            .from("chart_drawings")
            .select("user_id, objects")
            .eq("class_id", requestedClassId)
            .eq("visibility", "class")
            .eq("symbol", symbol)
            .eq("timeframe", timeframe)
            .neq("user_id", auth.user.id);

        if (sharedError && !isSchemaCompatibilityError(sharedError)) {
            return NextResponse.json({ ok: false, error: sharedError.message }, { status: 500, headers: corsHeaders });
        }

        sharedObjects = (sharedRows || []).flatMap((row) => sanitizeDrawings(row.objects)
            .filter((drawing) => asObject(drawing.ownership).visibility === "class")
            .map((drawing) => markSharedDrawing(drawing, row.user_id, requestedClassId)));
    }

    return NextResponse.json({
        ok: true,
        symbol,
        timeframe,
        objects: [...ownObjects, ...sharedObjects],
        updatedAt: ownRow?.updated_at ?? null,
    }, { headers: corsHeaders });
}

export async function PUT(request: Request) {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    const symbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
    const timeframe = typeof body?.timeframe === "string" ? body.timeframe.trim() : "";
    const classId = typeof body?.classId === "string" ? body.classId.trim() : "";

    if (!symbol || !timeframe) {
        return NextResponse.json({ ok: false, error: "symbol and timeframe are required" }, { status: 400, headers: corsHeaders });
    }

    // Ownership is established by the authenticated request, never by a profile
    // identifier supplied by the browser. Shared read-only objects are excluded so
    // students cannot accidentally persist a teacher's drawing as their own.
    const sanitized = sanitizeDrawings(body?.objects)
        .filter((drawing) => !toBoolean(asObject(drawing.education).readOnly));
    const wantsClassSharing = Boolean(classId && sanitized.some(
        (drawing) => asObject(drawing.ownership).visibility === "class"
    ));
    const canShare = wantsClassSharing ? await canManageRoom(auth.user.id, classId) : false;

    if (wantsClassSharing && !canShare) {
        return NextResponse.json({ ok: false, error: "Only an active teacher or monitor can share drawings with this class" }, { status: 403, headers: corsHeaders });
    }

    const objects = sanitized.map((drawing) => {
        const shared = canShare && asObject(drawing.ownership).visibility === "class";
        return {
            ...markOwnedDrawing(drawing, auth.user.id),
            ownership: {
                ownerId: auth.user.id,
                visibility: shared ? "class" : "private",
                classId: shared ? classId : null,
            },
        };
    });
    const hasSharedObjects = objects.some((drawing) => asObject(drawing.ownership).visibility === "class");
    const payload = {
        user_id: auth.user.id,
        symbol,
        timeframe,
        objects,
        class_id: hasSharedObjects ? classId : null,
        visibility: hasSharedObjects ? "class" : "private",
    };

    let { error } = await supabaseAdmin.from("chart_drawings").upsert(payload, {
        onConflict: "user_id,symbol,timeframe",
    });

    if (isSchemaCompatibilityError(error) && !hasSharedObjects) {
        ({ error } = await supabaseAdmin.from("chart_drawings").upsert({
            user_id: auth.user.id,
            symbol,
            timeframe,
            objects,
        }, { onConflict: "user_id,symbol,timeframe" }));
    }

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ ok: true, symbol, timeframe, objects }, { headers: corsHeaders });
}

export async function DELETE(request: Request) {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim() ?? "";
    const timeframe = searchParams.get("timeframe")?.trim() ?? "";

    if (!symbol || !timeframe) {
        return NextResponse.json({ ok: false, error: "symbol and timeframe are required" }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabaseAdmin
        .from("chart_drawings")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("symbol", symbol)
        .eq("timeframe", timeframe);

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ ok: true, symbol, timeframe }, { headers: corsHeaders });
}
