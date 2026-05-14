import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  try {
    const user = await getAuthenticatedUser(accessToken);
    return { user };
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders }) };
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const VALID_ROOM_STATES = new Set(["active", "closed", "archived"]);

function normalizeRoomState(value: unknown) {
  const normalizedValue = String(value || "active").trim().toLowerCase();

  if (normalizedValue === "inactive") {
    return "closed";
  }

  if (normalizedValue === "deleted") {
    return "archived";
  }

  return normalizedValue;
}

type RoomRecord = {
  id: string;
  name: string;
  access_code: string;
  description: string | null;
  state: string;
  start_date: string | null;
  end_date: string | null;
  default_currency: string | null;
  default_balance: number | string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapRoomRecord(room: RoomRecord) {
  return {
    id: room.id,
    name: room.name,
    accessCode: room.access_code,
    description: room.description || "",
    state: room.state,
    startDate: room.start_date || null,
    endDate: room.end_date || null,
    defaultCurrency: room.default_currency || "USD",
    defaultBalance: Number(room.default_balance ?? 0),
    createdBy: room.created_by,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const roomId = normalizeText(body?.roomId);
  if (!roomId) {
    return NextResponse.json({ ok: false, error: "Missing room id." }, { status: 400, headers: corsHeaders });
  }
  const name = body?.name === undefined ? null : normalizeText(body?.name);
  if (body?.name !== undefined && !name) {
    return NextResponse.json({ ok: false, error: "Room name is required." }, { status: 400, headers: corsHeaders });
  }

  const normalizedState = normalizeRoomState(body?.state);
  if (!VALID_ROOM_STATES.has(normalizedState)) {
    return NextResponse.json({ ok: false, error: "Invalid room state." }, { status: 400, headers: corsHeaders });
  }

  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("id, created_by")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) {
    return NextResponse.json({ ok: false, error: roomError.message }, { status: 500, headers: corsHeaders });
  }

  if (!room) {
    return NextResponse.json({ ok: false, error: "Room not found." }, { status: 404, headers: corsHeaders });
  }

  let canManage = room.created_by === auth.user.id;
  if (!canManage) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("room_members")
      .select("role_in_room, state")
      .eq("room_id", roomId)
      .eq("user_id", auth.user.id)
      .eq("state", "active")
      .in("role_in_room", ["teacher", "monitor"])
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500, headers: corsHeaders });
    }

    canManage = Boolean(membership);
  }

  if (!canManage) {
    return NextResponse.json(
      { ok: false, error: "You do not have permissions to update this room." },
      { status: 403, headers: corsHeaders }
    );
  }

  const payload: Record<string, unknown> = {
    state: normalizedState,
    updated_at: new Date().toISOString(),
  };

  if (name !== null) {
    payload.name = name;
  }

  if (body?.description !== undefined) {
    payload.description = normalizeText(body?.description);
  }

  if (body?.defaultBalance !== undefined) {
    const parsedBalance = Number(body.defaultBalance);
    if (!Number.isFinite(parsedBalance) || parsedBalance <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid default balance." },
        { status: 400, headers: corsHeaders }
      );
    }
    payload.default_balance = parsedBalance;
  }

  if (body?.defaultCurrency !== undefined) {
    const normalizedCurrency = normalizeText(body.defaultCurrency).toUpperCase();
    if (!normalizedCurrency) {
      return NextResponse.json(
        { ok: false, error: "Invalid default currency." },
        { status: 400, headers: corsHeaders }
      );
    }
    payload.default_currency = normalizedCurrency;
  }

  if (body?.startDate !== undefined) {
    payload.start_date = normalizeText(body.startDate) || null;
  }

  if (body?.endDate !== undefined) {
    payload.end_date = normalizeText(body.endDate) || null;
  }

  const { data: updatedRoom, error: updateError } = await supabaseAdmin
    .from("rooms")
    .update(payload)
    .eq("id", roomId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500, headers: corsHeaders });
  }

  if (!updatedRoom) {
    return NextResponse.json(
      { ok: false, error: "Room update returned no data." },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ ok: true, room: mapRoomRecord(updatedRoom as RoomRecord) }, { headers: corsHeaders });
}
