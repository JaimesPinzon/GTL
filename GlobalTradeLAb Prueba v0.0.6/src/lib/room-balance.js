import { supabase } from "@/lib/supabase";
import { fetchWithAuth } from "@/lib/auth-api";

const UUID_V4_OR_VX_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toNumber = (value, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const pickFirstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalizeId = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const buildCandidateUserIds = (userId, userIds = []) => {
  const rawCandidates = Array.isArray(userIds) ? userIds : [];
  const mergedCandidates = [
    ...rawCandidates,
    userId,
  ];
  const seen = new Set();

  return mergedCandidates
    .map((candidate) => normalizeId(candidate))
    .filter((candidate) => {
      if (!candidate || seen.has(candidate)) {
        return false;
      }

      seen.add(candidate);
      return true;
    });
};

const isUuidLike = (value) => UUID_V4_OR_VX_REGEX.test(normalizeId(value));

const mapBackendRoomAccount = (account) => {
  if (!account) {
    return null;
  }

  return {
    id: account.id || null,
    roomId: account.roomId || account.room_id || null,
    userId: account.userId || account.user_id || null,
    availableBalance: toNumber(account.availableBalance ?? account.available_balance, 0),
    blockedBalance: toNumber(account.blockedBalance ?? account.blocked_balance, 0),
    totalBalance: toNumber(
      account.totalBalance ?? account.total_balance,
      toNumber(account.availableBalance ?? account.available_balance, 0) +
        toNumber(account.blockedBalance ?? account.blocked_balance, 0)
    ),
    currency: account.currency || "USD",
    state: account.state || "active",
    ownerType: account.ownerType || account.owner_type || "user",
    ownerGroupId: account.ownerGroupId || account.owner_group_id || null,
    isShared: Boolean(account.isShared ?? account.is_shared),
    createdAt: account.createdAt || account.created_at || null,
    updatedAt: account.updatedAt || account.updated_at || null,
  };
};

const fetchRoomAccountFromBackend = async ({ roomId }) => {
  if (!roomId) {
    return null;
  }

  try {
    const params = new URLSearchParams({ roomId });
    const payload = await fetchWithAuth(`/api/rooms/account?${params.toString()}`, {
      method: "GET",
      credentials: "omit",
    });
    return mapBackendRoomAccount(payload?.account || null);
  } catch (error) {
    console.warn("fetchRoomAccountFromBackend warning", error);
    return null;
  }
};

const buildHasPositiveBalance = (account) =>
  Number(account?.availableBalance ?? 0) > 0 ||
  Number(account?.blockedBalance ?? 0) > 0 ||
  Number(account?.totalBalance ?? 0) > 0;

const buildRoomMemberFallbackAccount = (roomMember) => {
  if (!roomMember) {
    return null;
  }

  const availableBalance = toNumber(
    pickFirstDefined(roomMember.individualAvailableBalance, roomMember.individual_available_balance),
    0
  );
  const blockedBalance = toNumber(
    pickFirstDefined(roomMember.individualBlockedBalance, roomMember.individual_blocked_balance),
    0
  );
  const totalBalance = toNumber(
    pickFirstDefined(roomMember.individualTotalBalance, roomMember.individual_total_balance),
    availableBalance + blockedBalance
  );

  return {
    id: roomMember.id
      ? `rm:${roomMember.id}`
      : `rm:${pickFirstDefined(roomMember.roomId, roomMember.room_id)}:${pickFirstDefined(
          roomMember.userId,
          roomMember.user_id
        )}`,
    roomId: pickFirstDefined(roomMember.roomId, roomMember.room_id) || null,
    userId: pickFirstDefined(roomMember.userId, roomMember.user_id) || null,
    availableBalance,
    blockedBalance,
    totalBalance,
    currency: pickFirstDefined(roomMember.individualCurrency, roomMember.individual_currency) || "USD",
    state: roomMember.state || "active",
    ownerType: "user",
    ownerGroupId: null,
    isShared: false,
    createdAt: pickFirstDefined(roomMember.joinedAt, roomMember.joined_at) || null,
    updatedAt: null,
  };
};

export const resolveUserRoomAccount = ({ roomId, userId, userIds = [], roomAccounts = [], roomMembers = [] }) => {
  const candidateUserIds = buildCandidateUserIds(userId, userIds);
  if (!roomId || candidateUserIds.length === 0) {
    return null;
  }

  const hasCandidate = (value) => candidateUserIds.includes(normalizeId(value));

  const directRoomAccount =
    (roomAccounts || []).find(
      (account) => account?.roomId === roomId && hasCandidate(account?.userId)
    ) || null;

  if (directRoomAccount) {
    return {
      ...directRoomAccount,
      availableBalance: toNumber(directRoomAccount.availableBalance, 0),
      blockedBalance: toNumber(directRoomAccount.blockedBalance, 0),
      totalBalance: toNumber(
        directRoomAccount.totalBalance,
        toNumber(directRoomAccount.availableBalance, 0) + toNumber(directRoomAccount.blockedBalance, 0)
      ),
      currency: directRoomAccount.currency || "USD",
    };
  }

  const fallbackMember =
    (roomMembers || []).find(
      (member) => member?.roomId === roomId && hasCandidate(member?.userId)
    ) || null;

  return buildRoomMemberFallbackAccount(fallbackMember);
};

const parseRoomAccountId = (accountId) => {
  if (typeof accountId !== "string" || !accountId.includes(":")) {
    return null;
  }

  const parts = accountId.split(":");
  const namespace = parts[0];
  const rowId = parts[1] || null;

  if (namespace === "rm" && parts.length === 2 && rowId) {
    return { type: "room_member", rowId };
  }

  if (namespace === "rgm" && parts.length === 2 && rowId) {
    return { type: "room_group_member", rowId };
  }

  return null;
};

const mapRoomMemberRowToAccount = (row) => ({
  id: row?.id ? `rm:${row.id}` : null,
  roomId: row?.room_id || null,
  userId: row?.user_id || null,
  availableBalance: toNumber(row?.individual_available_balance, 0),
  blockedBalance: toNumber(row?.individual_blocked_balance, 0),
  totalBalance: toNumber(
    row?.individual_total_balance,
    toNumber(row?.individual_available_balance, 0) + toNumber(row?.individual_blocked_balance, 0)
  ),
  currency: row?.individual_currency || "USD",
  state: row?.state || "active",
  ownerType: "user",
  ownerGroupId: null,
  isShared: false,
  createdAt: row?.joined_at || null,
  updatedAt: row?.updated_at || null,
});

const mapRoomGroupMemberRowToAccount = (row) => ({
  id: row?.id ? `rgm:${row.id}` : null,
  roomId: row?.room_id || null,
  userId: row?.user_id || null,
  availableBalance: toNumber(row?.group_available_balance, 0),
  blockedBalance: toNumber(row?.group_blocked_balance, 0),
  totalBalance: toNumber(
    row?.group_total_balance,
    toNumber(row?.group_available_balance, 0) + toNumber(row?.group_blocked_balance, 0)
  ),
  currency: row?.group_currency || "USD",
  state: row?.state || "active",
  ownerType: "group",
  ownerGroupId: row?.group_id || null,
  isShared: true,
  createdAt: row?.joined_at || null,
  updatedAt: row?.updated_at || null,
});

const pickRowByCandidateUserIds = (rows = [], candidateUserIds = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  for (const candidateUserId of candidateUserIds) {
    const matchedRow = rows.find((row) => normalizeId(row?.user_id) === candidateUserId);
    if (matchedRow) {
      return matchedRow;
    }
  }

  return rows[0] || null;
};

export const fetchResolvedUserRoomAccount = async ({ roomId, userId, userIds = [] }) => {
  const candidateUserIds = buildCandidateUserIds(userId, userIds);
  const dbCandidateUserIds = candidateUserIds.filter(isUuidLike);
  if (!roomId || dbCandidateUserIds.length === 0) {
    return fetchRoomAccountFromBackend({ roomId });
  }

  const memberColumns =
    "id, room_id, user_id, state, joined_at, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency";
  const groupColumns =
    "id, room_id, group_id, user_id, state, joined_at, group_available_balance, group_blocked_balance, group_total_balance, group_currency, group:room_groups(id, state)";

  const buildRoomMembersQuery = () => {
    const query = supabase
      .from("room_members")
      .select(memberColumns)
      .eq("room_id", roomId)
      .eq("state", "active");

    if (dbCandidateUserIds.length === 1) {
      return query.eq("user_id", dbCandidateUserIds[0]).maybeSingle();
    }

    return query.in("user_id", dbCandidateUserIds).limit(dbCandidateUserIds.length);
  };

  const buildRoomGroupMembersQuery = () => {
    const query = supabase
      .from("room_group_members")
      .select(groupColumns)
      .eq("room_id", roomId)
      .eq("state", "active");

    if (dbCandidateUserIds.length === 1) {
      return query.eq("user_id", dbCandidateUserIds[0]).maybeSingle();
    }

    return query.in("user_id", dbCandidateUserIds).limit(dbCandidateUserIds.length);
  };

  let roomMemberData = null;
  let roomMemberError = null;
  let roomGroupMemberData = null;
  let roomGroupMemberError = null;

  try {
    const [roomMemberResult, roomGroupMemberResult] = await Promise.all([
      buildRoomMembersQuery(),
      buildRoomGroupMembersQuery(),
    ]);
    roomMemberData = roomMemberResult?.data ?? null;
    roomMemberError = roomMemberResult?.error ?? null;
    roomGroupMemberData = roomGroupMemberResult?.data ?? null;
    roomGroupMemberError = roomGroupMemberResult?.error ?? null;
  } catch (error) {
    console.warn("fetchResolvedUserRoomAccount query warning", error);
    return fetchRoomAccountFromBackend({ roomId });
  }

  if (roomMemberError) {
    console.warn("fetchResolvedUserRoomAccount room members warning", roomMemberError);
    return fetchRoomAccountFromBackend({ roomId });
  }

  if (roomGroupMemberError) {
    console.warn("fetchResolvedUserRoomAccount group membership warning", roomGroupMemberError);
  }

  const roomMemberRow = Array.isArray(roomMemberData)
    ? pickRowByCandidateUserIds(roomMemberData, candidateUserIds)
    : roomMemberData || null;
  const roomGroupMemberRow = Array.isArray(roomGroupMemberData)
    ? pickRowByCandidateUserIds(roomGroupMemberData, candidateUserIds)
    : roomGroupMemberData || null;

  const individualAccount = roomMemberRow ? mapRoomMemberRowToAccount(roomMemberRow) : null;
  const groupState = String(roomGroupMemberRow?.group?.state || "").toLowerCase();
  const hasActiveGroupMembership = Boolean(roomGroupMemberRow?.id) && (!groupState || groupState === "active");
  const groupAccount = hasActiveGroupMembership
    ? mapRoomGroupMemberRowToAccount(roomGroupMemberRow)
    : null;

  if (!groupAccount) {
    if (individualAccount) {
      return individualAccount;
    }
    return fetchRoomAccountFromBackend({ roomId });
  }

  if (individualAccount && !buildHasPositiveBalance(groupAccount) && buildHasPositiveBalance(individualAccount)) {
    return individualAccount;
  }

  return groupAccount;
};

const fetchRoomMemberSnapshot = async ({ account, parsedAccountId }) => {
  const selectColumns =
    "id, room_id, user_id, state, joined_at, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency";

  if (parsedAccountId?.type === "room_member") {
    const { data, error } = await supabase
      .from("room_members")
      .select(selectColumns)
      .eq("id", parsedAccountId.rowId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapRoomMemberRowToAccount(data) : null;
  }

  if (!account?.roomId || !account?.userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("room_members")
    .select(selectColumns)
    .eq("room_id", account.roomId)
    .eq("user_id", account.userId)
    .eq("state", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRoomMemberRowToAccount(data) : null;
};

const fetchRoomGroupMemberSnapshot = async ({ account, parsedAccountId }) => {
  const selectColumns =
    "id, room_id, group_id, user_id, state, joined_at, group_available_balance, group_blocked_balance, group_total_balance, group_currency";

  if (parsedAccountId?.type === "room_group_member") {
    const { data, error } = await supabase
      .from("room_group_members")
      .select(selectColumns)
      .eq("id", parsedAccountId.rowId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapRoomGroupMemberRowToAccount(data) : null;
  }

  if (account?.roomId && account?.userId && account?.ownerGroupId) {
    const { data, error } = await supabase
      .from("room_group_members")
      .select(selectColumns)
      .eq("room_id", account.roomId)
      .eq("group_id", account.ownerGroupId)
      .eq("user_id", account.userId)
      .eq("state", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapRoomGroupMemberRowToAccount(data) : null;
  }

  return null;
};

export const subscribeToRoomAccount = ({ account, onChange }) => {
  if (!account || typeof onChange !== "function") {
    return () => {};
  }

  const parsedAccountId = parseRoomAccountId(account.id);

  let tableName = null;
  let filter = null;
  let mapRowToAccount = null;
  let fetchSnapshot = null;
  let matchesTarget = () => true;

  if (parsedAccountId?.type === "room_member") {
    tableName = "room_members";
    filter = `id=eq.${parsedAccountId.rowId}`;
    mapRowToAccount = mapRoomMemberRowToAccount;
    fetchSnapshot = () => fetchRoomMemberSnapshot({ account, parsedAccountId });
  } else if (parsedAccountId?.type === "room_group_member") {
    tableName = "room_group_members";
    filter = `id=eq.${parsedAccountId.rowId}`;
    mapRowToAccount = mapRoomGroupMemberRowToAccount;
    fetchSnapshot = () => fetchRoomGroupMemberSnapshot({ account, parsedAccountId });
  } else if (account.ownerType === "group" && account.ownerGroupId) {
    tableName = "room_group_members";
    filter = `group_id=eq.${account.ownerGroupId}`;
    mapRowToAccount = mapRoomGroupMemberRowToAccount;
    fetchSnapshot = () => fetchRoomGroupMemberSnapshot({ account, parsedAccountId });
    matchesTarget = (row) =>
      row?.room_id === account.roomId &&
      row?.user_id === account.userId &&
      String(row?.state || "").toLowerCase() === "active";
  } else if (account.roomId && account.userId) {
    tableName = "room_members";
    filter = `room_id=eq.${account.roomId}`;
    mapRowToAccount = mapRoomMemberRowToAccount;
    fetchSnapshot = () => fetchRoomMemberSnapshot({ account, parsedAccountId });
    matchesTarget = (row) =>
      row?.user_id === account.userId &&
      String(row?.state || "").toLowerCase() === "active";
  }

  if (!tableName || !filter || !mapRowToAccount || !fetchSnapshot) {
    return () => {};
  }

  const channelName = `room-account-${tableName}-${account.id}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  let isClosed = false;
  const refreshSnapshot = async () => {
    try {
      const snapshot = await fetchSnapshot();
      if (!isClosed && snapshot) {
        onChange(snapshot);
      }
    } catch (error) {
      console.warn("subscribeToRoomAccount snapshot warning", error);
    }
  };

  void refreshSnapshot();

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableName,
        filter,
      },
      (payload) => {
        const nextRow = payload?.new || null;
        const previousRow = payload?.old || null;
        const candidateRow = nextRow || previousRow;

        if (!candidateRow || !matchesTarget(candidateRow)) {
          return;
        }

        if (payload?.eventType === "DELETE") {
          onChange(null);
          return;
        }

        onChange(mapRowToAccount(nextRow));
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        void refreshSnapshot();
      }
    });

  const pollingIntervalId =
    typeof window !== "undefined"
      ? window.setInterval(() => {
          void refreshSnapshot();
        }, 5000)
      : null;

  return () => {
    isClosed = true;
    if (pollingIntervalId != null) {
      window.clearInterval(pollingIntervalId);
    }
    void supabase.removeChannel(channel);
  };
};
