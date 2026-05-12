import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function buildRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ownerUserId = typeof body?.ownerUserId === "string" ? body.ownerUserId.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const defaultBalance = Number.isFinite(Number(body?.defaultBalance)) ? Number(body.defaultBalance) : 100000;
  const defaultCurrency = typeof body?.defaultCurrency === "string" && body.defaultCurrency.trim()
    ? body.defaultCurrency.trim().toUpperCase()
    : "USD";

  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: "Missing owner user id" }, { status: 400, headers: corsHeaders });
  }

  if (!name) {
    return NextResponse.json({ ok: false, error: "Room name is required" }, { status: 400, headers: corsHeaders });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 400, headers: corsHeaders });
  }

  if (profile.role !== "teacher") {
    return NextResponse.json({ ok: false, error: "Only teachers can create rooms" }, { status: 403, headers: corsHeaders });
  }

  let lastError: { message?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accessCode = buildRoomCode();

    const { data: room, error: roomError } = await supabaseAdmin
      .from("rooms")
      .insert({
        name,
        description,
        access_code: accessCode,
        created_by: ownerUserId,
        default_balance: defaultBalance,
        default_currency: defaultCurrency,
      })
      .select("*")
      .single();

    if (roomError) {
      const isDuplicateCode =
        roomError.code === "23505" ||
        /access_code/i.test(roomError.message || "") ||
        /duplicate key/i.test(roomError.message || "");

      if (isDuplicateCode) {
        lastError = roomError;
        continue;
      }

      return NextResponse.json({ ok: false, error: roomError.message }, { status: 500, headers: corsHeaders });
    }

    const { error: memberError } = await supabaseAdmin.from("room_members").upsert(
      {
        room_id: room.id,
        user_id: ownerUserId,
        role_in_room: "teacher",
        state: "active",
      },
      { onConflict: "room_id,user_id" }
    );

    if (memberError) {
      return NextResponse.json({ ok: false, error: memberError.message }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(
      {
        ok: true,
        room: {
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
        },
      },
      { headers: corsHeaders }
    );
  }

  return NextResponse.json(
    { ok: false, error: lastError?.message || "Unable to generate a unique room code" },
    { status: 500, headers: corsHeaders }
  );
}
