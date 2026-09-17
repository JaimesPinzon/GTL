import { NextResponse } from "next/server";

import { canAccessRoom, canManageRoom, normalizeText, requireUser, roomsCorsHeaders } from "@/app/api/rooms/_shared";
import { getLastCandleMarketBySymbols } from "@/app/utils/market/last-candle-market";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import {
  buildPortfolioRanking,
  PORTFOLIO_RANKING_METRICS,
  PORTFOLIO_RANKING_PERIODS,
  type PortfolioRankingMetric,
  type PortfolioRankingPeriod,
} from "@/modules/portfolio-ranking/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: roomsCorsHeaders });
}

const errorResponse = (error: string, status = 500) => NextResponse.json(
  { ok: false, error },
  { status, headers: roomsCorsHeaders },
);

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const roomId = normalizeText(searchParams.get("roomId"));
  const requestedMetric = normalizeText(searchParams.get("metric")) || "return_pct";
  const requestedPeriod = normalizeText(searchParams.get("period")) || "class";
  const requestedGroupId = normalizeText(searchParams.get("groupId")) || "all";

  if (!roomId) return errorResponse("Missing room id.", 400);
  if (!PORTFOLIO_RANKING_METRICS.includes(requestedMetric as PortfolioRankingMetric)) {
    return errorResponse("Unsupported ranking metric.", 400);
  }
  if (!PORTFOLIO_RANKING_PERIODS.includes(requestedPeriod as PortfolioRankingPeriod)) {
    return errorResponse("Unsupported ranking period.", 400);
  }
  if (!(await canAccessRoom(auth.user.id, roomId))) return errorResponse("Forbidden", 403);

  const [roomResult, membersResult, groupsResult, groupMembersResult, positionsResult, transactionsResult] = await Promise.all([
    supabaseAdmin
      .from("rooms")
      .select("id, default_balance, default_currency")
      .eq("id", roomId)
      .maybeSingle(),
    supabaseAdmin
      .from("room_members")
      .select("user_id, individual_available_balance, profile:profiles!room_members_user_id_fkey(user_id,email,name,alias,last_name)")
      .eq("room_id", roomId)
      .eq("role_in_room", "student")
      .eq("state", "active"),
    supabaseAdmin
      .from("room_groups")
      .select("id, name")
      .eq("room_id", roomId)
      .eq("state", "active")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("room_group_members")
      .select("user_id, group_id, group_available_balance")
      .eq("room_id", roomId)
      .eq("state", "active"),
    supabaseAdmin
      .from("positions")
      .select("id, user_id, group_id, symbol, type, amount, entry_price")
      .eq("room_id", roomId),
    supabaseAdmin
      .from("transactions")
      .select("id, user_id, group_id, date")
      .eq("room_id", roomId),
  ]);

  const firstError = [roomResult, membersResult, groupsResult, groupMembersResult, positionsResult, transactionsResult]
    .find((result) => result.error)?.error;
  if (firstError) return errorResponse(firstError.message);
  if (!roomResult.data) return errorResponse("Room not found.", 404);

  const groups = groupsResult.data || [];
  if (requestedGroupId !== "all" && !groups.some((group) => group.id === requestedGroupId)) {
    return errorResponse("Group not found in this room.", 404);
  }

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  const groupMemberCount = new Map<string, number>();
  const groupByUserId = new Map<string, { group_id: string; group_available_balance: number | string | null }>();
  (groupMembersResult.data || []).forEach((membership) => {
    groupByUserId.set(membership.user_id, membership);
    groupMemberCount.set(membership.group_id, (groupMemberCount.get(membership.group_id) || 0) + 1);
  });

  const members = (membersResult.data || []).flatMap((member) => {
    const membership = groupByUserId.get(member.user_id) || null;
    if (requestedGroupId !== "all" && membership?.group_id !== requestedGroupId) return [];
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
    const displayName = [profile?.name, profile?.last_name].filter(Boolean).join(" ").trim()
      || profile?.alias
      || profile?.email
      || "Estudiante";
    return [{
      userId: member.user_id,
      displayName,
      email: profile?.email || "",
      avatarUrl: null,
      availableBalance: Number(member.individual_available_balance ?? 0),
      groupId: membership?.group_id || null,
      groupName: membership?.group_id ? groupNameById.get(membership.group_id) || null : null,
      groupAvailableBalance: membership ? Number(membership.group_available_balance ?? 0) : null,
      groupMemberCount: membership ? groupMemberCount.get(membership.group_id) || 1 : 1,
    }];
  });

  const positions = (positionsResult.data || []).map((position) => ({
    id: position.id,
    userId: position.user_id,
    groupId: position.group_id || null,
    symbol: String(position.symbol || "").toUpperCase(),
    type: position.type,
    amount: Number(position.amount ?? 0),
    entryPrice: Number(position.entry_price ?? 0),
  }));
  const transactions = (transactionsResult.data || []).map((transaction) => ({
    id: transaction.id,
    userId: transaction.user_id,
    groupId: transaction.group_id || null,
    date: transaction.date,
  }));
  const symbols = [...new Set(positions.map((position) => position.symbol).filter(Boolean))];
  let latestPrices = new Map<string, number>();
  try {
    const snapshots = await getLastCandleMarketBySymbols(symbols);
    latestPrices = new Map(symbols.flatMap((symbol) => {
      const price = Number(snapshots.get(symbol)?.price);
      return Number.isFinite(price) && price > 0 ? [[symbol, price] as [string, number]] : [];
    }));
  } catch (error) {
    console.warn("portfolio ranking quote lookup unavailable; using entry prices", error);
  }

  const metric = requestedMetric as PortfolioRankingMetric;
  const period = requestedPeriod as PortfolioRankingPeriod;
  const ranking = buildPortfolioRanking({
    members,
    positions,
    transactions,
    pricesBySymbol: latestPrices,
    defaultInitialBalance: Number(roomResult.data.default_balance ?? 0),
    metric,
    period,
  });
  const isStaff = await canManageRoom(auth.user.id, roomId);
  const response = NextResponse.json({
    ok: true,
    classId: roomId,
    metric,
    period,
    groupId: requestedGroupId,
    currency: roomResult.data.default_currency || "USD",
    generatedAt: new Date().toISOString(),
    isStaff,
    groups: groups.map((group) => ({ id: group.id, name: group.name })),
    topThree: ranking.slice(0, 3),
    rows: ranking.slice(3),
  }, { headers: roomsCorsHeaders });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
