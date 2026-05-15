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

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const roomId = normalizeText(searchParams.get("roomId"));

  if (!roomId) {
    return NextResponse.json({ ok: false, error: "Missing room id." }, { status: 400, headers: roomsCorsHeaders });
  }

  const isStaff = await canManageRoom(auth.user.id, roomId);

  const groupsQuery = supabaseAdmin
    .from("room_groups")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (!isStaff) {
    groupsQuery.eq("state", "active");
  }

  const { data: groups, error: groupsError } = await groupsQuery;
  if (groupsError) {
    return NextResponse.json({ ok: false, error: groupsError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  const groupIds = (groups || []).map((group) => group.id);
  let membersByGroupId: Record<string, unknown[]> = {};

  if (groupIds.length > 0) {
    const membersQuery = supabaseAdmin
      .from("room_group_members")
      .select("*, profile:profiles!room_group_members_user_id_fkey(user_id,name,last_name,alias,email)")
      .in("group_id", groupIds)
      .order("joined_at", { ascending: true });

    if (!isStaff) {
      membersQuery.eq("state", "active");
    }

    const { data: members, error: membersError } = await membersQuery;
    if (membersError) {
      return NextResponse.json({ ok: false, error: membersError.message }, { status: 500, headers: roomsCorsHeaders });
    }

    membersByGroupId = (members || []).reduce((accumulator, member) => {
      const key = member.group_id;
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(member);
      return accumulator;
    }, {} as Record<string, unknown[]>);
  }

  const payload = (groups || []).map((group) => ({
    ...group,
    members: membersByGroupId[group.id] || [],
    activeMembersCount: ((membersByGroupId[group.id] || []) as { state?: string }[]).filter(
      (member) => String(member.state || "").toLowerCase() === "active"
    ).length,
  }));

  return NextResponse.json(
    {
      ok: true,
      roomId,
      isStaff,
      groups: payload,
    },
    { headers: roomsCorsHeaders }
  );
}
