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
  const groupId = normalizeText(body?.groupId);
  const userId = normalizeText(body?.userId);
  const role = normalizeText(body?.role || "member").toLowerCase();
  const state = normalizeText(body?.state || "active").toLowerCase();

  if (!roomId || !groupId || !userId) {
    return NextResponse.json(
      { ok: false, error: "roomId, groupId and userId are required." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  if (!["leader", "member"].includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid member role." }, { status: 400, headers: roomsCorsHeaders });
  }

  if (!["active", "removed"].includes(state)) {
    return NextResponse.json({ ok: false, error: "Invalid member state." }, { status: 400, headers: roomsCorsHeaders });
  }

  const isStaff = await canManageRoom(auth.user.id, roomId);
  if (!isStaff) {
    return NextResponse.json(
      { ok: false, error: "Only teacher/monitor can manage groups in this room." },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const { data: group, error: groupError } = await supabaseAdmin
    .from("room_groups")
    .select("id, room_id, state, max_members")
    .eq("id", groupId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ ok: false, error: groupError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  if (!group) {
    return NextResponse.json({ ok: false, error: "Group not found in this room." }, { status: 404, headers: roomsCorsHeaders });
  }

  if (String(group.state || "").toLowerCase() !== "active" && state === "active") {
    return NextResponse.json(
      { ok: false, error: "Cannot add active members to archived/deleted group." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  const { data: roomMember, error: roomMemberError } = await supabaseAdmin
    .from("room_members")
    .select("id, role_in_room, state")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("state", "active")
    .maybeSingle();

  if (roomMemberError) {
    return NextResponse.json({ ok: false, error: roomMemberError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  if (!roomMember || String(roomMember.role_in_room || "").toLowerCase() !== "student") {
    return NextResponse.json(
      { ok: false, error: "Only active students can be assigned to groups." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  if (state === "active" && group.max_members != null) {
    const { count, error: countError } = await supabaseAdmin
      .from("room_group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("state", "active");

    if (countError) {
      return NextResponse.json({ ok: false, error: countError.message }, { status: 500, headers: roomsCorsHeaders });
    }

    const { data: existingMember, error: existingError } = await supabaseAdmin
      .from("room_group_members")
      .select("id, state")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError.message }, { status: 500, headers: roomsCorsHeaders });
    }

    const existingIsActive = existingMember && String(existingMember.state || "").toLowerCase() === "active";
    if (!existingIsActive && Number(count || 0) >= Number(group.max_members)) {
      return NextResponse.json(
        { ok: false, error: "Group is already at max capacity." },
        { status: 409, headers: roomsCorsHeaders }
      );
    }
  }

  const { data: upsertedMember, error: upsertError } = await supabaseAdmin
    .from("room_group_members")
    .upsert(
      {
        group_id: groupId,
        room_id: roomId,
        user_id: userId,
        role,
        state,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "group_id,user_id" }
    )
    .select("*, profile:profiles!room_group_members_user_id_fkey(user_id,name,last_name,alias,email)")
    .maybeSingle();

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  return NextResponse.json({ ok: true, member: upsertedMember }, { headers: roomsCorsHeaders });
}
