import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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

type RoomRecord = {
  id: string;
  name: string;
  access_code: string;
  description: string | null;
  state: string;
  start_date: string | null;
  end_date: string | null;
  default_currency: string | null;
  default_balance: number | string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapRoomRecord(room: RoomRecord) {
  return {
    id: room.id,
    name: room.name,
    accessCode: room.access_code,
    description: room.description || "",
    state: room.state,
    startDate: room.start_date || null,
    endDate: room.end_date || null,
    defaultCurrency: room.default_currency || "USD",
    defaultBalance: Number(room.default_balance ?? 0),
    createdBy: room.created_by,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim() || "student";

  if (role === "teacher") {
    const [ownedRoomsResult, membershipsResult] = await Promise.all([
      supabaseAdmin
        .from("rooms")
        .select("*")
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("room_members")
        .select("role_in_room, state, joined_at, room:rooms(*)")
        .eq("user_id", auth.user.id)
        .in("role_in_room", ["teacher", "monitor"])
        .eq("state", "active")
        .order("joined_at", { ascending: false }),
    ]);

    if (ownedRoomsResult.error) {
      return NextResponse.json({ ok: false, error: ownedRoomsResult.error.message }, { status: 500, headers: corsHeaders });
    }

    if (membershipsResult.error) {
      return NextResponse.json({ ok: false, error: membershipsResult.error.message }, { status: 500, headers: corsHeaders });
    }

    const ownedRooms = (ownedRoomsResult.data || []).map((room) => ({
      membershipRole: "teacher",
      membershipState: "active",
      joinedAt: room.created_at || null,
      ...mapRoomRecord(room as unknown as RoomRecord),
    }));

    const membershipRooms = (membershipsResult.data || [])
      .filter((entry) => entry.room)
      .map((entry) => ({
        membershipRole: entry.role_in_room,
        membershipState: entry.state,
        joinedAt: entry.joined_at || null,
        ...mapRoomRecord(entry.room as unknown as RoomRecord),
      }));

    const rooms = [...ownedRooms, ...membershipRooms].filter(
      (room, index, collection) => collection.findIndex((entry) => entry.id === room.id) === index
    );

    return NextResponse.json({ ok: true, rooms }, { headers: corsHeaders });
  }

  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select("role_in_room, state, joined_at, room:rooms(*)")
    .eq("user_id", auth.user.id)
    .eq("role_in_room", "student")
    .eq("state", "active")
    .order("joined_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders });
  }

  const rooms = (data || [])
    .filter((entry) => entry.room)
    .map((entry) => ({
      membershipRole: entry.role_in_room,
      membershipState: entry.state,
      joinedAt: entry.joined_at || null,
      ...mapRoomRecord(entry.room as unknown as RoomRecord),
    }));

  return NextResponse.json({ ok: true, rooms }, { headers: corsHeaders });
}
