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
  const name = normalizeText(body?.name);
  const description = normalizeText(body?.description);
  const state = normalizeText(body?.state || "active").toLowerCase();
  const maxMembersRaw = body?.maxMembers;
  const maxMembers =
    maxMembersRaw === null || maxMembersRaw === undefined || maxMembersRaw === ""
      ? null
      : Number.parseInt(String(maxMembersRaw), 10);

  if (!roomId) {
    return NextResponse.json({ ok: false, error: "Missing room id." }, { status: 400, headers: roomsCorsHeaders });
  }

  if (!name) {
    return NextResponse.json({ ok: false, error: "Group name is required." }, { status: 400, headers: roomsCorsHeaders });
  }

  if (!["active", "archived", "deleted"].includes(state)) {
    return NextResponse.json({ ok: false, error: "Invalid group state." }, { status: 400, headers: roomsCorsHeaders });
  }

  if (maxMembers !== null && (!Number.isFinite(maxMembers) || maxMembers <= 0)) {
    return NextResponse.json(
      { ok: false, error: "maxMembers must be a positive integer." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  const isStaff = await canManageRoom(auth.user.id, roomId);
  if (!isStaff) {
    return NextResponse.json(
      { ok: false, error: "Only teacher/monitor can create groups in this room." },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const { data: createdGroup, error: createError } = await supabaseAdmin
    .from("room_groups")
    .insert({
      room_id: roomId,
      name,
      description,
      max_members: maxMembers,
      state,
      created_by: auth.user.id,
    })
    .select("*")
    .maybeSingle();

  if (createError) {
    return NextResponse.json({ ok: false, error: createError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  return NextResponse.json({ ok: true, group: createdGroup }, { headers: roomsCorsHeaders });
}
