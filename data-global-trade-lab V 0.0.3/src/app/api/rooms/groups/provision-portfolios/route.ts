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

  if (replaceExisting) {
    const { error: deleteError } = await supabaseAdmin
      .from("student_sim_accounts")
      .delete()
      .eq("room_id", roomId)
      .eq("owner_type", "group");

    if (deleteError) {
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500, headers: roomsCorsHeaders });
    }
  }

  const defaultBalance = Number(room.default_balance ?? 0);
  const currency = String(room.default_currency || "USD");

  const accountsPayload = groups.map((group) => ({
    room_id: roomId,
    owner_type: "group",
    owner_group_id: group.id,
    user_id: null,
    available_balance: defaultBalance,
    blocked_balance: 0,
    total_balance: defaultBalance,
    currency,
    state: "active",
  }));

  const { data: accounts, error: upsertError } = await supabaseAdmin
    .from("student_sim_accounts")
    .upsert(accountsPayload, { onConflict: "room_id,owner_group_id" })
    .select("*");

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  return NextResponse.json(
    {
      ok: true,
      roomId,
      provisionedCount: accounts?.length || 0,
      accounts: accounts || [],
    },
    { headers: roomsCorsHeaders }
  );
}
