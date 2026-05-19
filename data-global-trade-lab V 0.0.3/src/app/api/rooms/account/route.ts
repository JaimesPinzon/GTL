import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type RoomGroupStateRow = {
  state?: string | null;
};

type RoomGroupMembershipRow = {
  id: string;
  room_id: string;
  group_id: string;
  user_id: string;
  state: string | null;
  group_available_balance: number | string | null;
  group_blocked_balance: number | string | null;
  group_total_balance: number | string | null;
  group_currency: string | null;
  group: RoomGroupStateRow | null;
};

type RoomMemberRow = {
  id: string;
  room_id: string;
  user_id: string;
  state: string | null;
  joined_at: string | null;
  individual_available_balance: number | string | null;
  individual_blocked_balance: number | string | null;
  individual_total_balance: number | string | null;
  individual_currency: string | null;
};

const toMoney = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const roomId = String(searchParams.get("roomId") || "").trim();

  if (!roomId) {
    return NextResponse.json({ ok: false, error: "roomId is required." }, { status: 400, headers: corsHeaders });
  }

  const [{ data: roomMember, error: roomMemberError }, { data: groupMembership, error: groupMembershipError }] =
    await Promise.all([
      supabaseAdmin
        .from("room_members")
        .select(
          "id, room_id, user_id, state, joined_at, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency"
        )
        .eq("room_id", roomId)
        .eq("user_id", auth.user.id)
        .eq("state", "active")
        .maybeSingle<RoomMemberRow>(),
      supabaseAdmin
        .from("room_group_members")
        .select(
          "id, room_id, group_id, user_id, state, group_available_balance, group_blocked_balance, group_total_balance, group_currency, group:room_groups(state)"
        )
        .eq("room_id", roomId)
        .eq("user_id", auth.user.id)
        .eq("state", "active")
        .maybeSingle<RoomGroupMembershipRow>(),
    ]);

  if (roomMemberError) {
    return NextResponse.json({ ok: false, error: roomMemberError.message }, { status: 500, headers: corsHeaders });
  }

  if (groupMembershipError) {
    return NextResponse.json({ ok: false, error: groupMembershipError.message }, { status: 500, headers: corsHeaders });
  }

  if (!roomMember) {
    return NextResponse.json({ ok: true, account: null }, { headers: corsHeaders });
  }

  const individualAvailable = toMoney(roomMember.individual_available_balance, 0);
  const individualBlocked = toMoney(roomMember.individual_blocked_balance, 0);
  const individualTotal = toMoney(
    roomMember.individual_total_balance,
    individualAvailable + individualBlocked
  );
  const individualCurrency = roomMember.individual_currency || "USD";

  const groupState = String(groupMembership?.group?.state || "").toLowerCase();
  const isGroupActive = Boolean(groupMembership?.id) && (!groupState || groupState === "active");

  const groupAvailable = toMoney(groupMembership?.group_available_balance, 0);
  const groupBlocked = toMoney(groupMembership?.group_blocked_balance, 0);
  const groupTotal = toMoney(groupMembership?.group_total_balance, groupAvailable + groupBlocked);
  const groupCurrency = groupMembership?.group_currency || individualCurrency;

  const shouldUseGroup = isGroupActive && (groupAvailable > 0 || groupBlocked > 0 || groupTotal > 0);

  const account = shouldUseGroup
    ? {
        id: `rgm:${groupMembership!.id}`,
        roomId: groupMembership!.room_id,
        userId: groupMembership!.user_id,
        availableBalance: groupAvailable,
        blockedBalance: groupBlocked,
        totalBalance: groupTotal,
        currency: groupCurrency,
        state: groupMembership!.state || "active",
        ownerType: "group",
        ownerGroupId: groupMembership!.group_id,
        isShared: true,
      }
    : {
        id: `rm:${roomMember.id}`,
        roomId: roomMember.room_id,
        userId: roomMember.user_id,
        availableBalance: individualAvailable,
        blockedBalance: individualBlocked,
        totalBalance: individualTotal,
        currency: individualCurrency,
        state: roomMember.state || "active",
        ownerType: "user",
        ownerGroupId: null,
        isShared: false,
      };

  return NextResponse.json({ ok: true, account }, { headers: corsHeaders });
}
