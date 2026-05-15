import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { getAuthenticatedUser } from "@/modules/auth";

export const roomsCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function requireUser(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: roomsCorsHeaders }),
    };
  }

  try {
    const user = await getAuthenticatedUser(accessToken);
    return { user };
  } catch {
    return {
      error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: roomsCorsHeaders }),
    };
  }
}

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function canManageRoom(userId: string, roomId: string) {
  const normalizedRoomId = normalizeText(roomId);
  if (!userId || !normalizedRoomId) {
    return false;
  }

  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("id, created_by")
    .eq("id", normalizedRoomId)
    .maybeSingle();

  if (roomError || !room) {
    return false;
  }

  if (room.created_by === userId) {
    return true;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("room_members")
    .select("id")
    .eq("room_id", normalizedRoomId)
    .eq("user_id", userId)
    .in("role_in_room", ["teacher", "monitor"])
    .eq("state", "active")
    .maybeSingle();

  if (membershipError) {
    return false;
  }

  return Boolean(membership);
}
