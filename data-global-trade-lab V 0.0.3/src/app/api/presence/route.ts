import { NextResponse } from "next/server";

import { canAccessRoom, normalizeText, requireUser, roomsCorsHeaders } from "@/app/api/rooms/_shared";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: roomsCorsHeaders });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const activeRoomId = normalizeText(body?.activeRoomId) || null;

  if (activeRoomId && !(await canAccessRoom(auth.user.id, activeRoomId))) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("user_presence").upsert(
    {
      user_id: auth.user.id,
      active_room_id: activeRoomId,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: roomsCorsHeaders }
    );
  }

  return NextResponse.json({ ok: true, lastSeenAt: now }, { headers: roomsCorsHeaders });
}
