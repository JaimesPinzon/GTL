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

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
};

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const roomId = normalizeText(body?.roomId);
  const includeExistingMembers = Boolean(body?.includeExistingMembers);

  if (!roomId) {
    return NextResponse.json({ ok: false, error: "Missing room id." }, { status: 400, headers: roomsCorsHeaders });
  }

  const isStaff = await canManageRoom(auth.user.id, roomId);
  if (!isStaff) {
    return NextResponse.json(
      { ok: false, error: "Only teacher/monitor can auto-assign groups." },
      { status: 403, headers: roomsCorsHeaders }
    );
  }

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from("room_groups")
    .select("id, room_id, max_members, state")
    .eq("room_id", roomId)
    .eq("state", "active")
    .order("created_at", { ascending: true });

  if (groupsError) {
    return NextResponse.json({ ok: false, error: groupsError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  if (!groups || groups.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No active groups were found for this room." },
      { status: 400, headers: roomsCorsHeaders }
    );
  }

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("role_in_room", "student")
    .eq("state", "active");

  if (studentsError) {
    return NextResponse.json({ ok: false, error: studentsError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  const { data: existingGroupMembers, error: existingMembersError } = await supabaseAdmin
    .from("room_group_members")
    .select("group_id, user_id, state")
    .eq("room_id", roomId)
    .eq("state", "active");

  if (existingMembersError) {
    return NextResponse.json({ ok: false, error: existingMembersError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  const activeStudents = (students || []).map((entry) => entry.user_id);
  const existingAssignedSet = new Set((existingGroupMembers || []).map((entry) => entry.user_id));
  const candidateStudentIds = includeExistingMembers
    ? activeStudents
    : activeStudents.filter((userId) => !existingAssignedSet.has(userId));

  if (candidateStudentIds.length === 0) {
    return NextResponse.json(
      { ok: true, assignedCount: 0, message: "No students available for assignment." },
      { headers: roomsCorsHeaders }
    );
  }

  const groupActiveCounts = new Map<string, number>();
  (existingGroupMembers || []).forEach((member) => {
    groupActiveCounts.set(member.group_id, (groupActiveCounts.get(member.group_id) || 0) + 1);
  });

  const shuffledStudents = shuffle(candidateStudentIds);
  const assignments: { group_id: string; room_id: string; user_id: string; role: "member"; state: "active" }[] = [];

  for (const userId of shuffledStudents) {
    const candidateGroups = groups
      .map((group) => ({
        id: group.id,
        maxMembers: group.max_members as number | null,
        activeCount: groupActiveCounts.get(group.id) || 0,
      }))
      .filter((group) => group.maxMembers == null || group.activeCount < group.maxMembers)
      .sort((left, right) => left.activeCount - right.activeCount);

    const target = candidateGroups[0];
    if (!target) {
      break;
    }

    assignments.push({
      group_id: target.id,
      room_id: roomId,
      user_id: userId,
      role: "member",
      state: "active",
    });
    groupActiveCounts.set(target.id, target.activeCount + 1);
  }

  if (assignments.length === 0) {
    return NextResponse.json(
      { ok: true, assignedCount: 0, message: "All groups reached their max capacity." },
      { headers: roomsCorsHeaders }
    );
  }

  const { data: upsertedMembers, error: upsertError } = await supabaseAdmin
    .from("room_group_members")
    .upsert(assignments, { onConflict: "group_id,user_id" })
    .select("id, group_id, room_id, user_id, role, state, joined_at");

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500, headers: roomsCorsHeaders });
  }

  return NextResponse.json(
    {
      ok: true,
      assignedCount: upsertedMembers?.length || 0,
      members: upsertedMembers || [],
    },
    { headers: roomsCorsHeaders }
  );
}
