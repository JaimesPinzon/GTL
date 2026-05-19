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

function normalizeRoomId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
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
  const roomId = normalizeRoomId(body?.roomId);

  if (!roomId) {
    return NextResponse.json(
      { ok: false, error: "Missing room id." },
      { status: 400, headers: corsHeaders }
    );
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

  if (room.created_by === auth.user.id) {
    return NextResponse.json(
      { ok: false, error: "Room owner cannot leave their own room." },
      { status: 409, headers: corsHeaders }
    );
  }

  const { error: roomGroupMembershipError } = await supabaseAdmin
    .from("room_group_members")
    .update({
      state: "removed",
    })
    .eq("room_id", roomId)
    .eq("user_id", auth.user.id)
    .eq("state", "active");

  if (roomGroupMembershipError) {
    return NextResponse.json(
      { ok: false, error: roomGroupMembershipError.message },
      { status: 500, headers: corsHeaders }
    );
  }

  const { data: updatedMemberships, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .update({
      state: "removed",
    })
    .eq("room_id", roomId)
    .eq("user_id", auth.user.id)
    .eq("state", "active")
    .select("id");

  if (membershipError) {
    return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500, headers: corsHeaders });
  }

  if (!updatedMemberships || updatedMemberships.length === 0) {
    const { data: membershipState, error: membershipStateError } = await supabaseAdmin
      .from("room_members")
      .select("state")
      .eq("room_id", roomId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (membershipStateError) {
      return NextResponse.json(
        { ok: false, error: membershipStateError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!membershipState || membershipState.state === "removed") {
      return NextResponse.json({ ok: true, roomId, alreadyLeft: true }, { headers: corsHeaders });
    }
  }

  return NextResponse.json({ ok: true, roomId }, { headers: corsHeaders });
}

