import { NextResponse } from "next/server";

import { canAccessRoom, normalizeText, requireUser, roomsCorsHeaders } from "@/app/api/rooms/_shared";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: roomsCorsHeaders,
  });
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const roomId = normalizeText(searchParams.get("roomId"));
  if (!roomId) {
    return NextResponse.json(
      { ok: false, error: "Missing room id." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  if (!(await canAccessRoom(auth.user.id, roomId))) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select(
      "id, room_id, user_id, role_in_room, state, joined_at, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency, profile:profiles!room_members_user_id_fkey(user_id,email,name,alias,last_name)"
    )
    .eq("room_id", roomId)
    .eq("state", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: roomsCorsHeaders }
    );
  }

  const members = (data || []).map((entry) => {
    const profile = Array.isArray(entry.profile) ? entry.profile[0] : entry.profile;
    return {
      id: entry.id,
      roomId: entry.room_id,
      userId: entry.user_id,
      roleInRoom: entry.role_in_room,
      state: entry.state,
      joinedAt: entry.joined_at,
      individualAvailableBalance: Number(entry.individual_available_balance ?? 0),
      individualBlockedBalance: Number(entry.individual_blocked_balance ?? 0),
      individualTotalBalance: Number(entry.individual_total_balance ?? 0),
      individualCurrency: entry.individual_currency || "USD",
      profile: profile
        ? {
            id: profile.user_id,
            email: profile.email || "",
            name: profile.name || "",
            alias: profile.alias || "",
            lastName: profile.last_name || "",
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, roomId, members }, { headers: roomsCorsHeaders });
}
