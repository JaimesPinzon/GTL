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

  if (!roomId || !groupId) {
    return NextResponse.json(
      { ok: false, error: "roomId and groupId are required." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  const isStaff = await canManageRoom(auth.user.id, roomId);
  if (!isStaff) {
    return NextResponse.json(
      { ok: false, error: "Only teacher/monitor can update groups in this room." },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body?.name !== undefined) {
    const name = normalizeText(body.name);
    if (!name) {
      return NextResponse.json({ ok: false, error: "Group name cannot be empty." }, { status: 400, headers: roomsCorsHeaders });
    }
    updates.name = name;
  }

  if (body?.description !== undefined) {
    updates.description = normalizeText(body.description);
  }

  if (body?.state !== undefined) {
    const state = normalizeText(body.state).toLowerCase();
    if (!["active", "archived", "deleted"].includes(state)) {
      return NextResponse.json({ ok: false, error: "Invalid group state." }, { status: 400, headers: roomsCorsHeaders });
    }
    updates.state = state;
  }

  if (body?.maxMembers !== undefined) {
    if (body.maxMembers === null || body.maxMembers === "") {
      updates.max_members = null;
    } else {
      const parsed = Number.parseInt(String(body.maxMembers), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { ok: false, error: "maxMembers must be a positive integer." },
          { status: 400, headers: roomsCorsHeaders }
        );
      }
      updates.max_members = parsed;
    }
  }

  const { data: updatedGroup, error: updateError } = await supabaseAdmin
    .from("room_groups")
    .update(updates)
    .eq("id", groupId)
    .eq("room_id", roomId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  if (!updatedGroup) {
    return NextResponse.json({ ok: false, error: "Group not found." }, { status: 404, headers: roomsCorsHeaders });
  }

  return NextResponse.json({ ok: true, group: updatedGroup }, { headers: roomsCorsHeaders });
}
