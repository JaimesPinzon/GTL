import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
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

async function deleteByRoomId(table: string, roomId: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq("room_id", roomId);
  return error;
}

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function DELETE(request: Request) {
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

  if (room.created_by !== auth.user.id) {
    return NextResponse.json(
      { ok: false, error: "Only the room owner can delete it." },
      { status: 403, headers: corsHeaders }
    );
  }

  const { data: activities, error: activitiesError } = await supabaseAdmin
    .from("activities")
    .select("id")
    .eq("room_id", roomId);

  if (activitiesError) {
    return NextResponse.json({ ok: false, error: activitiesError.message }, { status: 500, headers: corsHeaders });
  }

  const activityIds = (activities || []).map((activity) => activity.id);

  if (activityIds.length > 0) {
    const { error: gradesError } = await supabaseAdmin.from("activity_grades").delete().in("activity_id", activityIds);
    if (gradesError) {
      return NextResponse.json({ ok: false, error: gradesError.message }, { status: 500, headers: corsHeaders });
    }

    const { error: submissionsError } = await supabaseAdmin
      .from("activity_submissions")
      .delete()
      .in("activity_id", activityIds);
    if (submissionsError) {
      return NextResponse.json({ ok: false, error: submissionsError.message }, { status: 500, headers: corsHeaders });
    }

    const { error: postsError } = await supabaseAdmin.from("activity_posts").delete().in("activity_id", activityIds);
    if (postsError) {
      return NextResponse.json({ ok: false, error: postsError.message }, { status: 500, headers: corsHeaders });
    }

    const { error: activitiesDeleteError } = await supabaseAdmin.from("activities").delete().in("id", activityIds);
    if (activitiesDeleteError) {
      return NextResponse.json({ ok: false, error: activitiesDeleteError.message }, { status: 500, headers: corsHeaders });
    }
  }

  const roomScopedTables = ["balance_adjustments", "student_sim_accounts", "positions", "transactions", "room_members"];

  for (const table of roomScopedTables) {
    const tableDeleteError = await deleteByRoomId(table, roomId);
    if (tableDeleteError) {
      return NextResponse.json({ ok: false, error: tableDeleteError.message }, { status: 500, headers: corsHeaders });
    }
  }

  const { error: roomDeleteError } = await supabaseAdmin
    .from("rooms")
    .delete()
    .eq("id", roomId)
    .eq("created_by", auth.user.id);

  if (roomDeleteError) {
    return NextResponse.json({ ok: false, error: roomDeleteError.message }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ ok: true, roomId }, { headers: corsHeaders });
}
