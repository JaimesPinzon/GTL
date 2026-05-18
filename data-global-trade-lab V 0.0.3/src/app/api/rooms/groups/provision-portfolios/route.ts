import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { canManageRoom, normalizeText, requireUser, roomsCorsHeaders } from "@/app/api/rooms/_shared";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: roomsCorsHeaders,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const roomId = normalizeText(body?.roomId);
  const replaceExisting = Boolean(body?.replaceExisting);

  if (!roomId) {
    return NextResponse.json({ ok: false, error: "Missing room id." }, { status: 400, headers: roomsCorsHeaders });
  }

  const isStaff = await canManageRoom(auth.user.id, roomId);
  if (!isStaff) {
    return NextResponse.json(
      { ok: false, error: "Only teacher/monitor can provision group portfolios." },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("id, default_balance, default_currency")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) {
    return NextResponse.json({ ok: false, error: roomError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  if (!room) {
    return NextResponse.json({ ok: false, error: "Room not found." }, { status: 404, headers: roomsCorsHeaders });
  }

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from("room_groups")
    .select("id")
    .eq("room_id", roomId)
    .eq("state", "active");

  if (groupsError) {
    return NextResponse.json({ ok: false, error: groupsError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  if (!groups || groups.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No active groups found in this room." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  const defaultBalance = Number(room.default_balance ?? 0);
  const currency = String(room.default_currency || "USD");
  const baseUpdatePayload = {
    group_available_balance: defaultBalance,
    group_blocked_balance: 0,
    group_total_balance: defaultBalance,
    group_currency: currency,
    group_realized_pnl: 0,
    group_unrealized_pnl: 0,
    group_equity: defaultBalance,
  };

  let updateQuery = supabaseAdmin
    .from("room_group_members")
    .update(baseUpdatePayload)
    .eq("room_id", roomId)
    .in("group_id", groups.map((group) => group.id))
    .eq("state", "active");

  if (!replaceExisting) {
    updateQuery = updateQuery.lte("group_total_balance", 0);
  }

  const { data: memberships, error: updateError } = await updateQuery.select("id, room_id, group_id, user_id");

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  const provisionedGroupIds = [...new Set((memberships || []).map((membership) => membership.group_id))];

  return NextResponse.json(
    {
      ok: true,
      roomId,
      provisionedCount: memberships?.length || 0,
      provisionedGroups: provisionedGroupIds.length,
      memberships: memberships || [],
    },
    { headers: roomsCorsHeaders }
  );
}
