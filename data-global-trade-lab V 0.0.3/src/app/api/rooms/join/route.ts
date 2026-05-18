import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

function normalizeRoomCode(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.toUpperCase().replace(/[\s-]+/g, "").trim();
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
  const accessCode = normalizeRoomCode(body?.accessCode);

  if (!accessCode) {
    return NextResponse.json(
      { ok: false, error: "Debes ingresar un codigo de sala." },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("access_code", accessCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roomError) {
    return NextResponse.json({ ok: false, error: roomError.message }, { status: 500, headers: corsHeaders });
  }

  if (!room) {
    return NextResponse.json(
      { ok: false, error: "No se encontro una sala con ese codigo." },
      { status: 404, headers: corsHeaders }
    );
  }

  if (room.state !== "active") {
    return NextResponse.json(
      { ok: false, error: "La sala existe, pero no esta activa para nuevos ingresos." },
      { status: 409, headers: corsHeaders }
    );
  }

  const { data: existingMembership, error: existingMembershipError } = await supabaseAdmin
    .from("room_members")
    .select("role_in_room")
    .eq("room_id", room.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingMembershipError) {
    return NextResponse.json(
      { ok: false, error: existingMembershipError.message },
      { status: 500, headers: corsHeaders }
    );
  }

  const nextRoleInRoom =
    existingMembership?.role_in_room === "teacher" || existingMembership?.role_in_room === "monitor"
      ? existingMembership.role_in_room
      : "student";

  const roomDefaultBalance = Number.isFinite(Number(room.default_balance)) ? Number(room.default_balance) : 0;
  const roomDefaultCurrency =
    typeof room.default_currency === "string" && room.default_currency.trim()
      ? room.default_currency.trim().toUpperCase()
      : "USD";

  const memberMutation = existingMembership
    ? supabaseAdmin
        .from("room_members")
        .update({
          role_in_room: nextRoleInRoom,
          state: "active",
        })
        .eq("room_id", room.id)
        .eq("user_id", auth.user.id)
    : supabaseAdmin.from("room_members").insert({
        room_id: room.id,
        user_id: auth.user.id,
        role_in_room: nextRoleInRoom,
        state: "active",
        individual_available_balance: roomDefaultBalance,
        individual_blocked_balance: 0,
        individual_total_balance: roomDefaultBalance,
        individual_currency: roomDefaultCurrency,
        individual_realized_pnl: 0,
        individual_unrealized_pnl: 0,
        individual_equity: roomDefaultBalance,
      });

  const { error: memberError } = await memberMutation;

  if (memberError) {
    return NextResponse.json({ ok: false, error: memberError.message }, { status: 500, headers: corsHeaders });
  }

  const { data: existingAccount, error: existingAccountError } = await supabaseAdmin
    .from("student_sim_accounts")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingAccountError) {
    return NextResponse.json(
      { ok: false, error: existingAccountError.message },
      { status: 500, headers: corsHeaders }
    );
  }

  const accountMutation = existingAccount
    ? supabaseAdmin
        .from("student_sim_accounts")
        .update({
          state: "active",
        })
        .eq("room_id", room.id)
        .eq("user_id", auth.user.id)
    : supabaseAdmin.from("student_sim_accounts").insert({
        room_id: room.id,
        user_id: auth.user.id,
        available_balance: roomDefaultBalance,
        blocked_balance: 0,
        total_balance: roomDefaultBalance,
        currency: roomDefaultCurrency,
        state: "active",
      });

  const { error: accountError } = await accountMutation;

  if (accountError) {
    return NextResponse.json({ ok: false, error: accountError.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json(
    {
      ok: true,
      room: mapRoomRecord(room as RoomRecord),
    },
    { headers: corsHeaders }
  );
}
