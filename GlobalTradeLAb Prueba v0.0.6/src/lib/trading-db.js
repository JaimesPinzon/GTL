import { getCachedSupabaseAccessToken, supabase } from "@/lib/supabase";
import { getBackendUrl } from "@/lib/env";
import { getAccessToken } from "@/lib/auth-api";

let isBackendLeaveEndpointUnavailable = false;

const profileColumns = `
  user_id,
  email,
  name,
  alias,
  last_name,
  dob,
  country,
  address,
  avatar,
  language,
  timezone,
  plan,
  role,
  verified,
  created_at,
  updated_at
`;

const mapProfile = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    id: profile.user_id,
    email: profile.email,
    name: profile.name || "",
    alias: profile.alias || "",
    lastName: profile.last_name || "",
    dob: profile.dob || "",
    country: profile.country || "",
    address: profile.address || "",
    avatar: profile.avatar || "",
    language: profile.language || "es",
    timezone: profile.timezone || "(UTC-05:00) Bogota",
    plan: profile.plan || "Gratis",
    role: profile.role || "student",
    verified: Boolean(profile.verified),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
};

const mapPosition = (position) => ({
  id: position.id,
  symbol: position.symbol,
  type: position.type,
  amount: Number(position.amount ?? 0),
  entryPrice: Number(position.entry_price ?? 0),
  openDate: position.open_date,
  justification: position.justification || "",
  attachmentName: position.attachment_name || null,
});

const mapTransaction = (transaction) => ({
  id: transaction.id,
  type: transaction.type,
  symbol: transaction.symbol,
  amount: Number(transaction.amount ?? 0),
  price: transaction.price == null ? undefined : Number(transaction.price),
  entryPrice: transaction.entry_price == null ? undefined : Number(transaction.entry_price),
  closePrice: transaction.close_price == null ? undefined : Number(transaction.close_price),
  profitOrLoss: transaction.profit_or_loss == null ? undefined : Number(transaction.profit_or_loss),
  date: transaction.date,
  justification: transaction.justification || "",
  attachmentName: transaction.attachment_name || null,
});

const toProfileRow = (user) => ({
  user_id: user.id,
  email: user.email,
  name: user.name || "",
  alias: user.alias || "",
  last_name: user.lastName || "",
  dob: user.dob || null,
  country: user.country || "",
  address: user.address || "",
  avatar: user.avatar || "",
  language: user.language || "es",
  timezone: user.timezone || "(UTC-05:00) Bogota",
  plan: user.plan || "Gratis",
  role: user.role || "student",
  verified: Boolean(user.verified),
});

const toPositionRow = (userId, position, roomId = null) => ({
  id: position.id,
  room_id: roomId,
  user_id: userId,
  symbol: position.symbol,
  type: position.type,
  amount: position.amount,
  entry_price: position.entryPrice,
  open_date: position.openDate,
  justification: position.justification || "",
  attachment_name: position.attachmentName || null,
});

const toTransactionRow = (userId, transaction, roomId = null) => ({
  id: transaction.id,
  room_id: roomId,
  user_id: userId,
  type: transaction.type,
  symbol: transaction.symbol,
  amount: transaction.amount,
  price: transaction.price ?? null,
  entry_price: transaction.entryPrice ?? null,
  close_price: transaction.closePrice ?? null,
  profit_or_loss: transaction.profitOrLoss ?? null,
  date: transaction.date,
  justification: transaction.justification || "",
  attachment_name: transaction.attachmentName || null,
});

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function fetchAccessibleProfiles(currentProfile) {
  if (!currentProfile) {
    return [];
  }

  return [currentProfile];
}

export async function fetchPortfolio(userId, roomId = null) {
  const positionsQuery = supabase
    .from("positions")
    .select("*")
    .eq("user_id", userId)
    .order("open_date", { ascending: true });

  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (roomId) {
    positionsQuery.eq("room_id", roomId);
    transactionsQuery.eq("room_id", roomId);
  } else {
    positionsQuery.is("room_id", null);
    transactionsQuery.is("room_id", null);
  }

  const [{ data: positions, error: positionsError }, { data: transactions, error: transactionsError }] =
    await Promise.all([positionsQuery, transactionsQuery]);

  if (positionsError) {
    throw positionsError;
  }

  if (transactionsError) {
    throw transactionsError;
  }

  return {
    positions: positions.map(mapPosition),
    transactions: transactions.map(mapTransaction),
  };
}

export async function upsertProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(toProfileRow(user), { onConflict: "user_id" })
    .select(profileColumns)
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data);
}

export async function syncPortfolio(userId, positions, transactions, roomId = null) {
  const deletePositionsQuery = supabase.from("positions").delete().eq("user_id", userId);
  const deleteTransactionsQuery = supabase.from("transactions").delete().eq("user_id", userId);

  if (roomId) {
    deletePositionsQuery.eq("room_id", roomId);
    deleteTransactionsQuery.eq("room_id", roomId);
  } else {
    deletePositionsQuery.is("room_id", null);
    deleteTransactionsQuery.is("room_id", null);
  }

  const { error: deletePositionsError } = await deletePositionsQuery;

  if (deletePositionsError) {
    throw deletePositionsError;
  }

  const { error: deleteTransactionsError } = await deleteTransactionsQuery;

  if (deleteTransactionsError) {
    throw deleteTransactionsError;
  }

  if (positions.length > 0) {
    const { error } = await supabase
      .from("positions")
      .insert(positions.map((position) => toPositionRow(userId, position, roomId)));

    if (error) {
      throw error;
    }
  }

  if (transactions.length > 0) {
    const { error } = await supabase
      .from("transactions")
      .insert(transactions.map((transaction) => toTransactionRow(userId, transaction, roomId)));

    if (error) {
      throw error;
    }
  }
}

export async function updateAuthIdentity(updates) {
  const payload = {};

  if (updates.email) {
    payload.email = updates.email;
  }

  if (updates.password) {
    payload.password = updates.password;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase.auth.updateUser(payload);

  if (error) {
    throw error;
  }
}


export async function deleteCurrentAccount() {
  const accessToken = (await getAccessToken().catch(() => null)) || getCachedSupabaseAccessToken();

  if (!accessToken) {
    throw new Error("No authenticated session");
  }

  const response = await fetch(getBackendUrl("/api/account/delete"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Unable to delete account");
  }
}


const mapRoomRecord = (room) => ({
  id: room.id,
  name: room.name,
  accessCode: room.access_code,
  description: room.description || "",
  state: room.state,
  startDate: room.start_date || null,
  endDate: room.end_date || null,
  defaultCurrency: room.default_currency || "USD",
  defaultBalance: Number(room.default_balance ?? 0),
  allowRanking: room.allow_ranking ?? room.allowRanking ?? undefined,
  allowGrades: room.allow_grades ?? room.allowGrades ?? undefined,
  portfolioVisibility: room.portfolio_visibility ?? room.portfolioVisibility ?? undefined,
  coverImageUrl: room.cover_image_url ?? room.coverImageUrl ?? "",
  allowedMarkets: room.allowed_markets ?? room.allowedMarkets ?? undefined,
  operationStartDate: room.operation_start_date ?? room.operationStartDate ?? room.start_date ?? null,
  operationCloseDate: room.operation_close_date ?? room.operationCloseDate ?? room.end_date ?? null,
  createdBy: room.created_by,
  createdAt: room.created_at,
  updatedAt: room.updated_at,
});

const VALID_ROOM_STATES = new Set(["active", "closed", "archived"]);

const normalizeRoomState = (value) => {
  const normalizedValue = String(value || "active").trim().toLowerCase();

  if (normalizedValue === "inactive") {
    return "closed";
  }

  if (normalizedValue === "deleted") {
    return "archived";
  }

  return normalizedValue;
};

const mapRoomActivity = (activity) => ({
  id: activity.id,
  roomId: activity.room_id,
  title: activity.title,
  description: activity.description || "",
  activityType: activity.activity_type,
  state: activity.state,
  isGradable: Boolean(activity.is_gradable),
  maxScore: activity.max_score == null ? null : Number(activity.max_score),
  openAt: activity.open_at,
  closeAt: activity.close_at,
  createdAt: activity.created_at,
});

const parseAttachmentPayload = (value) => {
  if (!value) {
    return { fileUrl: null, attachmentName: null };
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed?.dataUrl) {
      return {
        fileUrl: parsed.dataUrl,
        attachmentName: parsed.name || "Adjunto",
      };
    }
    if (parsed?.publicUrl) {
      return {
        fileUrl: parsed.publicUrl,
        attachmentName: parsed.name || "Adjunto",
      };
    }
  } catch {
    // fall through for plain URLs
  }

  return {
    fileUrl: value,
    attachmentName: null,
  };
};

const mapActivityPost = (post) => {
  const attachment = parseAttachmentPayload(post.file_url);
  return {
    id: post.id,
    activityId: post.activity_id,
    userId: post.user_id,
    parentPostId: post.parent_post_id || null,
    content: post.content || "",
    fileUrl: attachment.fileUrl,
    attachmentName: attachment.attachmentName,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    profile: mapProfile(post.profile),
  };
};

const mapActivitySubmission = (submission) => {
  const attachment = parseAttachmentPayload(submission.file_url);
  return {
    id: submission.id,
    activityId: submission.activity_id,
    userId: submission.user_id,
    contentText: submission.content_text || "",
    fileUrl: attachment.fileUrl,
    attachmentName: attachment.attachmentName,
    state: submission.state,
    submittedAt: submission.submitted_at,
    updatedAt: submission.updated_at,
    profile: mapProfile(submission.profile),
  };
};

const mapActivityGrade = (grade) => ({
  id: grade.id,
  activityId: grade.activity_id,
  userId: grade.user_id,
  gradedBy: grade.graded_by,
  score: Number(grade.score ?? 0),
  feedback: grade.feedback || "",
  gradedAt: grade.graded_at,
  profile: mapProfile(grade.profile),
});

const buildClientRoomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};
const withDatabaseTimeout = async (promise, label, timeoutMs = 12000) => {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`${label} tardo demasiado en responder.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
};

export async function generateRoomCode() {
  const { data, error } = await supabase.rpc("generate_room_code");

  if (error) {
    console.warn("generate_room_code rpc unavailable, using client fallback", error);
    return buildClientRoomCode();
  }

  return data || buildClientRoomCode();
}
export async function fetchTeacherRooms(userId) {
  const accessToken = (await getAccessToken().catch(() => null)) || getCachedSupabaseAccessToken();

  if (accessToken) {
    const response = await fetch(getBackendUrl("/api/rooms/list?role=teacher"), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json().catch(() => null);

    if (response.ok && payload?.ok && Array.isArray(payload.rooms)) {
      return payload.rooms;
    }
  }

  const [ownedRoomsResult, teacherMembershipsResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("room_members")
      .select("role_in_room, state, joined_at, room:rooms(*)")
      .eq("user_id", userId)
      .in("role_in_room", ["teacher", "monitor"])
      .eq("state", "active")
      .order("joined_at", { ascending: false }),
  ]);

  if (ownedRoomsResult.error) {
    throw ownedRoomsResult.error;
  }

  if (teacherMembershipsResult.error) {
    throw teacherMembershipsResult.error;
  }

  const ownedRooms = (ownedRoomsResult.data || []).map((room) => ({
    membershipRole: "teacher",
    membershipState: "active",
    joinedAt: room.created_at || null,
    ...mapRoomRecord(room),
  }));

  const membershipRooms = (teacherMembershipsResult.data || []).map((entry) => ({
    membershipRole: entry.role_in_room,
    membershipState: entry.state,
    joinedAt: entry.joined_at || null,
    ...mapRoomRecord(entry.room),
  }));

  const deduped = [...ownedRooms, ...membershipRooms].filter(
    (room, index, collection) => collection.findIndex((entry) => entry.id === room.id) === index
  );

  return deduped;
}

export async function fetchStudentRooms(userId) {
  const accessToken = await getAccessToken().catch(() => null);

  if (accessToken) {
    const response = await fetch(getBackendUrl("/api/rooms/list?role=student"), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json().catch(() => null);

    if (response.ok && payload?.ok && Array.isArray(payload.rooms)) {
      return payload.rooms;
    }
  }

  const { data, error } = await supabase
    .from("room_members")
    .select("role_in_room, state, room:rooms(*)")
    .eq("user_id", userId)
    .eq("role_in_room", "student")
    .eq("state", "active")
    .order("joined_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((entry) => ({
    membershipRole: entry.role_in_room,
    membershipState: entry.state,
    joinedAt: entry.joined_at || null,
    ...mapRoomRecord(entry.room),
  }));
}

export async function fetchRoomHistory(userId, role = "student") {
  if (!userId) {
    return [];
  }

  if (role === "teacher") {
    const [ownedRoomsResult, membershipsResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("room_members")
        .select("role_in_room, state, joined_at, room:rooms(*)")
        .eq("user_id", userId)
        .in("role_in_room", ["teacher", "monitor"])
        .order("joined_at", { ascending: false }),
    ]);

    if (ownedRoomsResult.error) {
      throw ownedRoomsResult.error;
    }

    if (membershipsResult.error) {
      throw membershipsResult.error;
    }

    const ownedRooms = (ownedRoomsResult.data || []).map((room) => ({
      membershipRole: "teacher",
      membershipState: "active",
      joinedAt: room.created_at || null,
      ...mapRoomRecord(room),
    }));

    const memberships = (membershipsResult.data || []).map((entry) => ({
      membershipRole: entry.role_in_room,
      membershipState: entry.state,
      joinedAt: entry.joined_at || null,
      ...mapRoomRecord(entry.room),
    }));

    return [...ownedRooms, ...memberships].filter(
      (room, index, collection) => collection.findIndex((entry) => entry.id === room.id) === index
    );
  }

  const { data, error } = await supabase
    .from("room_members")
    .select("role_in_room, state, joined_at, room:rooms(*)")
    .eq("user_id", userId)
    .eq("role_in_room", "student")
    .order("joined_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((entry) => ({
    membershipRole: entry.role_in_room,
    membershipState: entry.state,
    joinedAt: entry.joined_at || null,
    ...mapRoomRecord(entry.room),
  }));
}

export async function fetchRoomActivities(roomId, role = "student") {
  const query = supabase
    .from("activities")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (role === "teacher") {
    query.in("state", ["draft", "published", "closed", "archived"]);
  } else {
    query.in("state", ["published", "closed"]);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data.map(mapRoomActivity);
}

export async function updateRoomActivityState(activityId, nextState) {
  const { data, error } = await supabase
    .from("activities")
    .update({
      state: nextState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRoomActivity(data);
}

export async function uploadActivityAttachment({ file, roomId, activityId, userId }) {
  if (!file) {
    return null;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${roomId}/${activityId}/${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("class-attachments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(
      uploadError.message?.includes("Bucket not found")
        ? "No existe el bucket 'class-attachments' en Supabase Storage."
        : uploadError.message || "No se pudo subir el archivo adjunto."
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("class-attachments").getPublicUrl(path);

  return JSON.stringify({
    name: file.name,
    path,
    publicUrl,
  });
}

export async function createRoomActivity({
  roomId,
  createdBy,
  title,
  description,
  activityType,
  isGradable,
  maxScore,
  openAt,
  closeAt,
  referencedAssetSymbol,
}) {
  const { data, error } = await supabase
    .from("activities")
    .insert({
      room_id: roomId,
      created_by: createdBy,
      title: title.trim(),
      description: description.trim(),
      activity_type: activityType,
      state: "published",
      is_gradable: Boolean(isGradable),
      max_score: isGradable && maxScore != null ? Number(maxScore) : null,
      open_at: openAt || null,
      close_at: closeAt || null,
      referenced_asset_symbol: referencedAssetSymbol?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRoomActivity(data);
}

export async function fetchActivityPosts(activityId) {
  const { data, error } = await supabase
    .from("activity_posts")
    .select("*, profile:profiles(*)")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(mapActivityPost);
}

export async function createActivityPost({
  activityId,
  userId,
  content,
  parentPostId = null,
  fileUrl = null,
}) {
  const { data, error } = await supabase
    .from("activity_posts")
    .insert({
      activity_id: activityId,
      user_id: userId,
      parent_post_id: parentPostId,
      content: content.trim(),
      file_url: fileUrl,
    })
    .select("*, profile:profiles(*)")
    .single();

  if (error) {
    throw error;
  }

  return mapActivityPost(data);
}

export async function fetchActivitySubmission(activityId, userId) {
  const { data, error } = await supabase
    .from("activity_submissions")
    .select("*, profile:profiles(*)")
    .eq("activity_id", activityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapActivitySubmission(data) : null;
}

export async function fetchActivitySubmissions(activityId) {
  const { data, error } = await supabase
    .from("activity_submissions")
    .select("*, profile:profiles(*)")
    .eq("activity_id", activityId)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data.map(mapActivitySubmission);
}

export async function upsertActivitySubmission({
  activityId,
  userId,
  contentText,
  fileUrl = null,
  state = "submitted",
}) {
  const payload = {
    activity_id: activityId,
    user_id: userId,
    content_text: contentText.trim(),
    file_url: fileUrl,
    state,
    submitted_at: state === "submitted" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("activity_submissions")
    .upsert(payload, { onConflict: "activity_id,user_id" })
    .select("*, profile:profiles(*)")
    .single();

  if (error) {
    throw error;
  }

  return mapActivitySubmission(data);
}

export async function fetchActivityGrades(activityId) {
  const { data, error } = await supabase
    .from("activity_grades")
    .select("*, profile:profiles!activity_grades_user_id_fkey(*)")
    .eq("activity_id", activityId)
    .order("graded_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(mapActivityGrade);
}

export async function fetchRoomGradebook(roomId) {
  const { data, error } = await supabase
    .from("activity_grades")
    .select(
      "*, profile:profiles!activity_grades_user_id_fkey(*), activity:activities!inner(id, room_id, title, activity_type, max_score)"
    )
    .eq("activity.room_id", roomId)
    .order("graded_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((grade) => ({
    ...mapActivityGrade(grade),
    activity: grade.activity
      ? {
          id: grade.activity.id,
          roomId: grade.activity.room_id,
          title: grade.activity.title,
          activityType: grade.activity.activity_type,
          maxScore: grade.activity.max_score == null ? null : Number(grade.activity.max_score),
        }
      : null,
  }));
}

export async function upsertActivityGrade({
  activityId,
  userId,
  gradedBy,
  score,
  feedback,
}) {
  const { data, error } = await supabase
    .from("activity_grades")
    .upsert(
      {
        activity_id: activityId,
        user_id: userId,
        graded_by: gradedBy,
        score: Number(score),
        feedback: feedback.trim(),
        graded_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,user_id" }
    )
    .select("*, profile:profiles!activity_grades_user_id_fkey(*)")
    .single();

  if (error) {
    throw error;
  }

  return mapActivityGrade(data);
}

export async function createRoom({
  ownerUserId,
  name,
  description,
  defaultBalance = 100000,
  defaultCurrency = "USD",
  startDate = null,
  endDate = null,
  roomSettings = null,
}) {
  console.info("[createRoom] start", { ownerUserId, name });

  const accessToken = await getAccessToken().catch(() => null);

  if (!accessToken) {
    throw new Error("No authenticated session");
  }

  console.info("[createRoom] token ok");

  const response = await Promise.race([
    fetch(getBackendUrl("/api/rooms/create"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({
        ownerUserId,
        name,
        description,
        defaultBalance,
        defaultCurrency,
        startDate,
        endDate,
        roomSettings,
      }),
    }),
    new Promise((_, reject) =>
      window.setTimeout(() => reject(new Error("La peticion al backend tardo demasiado en responder.")), 12000)
    ),
  ]);

  console.info("[createRoom] response status", response.status);
  const payload = await response.json().catch(() => null);
  console.info("[createRoom] payload", payload);

  if (!response.ok || !payload?.ok || !payload?.room) {
    throw new Error(payload?.error || "No se pudo crear la sala.");
  }

  return payload.room;
}

export async function joinRoomByCode({ userId, accessCode }) {
  if (typeof accessCode !== "string") {
    throw new Error("El codigo de la sala no es valido.");
  }

  const normalizedCode = accessCode.toUpperCase().replace(/[\s-]+/g, "").trim();
  if (!normalizedCode) {
    throw new Error("Debes ingresar un codigo de sala.");
  }

  const backendAccessToken = await getAccessToken().catch(() => null);
  const supabaseAccessToken = getCachedSupabaseAccessToken();

  if (backendAccessToken) {
    const response = await fetch(getBackendUrl("/api/rooms/join"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${backendAccessToken}`,
      },
      body: JSON.stringify({ accessCode: normalizedCode }),
    });

    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.ok && payload?.room) {
      if (supabaseAccessToken) {
        try {
          await ensureRoomMemberTradingFields({
            roomId: payload.room.id,
            userId,
            defaultBalance: Number(payload.room.default_balance ?? payload.room.defaultBalance ?? 0),
            defaultCurrency: payload.room.default_currency ?? payload.room.defaultCurrency ?? "USD",
            createIfMissingRole: "student",
          });
        } catch (syncError) {
          // El alta en sala ya fue completada por backend; esta sincronizacion solo refuerza
          // campos de balance cuando el cliente tiene sesion valida en Supabase.
          console.warn("joinRoomByCode ensureRoomMemberTradingFields warning", syncError);
        }
      }
      return payload.room;
    }

    if (payload?.error && [400, 401, 403, 404, 409].includes(response.status)) {
      throw new Error(payload.error);
    }
  }

  if (!supabaseAccessToken) {
    throw new Error(
      "No pudimos validar una sesion de base de datos para unirte a la sala. Cierra sesion y vuelve a iniciar."
    );
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("access_code", normalizedCode)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roomError) {
    throw roomError;
  }

  if (!room) {
    throw new Error("No se encontro una sala con ese codigo.");
  }

  if (room.state !== "active") {
    throw new Error("La sala existe, pero no esta activa para nuevos ingresos.");
  }

  const { error: memberError } = await supabase
    .from("room_members")
    .upsert(
      {
        room_id: room.id,
        user_id: userId,
        role_in_room: "student",
        state: "active",
      },
      { onConflict: "room_id,user_id" }
    );

  if (memberError) {
    throw memberError;
  }

  await ensureRoomMemberTradingFields({
    roomId: room.id,
    userId,
    defaultBalance: Number(room.default_balance ?? 0),
    defaultCurrency: room.default_currency || "USD",
    createIfMissingRole: "student",
  });

  return mapRoomRecord(room);
}

export async function leaveRoom({ roomId, userId }) {
  if (!roomId || !userId) {
    throw new Error("Sala o usuario no disponible.");
  }

  const accessToken = (await getAccessToken().catch(() => null)) || getCachedSupabaseAccessToken();
  let backendLeaveUnavailable = isBackendLeaveEndpointUnavailable;
  if (accessToken && !isBackendLeaveEndpointUnavailable) {
    try {
      const response = await fetch(getBackendUrl("/api/rooms/leave"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roomId }),
      });

      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        return true;
      }

      if (![404, 405].includes(response.status)) {
        throw new Error(payload?.error || "No se pudo salir de la sala.");
      }

      backendLeaveUnavailable = true;
      isBackendLeaveEndpointUnavailable = true;
    } catch (requestError) {
      // CORS/404 de despliegue parcial: usar fallback directo a Supabase mientras
      // el endpoint backend /api/rooms/leave no este publicado en el entorno.
      console.warn("leaveRoom backend leave endpoint warning", requestError);
      backendLeaveUnavailable = true;
      isBackendLeaveEndpointUnavailable = true;
    }
  }

  const { error: roomGroupMembershipError } = await supabase
    .from("room_group_members")
    .update({
      state: "removed",
    })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("state", "active");

  if (roomGroupMembershipError) {
    throw roomGroupMembershipError;
  }

  const { data: updatedMemberships, error: membershipError } = await supabase
    .from("room_members")
    .update({
      state: "removed",
    })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("state", "active")
    .select("id");

  if (membershipError) {
    throw membershipError;
  }

  if (Array.isArray(updatedMemberships) && updatedMemberships.length > 0) {
    return true;
  }

  const { data: membershipState, error: membershipStateError } = await supabase
    .from("room_members")
    .select("state")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipStateError) {
    throw membershipStateError;
  }

  if (backendLeaveUnavailable) {
    if (membershipState?.state === "removed") {
      return true;
    }

    throw new Error(
      "No se pudo confirmar la salida en servidor. Falta desplegar el endpoint /api/rooms/leave en el backend."
    );
  }

  if (!membershipState || membershipState.state === "removed") {
    return true;
  }

  throw new Error("No se pudo confirmar la salida de la sala.");
}

export async function updateRoomState(roomId, nextState) {
  const normalizedState = normalizeRoomState(nextState);

  if (!VALID_ROOM_STATES.has(normalizedState)) {
    throw new Error("Estado de sala invalido.");
  }

  const accessToken = await getAccessToken().catch(() => null);
  if (accessToken) {
    const response = await fetch(getBackendUrl("/api/rooms/update"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        roomId,
        state: normalizedState,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (response.ok && payload?.ok && payload?.room) {
      return payload.room;
    }

    // Fallback to direct Supabase update for environments without the backend route.
    if (![404, 405].includes(response.status)) {
      throw new Error(payload?.error || "No se pudo actualizar el estado de la sala.");
    }
  }

  const { data, error } = await supabase
    .from("rooms")
    .update({
      state: normalizedState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .select("*")
    .limit(1);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("La sala ya no existe o no tienes permisos para actualizarla.");
  }

  return mapRoomRecord(data[0]);
}

export async function updateRoomDetails({
  roomId,
  name,
  description,
  state,
  defaultBalance,
  defaultCurrency,
  startDate,
  endDate,
}) {
  if (!roomId) {
    throw new Error("Sala no disponible.");
  }

  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("El nombre de la sala es obligatorio.");
  }

  const normalizedState = normalizeRoomState(state);
  if (!VALID_ROOM_STATES.has(normalizedState)) {
    throw new Error("Estado de sala invalido.");
  }

  const payload = {
    name: trimmedName,
    description: String(description || "").trim(),
    state: normalizedState,
    updated_at: new Date().toISOString(),
  };

  if (defaultBalance !== undefined) {
    payload.default_balance = Number(defaultBalance);
  }

  if (defaultCurrency) {
    payload.default_currency = String(defaultCurrency).trim().toUpperCase();
  }

  if (startDate !== undefined) {
    payload.start_date = startDate || null;
  }

  if (endDate !== undefined) {
    payload.end_date = endDate || null;
  }

  const accessToken = await getAccessToken().catch(() => null);
  if (accessToken) {
    const response = await fetch(getBackendUrl("/api/rooms/update"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        roomId,
        name: trimmedName,
        description: String(description || "").trim(),
        state: normalizedState,
        defaultBalance,
        defaultCurrency,
        startDate,
        endDate,
      }),
    });

    const apiPayload = await response.json().catch(() => null);
    if (response.ok && apiPayload?.ok && apiPayload?.room) {
      return apiPayload.room;
    }

    // Fallback to direct Supabase update for environments without the backend route.
    if (![404, 405].includes(response.status)) {
      throw new Error(apiPayload?.error || "No se pudo actualizar la sala.");
    }
  }

  const { data, error } = await supabase
    .from("rooms")
    .update(payload)
    .eq("id", roomId)
    .select("*")
    .limit(1);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("La sala ya no existe o no tienes permisos para actualizarla.");
  }

  return mapRoomRecord(data[0]);
}

export async function deleteRoom(roomId) {
  if (!roomId) {
    throw new Error("Sala no disponible.");
  }

  const accessToken = (await getAccessToken().catch(() => null)) || getCachedSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("No se encontro una sesion valida para eliminar la sala.");
  }

  const response = await fetch(getBackendUrl("/api/rooms/delete"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ roomId }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "No se pudo eliminar la sala.");
  }

  return true;
}

const resolveBackendAccessToken = async () =>
  (await getAccessToken().catch(() => null)) || getCachedSupabaseAccessToken();

const requestRoomGroupsApi = async (path, { method = "GET", body } = {}) => {
  const accessToken = await resolveBackendAccessToken();
  if (!accessToken) {
    throw new Error("No se encontro una sesion valida.");
  }

  const normalizedMethod = String(method || "GET").toUpperCase();
  const response = await fetch(getBackendUrl(path), {
    method: normalizedMethod,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: normalizedMethod === "GET" ? undefined : JSON.stringify(body || {}),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "No se pudo completar la operacion de grupos.");
  }

  return payload;
};

export async function fetchRoomGroups(roomId) {
  if (!roomId) {
    throw new Error("Sala no disponible.");
  }

  const queryRoomId = encodeURIComponent(roomId);
  return requestRoomGroupsApi(`/api/rooms/groups/list?roomId=${queryRoomId}`);
}

export async function createRoomGroup({
  roomId,
  name,
  description = "",
  maxMembers = null,
  state = "active",
}) {
  return requestRoomGroupsApi("/api/rooms/groups/create", {
    method: "POST",
    body: {
      roomId,
      name,
      description,
      maxMembers,
      state,
    },
  });
}

export async function updateRoomGroup({
  roomId,
  groupId,
  name,
  description,
  maxMembers,
  state,
}) {
  return requestRoomGroupsApi("/api/rooms/groups/update", {
    method: "POST",
    body: {
      roomId,
      groupId,
      name,
      description,
      maxMembers,
      state,
    },
  });
}

export async function upsertRoomGroupMember({
  roomId,
  groupId,
  userId,
  role = "member",
  state = "active",
}) {
  return requestRoomGroupsApi("/api/rooms/groups/members", {
    method: "POST",
    body: {
      roomId,
      groupId,
      userId,
      role,
      state,
    },
  });
}

export async function autoAssignRoomGroups({
  roomId,
  includeExistingMembers = false,
}) {
  return requestRoomGroupsApi("/api/rooms/groups/auto-assign", {
    method: "POST",
    body: {
      roomId,
      includeExistingMembers,
    },
  });
}

export async function provisionRoomGroupPortfolios({
  roomId,
  replaceExisting = false,
}) {
  return requestRoomGroupsApi("/api/rooms/groups/provision-portfolios", {
    method: "POST",
    body: {
      roomId,
      replaceExisting,
    },
  });
}

const toMoney = (value, fallback = 0) => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : fallback;
};

const hasMoneyValue = (value) =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

const resolveRoomTradingDefaults = async ({
  roomId,
  defaultBalance = 0,
  defaultCurrency = "USD",
}) => {
  let resolvedDefaultBalance = Number(defaultBalance);
  let resolvedDefaultCurrency = String(defaultCurrency || "").trim().toUpperCase();

  const shouldFetchRoomDefaults =
    !Number.isFinite(resolvedDefaultBalance) || resolvedDefaultBalance <= 0 || !resolvedDefaultCurrency;

  if (shouldFetchRoomDefaults && roomId) {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("default_balance, default_currency")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) {
      throw roomError;
    }

    if (room) {
      const roomDefaultBalance = Number(room.default_balance);
      const roomDefaultCurrency = String(room.default_currency || "").trim().toUpperCase();

      if (Number.isFinite(roomDefaultBalance)) {
        resolvedDefaultBalance = roomDefaultBalance;
      }

      if (roomDefaultCurrency) {
        resolvedDefaultCurrency = roomDefaultCurrency;
      }
    }
  }

  if (!Number.isFinite(resolvedDefaultBalance)) {
    resolvedDefaultBalance = 0;
  }

  if (!resolvedDefaultCurrency) {
    resolvedDefaultCurrency = "USD";
  }

  return {
    defaultBalance: resolvedDefaultBalance,
    defaultCurrency: resolvedDefaultCurrency,
  };
};

const buildBalanceSnapshot = ({
  availableBalance,
  blockedBalance,
  totalBalance,
  currency,
  ownerType = "user",
  ownerGroupId = null,
  isShared = false,
}) => {
  const nextAvailableBalance = toMoney(availableBalance, 0);
  const nextBlockedBalance = toMoney(blockedBalance, 0);
  const nextTotalBalance = hasMoneyValue(totalBalance)
    ? toMoney(totalBalance, nextAvailableBalance + nextBlockedBalance)
    : nextAvailableBalance + nextBlockedBalance;

  return {
    availableBalance: nextAvailableBalance,
    blockedBalance: nextBlockedBalance,
    totalBalance: nextTotalBalance,
    currency: currency || "USD",
    ownerType,
    ownerGroupId,
    isShared,
  };
};

const mapRoomMemberBalanceAccount = (roomMember, groupMembership = null) => {
  const hasActiveGroup = Boolean(groupMembership?.group_id);
  const groupState = String(groupMembership?.group?.state || "").toLowerCase();
  const useSharedBalance = hasActiveGroup && groupState === "active";

  const individualSnapshot = buildBalanceSnapshot({
    availableBalance: roomMember.individual_available_balance,
    blockedBalance: roomMember.individual_blocked_balance,
    totalBalance: roomMember.individual_total_balance,
    currency: roomMember.individual_currency,
    ownerType: "user",
    ownerGroupId: null,
    isShared: false,
  });

  const sharedSnapshot = useSharedBalance
    ? buildBalanceSnapshot({
        availableBalance: groupMembership.group_available_balance,
        blockedBalance: groupMembership.group_blocked_balance,
        totalBalance: groupMembership.group_total_balance,
        currency: groupMembership.group_currency || individualSnapshot.currency,
        ownerType: "group",
        ownerGroupId: groupMembership.group_id,
        isShared: true,
      })
    : null;

  const shouldFallbackToIndividual =
    Boolean(sharedSnapshot) &&
    sharedSnapshot.availableBalance <= 0 &&
    sharedSnapshot.blockedBalance <= 0 &&
    sharedSnapshot.totalBalance <= 0 &&
    (individualSnapshot.availableBalance > 0 ||
      individualSnapshot.blockedBalance > 0 ||
      individualSnapshot.totalBalance > 0);

  const snapshot = shouldFallbackToIndividual ? individualSnapshot : sharedSnapshot || individualSnapshot;
  const resolvedId = snapshot.isShared ? `rgm:${groupMembership.id}` : `rm:${roomMember.id}`;

  return {
    id: resolvedId,
    roomId: roomMember.room_id,
    userId: roomMember.user_id,
    availableBalance: snapshot.availableBalance,
    blockedBalance: snapshot.blockedBalance,
    totalBalance: snapshot.totalBalance,
    currency: snapshot.currency,
    state: roomMember.state,
    ownerType: snapshot.ownerType,
    ownerGroupId: snapshot.ownerGroupId,
    isShared: snapshot.isShared,
    createdAt: roomMember.joined_at,
    updatedAt: null,
  };
};

export async function ensureRoomMemberTradingFields({
  roomId,
  userId,
  defaultBalance = 0,
  defaultCurrency = "USD",
  createIfMissingRole = null,
}) {
  const {
    defaultBalance: resolvedDefaultBalance,
    defaultCurrency: resolvedDefaultCurrency,
  } = await resolveRoomTradingDefaults({
    roomId,
    defaultBalance,
    defaultCurrency,
  });

  const readRoomMember = async () => {
    const { data, error } = await supabase
      .from("room_members")
      .select(
        "id, room_id, user_id, role_in_room, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency, individual_realized_pnl, individual_unrealized_pnl, individual_equity"
      )
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  };

  let roomMember = await readRoomMember();

  const normalizedCreateRole = String(createIfMissingRole || "").trim().toLowerCase();
  if (!roomMember && normalizedCreateRole) {
    const { error: createMemberError } = await supabase
      .from("room_members")
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          role_in_room: normalizedCreateRole,
          state: "active",
          individual_available_balance: resolvedDefaultBalance,
          individual_blocked_balance: 0,
          individual_total_balance: resolvedDefaultBalance,
          individual_currency: resolvedDefaultCurrency || "USD",
          individual_realized_pnl: 0,
          individual_unrealized_pnl: 0,
          individual_equity: resolvedDefaultBalance,
        },
        {
          onConflict: "room_id,user_id",
          ignoreDuplicates: true,
        }
      );

    if (createMemberError && createMemberError.code !== "23505") {
      throw createMemberError;
    }

    roomMember = await readRoomMember();
  }

  if (!roomMember) {
    return null;
  }

  const nextAvailableBalance = hasMoneyValue(roomMember.individual_available_balance)
    ? toMoney(roomMember.individual_available_balance, resolvedDefaultBalance)
    : toMoney(resolvedDefaultBalance, 0);
  const nextBlockedBalance = hasMoneyValue(roomMember.individual_blocked_balance)
    ? toMoney(roomMember.individual_blocked_balance, 0)
    : 0;
  const nextTotalBalance = hasMoneyValue(roomMember.individual_total_balance)
    ? toMoney(roomMember.individual_total_balance, nextAvailableBalance + nextBlockedBalance)
    : nextAvailableBalance + nextBlockedBalance;
  const nextEquity = hasMoneyValue(roomMember.individual_equity)
    ? toMoney(roomMember.individual_equity, nextTotalBalance)
    : nextTotalBalance;
  const nextCurrency = roomMember.individual_currency || resolvedDefaultCurrency || "USD";
  const nextRealizedPnl = hasMoneyValue(roomMember.individual_realized_pnl)
    ? toMoney(roomMember.individual_realized_pnl, 0)
    : 0;
  const nextUnrealizedPnl = hasMoneyValue(roomMember.individual_unrealized_pnl)
    ? toMoney(roomMember.individual_unrealized_pnl, 0)
    : 0;

  let shouldSeedMemberDefaultBalance = false;
  if (
    resolvedDefaultBalance > 0 &&
    nextAvailableBalance <= 0 &&
    nextBlockedBalance <= 0 &&
    nextTotalBalance <= 0
  ) {
    const [{ count: positionsCount, error: positionsCountError }, { count: transactionsCount, error: transactionsCountError }] =
      await Promise.all([
        supabase
          .from("positions")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .eq("user_id", userId),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .eq("user_id", userId),
      ]);

    if (positionsCountError) {
      throw positionsCountError;
    }

    if (transactionsCountError) {
      throw transactionsCountError;
    }

    const hasTradingHistory = (positionsCount ?? 0) > 0 || (transactionsCount ?? 0) > 0;
    shouldSeedMemberDefaultBalance = !hasTradingHistory;
  }

  const finalAvailableBalance = shouldSeedMemberDefaultBalance ? resolvedDefaultBalance : nextAvailableBalance;
  const finalBlockedBalance = shouldSeedMemberDefaultBalance ? 0 : nextBlockedBalance;
  const finalTotalBalance = shouldSeedMemberDefaultBalance
    ? resolvedDefaultBalance
    : nextTotalBalance;
  const finalEquity = shouldSeedMemberDefaultBalance
    ? resolvedDefaultBalance
    : nextEquity;

  const requiresUpdate =
    !hasMoneyValue(roomMember.individual_available_balance) ||
    !hasMoneyValue(roomMember.individual_blocked_balance) ||
    !hasMoneyValue(roomMember.individual_total_balance) ||
    !hasMoneyValue(roomMember.individual_equity) ||
    !hasMoneyValue(roomMember.individual_realized_pnl) ||
    !hasMoneyValue(roomMember.individual_unrealized_pnl) ||
    !roomMember.individual_currency ||
    shouldSeedMemberDefaultBalance;

  if (requiresUpdate) {
    const { error: updateError } = await supabase
      .from("room_members")
      .update({
        individual_available_balance: finalAvailableBalance,
        individual_blocked_balance: finalBlockedBalance,
        individual_total_balance: finalTotalBalance,
        individual_currency: nextCurrency,
        individual_realized_pnl: nextRealizedPnl,
        individual_unrealized_pnl: nextUnrealizedPnl,
        individual_equity: finalEquity,
      })
      .eq("id", roomMember.id);

    if (updateError) {
      throw updateError;
    }
  }

  return {
    ...roomMember,
    individual_available_balance: finalAvailableBalance,
    individual_blocked_balance: finalBlockedBalance,
    individual_total_balance: finalTotalBalance,
    individual_currency: nextCurrency,
    individual_realized_pnl: nextRealizedPnl,
    individual_unrealized_pnl: nextUnrealizedPnl,
    individual_equity: finalEquity,
  };
}

const findActiveGroupMembershipWithBalance = async ({ roomId, userId }) => {
  const { data, error } = await supabase
    .from("room_group_members")
    .select(
      "id, room_id, group_id, user_id, state, group_available_balance, group_blocked_balance, group_total_balance, group_currency, group_realized_pnl, group_unrealized_pnl, group_equity, group:room_groups(id, state)"
    )
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("state", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const groupState = String(data.group?.state || "").toLowerCase();
  if (groupState && groupState !== "active") {
    return null;
  }

  return data;
};

const resolveEffectiveRoomMemberBalance = async ({ roomId, userId }) => {
  const sharedMembership = await findActiveGroupMembershipWithBalance({ roomId, userId });

  if (sharedMembership) {
    const snapshot = buildBalanceSnapshot({
      availableBalance: sharedMembership.group_available_balance,
      blockedBalance: sharedMembership.group_blocked_balance,
      totalBalance: sharedMembership.group_total_balance,
      currency: sharedMembership.group_currency || "USD",
      ownerType: "group",
      ownerGroupId: sharedMembership.group_id,
      isShared: true,
    });

    return {
      ...snapshot,
      groupMembershipId: sharedMembership.id,
      groupId: sharedMembership.group_id,
    };
  }

  const { data: roomMember, error: roomMemberError } = await supabase
    .from("room_members")
    .select(
      "id, room_id, user_id, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency"
    )
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (roomMemberError) {
    throw roomMemberError;
  }

  if (!roomMember) {
    return null;
  }

  const snapshot = buildBalanceSnapshot({
    availableBalance: roomMember.individual_available_balance,
    blockedBalance: roomMember.individual_blocked_balance,
    totalBalance: roomMember.individual_total_balance,
    currency: roomMember.individual_currency || "USD",
    ownerType: "user",
    ownerGroupId: null,
    isShared: false,
  });

  return {
    ...snapshot,
    roomMemberId: roomMember.id,
  };
};

export async function fetchRoomMembers(roomId) {
  const { data, error } = await supabase
    .from("room_members")
    .select(
      "id, room_id, user_id, role_in_room, state, joined_at, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency, profile:profiles(*)"
    )
    .eq("room_id", roomId)
    .eq("state", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map((entry) => ({
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
    profile: mapProfile(entry.profile),
  }));
}

export async function fetchRoomSimAccounts(roomId) {
  const [roomMembersResult, groupMembershipsResult] = await Promise.all([
    supabase
      .from("room_members")
      .select(
        "id, room_id, user_id, role_in_room, state, joined_at, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency"
      )
      .eq("room_id", roomId)
      .eq("state", "active")
      .order("joined_at", { ascending: true }),
    supabase
      .from("room_group_members")
      .select(
        "id, room_id, group_id, user_id, state, group_available_balance, group_blocked_balance, group_total_balance, group_currency, group:room_groups(id, state)"
      )
      .eq("room_id", roomId)
      .eq("state", "active"),
  ]);

  const studentMembers = roomMembersResult.data || [];
  const studentMembersError = roomMembersResult.error;

  if (studentMembersError) {
    throw studentMembersError;
  }

  if (groupMembershipsResult.error) {
    console.warn("fetchRoomSimAccounts group memberships warning", groupMembershipsResult.error);
  }

  const activeGroupMembershipByUserId = new Map(
    ((groupMembershipsResult.data || []) || [])
      .filter((membership) => String(membership.group?.state || "").toLowerCase() === "active")
      .map((membership) => [membership.user_id, membership])
  );

  return (studentMembers || []).map((studentMember) =>
    mapRoomMemberBalanceAccount(
      studentMember,
      activeGroupMembershipByUserId.get(studentMember.user_id) || null
    )
  );
}

export async function adjustStudentRoomBalance({
  roomId,
  studentUserId,
  teacherId,
  adjustmentType,
  adjustmentAmount,
  reason,
}) {
  const currentSnapshot = await resolveEffectiveRoomMemberBalance({
    roomId,
    userId: studentUserId,
  });

  if (!currentSnapshot) {
    throw new Error("No se encontro una cuenta activa para el estudiante en la sala.");
  }

  const previousBalance = currentSnapshot.availableBalance;
  const numericAdjustment = Number(adjustmentAmount ?? 0);
  const nextBalance =
    adjustmentType === "reset"
      ? numericAdjustment
      : previousBalance + numericAdjustment;

  await setStudentRoomBalance({
    roomId,
    userId: studentUserId,
    availableBalance: nextBalance,
  });

  const { error: adjustmentError } = await supabase.from("balance_adjustments").insert({
    room_id: roomId,
    user_id: studentUserId,
    teacher_id: teacherId,
    adjustment_type: adjustmentType,
    previous_balance: previousBalance,
    adjustment_amount: numericAdjustment,
    new_balance: nextBalance,
    reason: reason?.trim() || "",
  });

  if (adjustmentError) {
    throw adjustmentError;
  }

  return {
    previousBalance,
    newBalance: nextBalance,
  };
}

export async function setStudentRoomBalance({
  roomId,
  userId,
  availableBalance,
}) {
  const sharedMembership = await findActiveGroupMembershipWithBalance({
    roomId,
    userId,
  });

  const nextAvailable = Number(availableBalance ?? 0);
  if (sharedMembership) {
    const blockedBalance = toMoney(sharedMembership.group_blocked_balance, 0);
    const nextTotal = nextAvailable + blockedBalance;
    const nextCurrency = sharedMembership.group_currency || "USD";

    const { error: updateError } = await supabase
      .from("room_group_members")
      .update({
        group_available_balance: nextAvailable,
        group_total_balance: nextTotal,
        group_currency: nextCurrency,
        group_equity: nextTotal,
      })
      .eq("room_id", roomId)
      .eq("group_id", sharedMembership.group_id)
      .eq("state", "active");

    if (updateError) {
      throw updateError;
    }

    return {
      availableBalance: nextAvailable,
      blockedBalance,
      totalBalance: nextTotal,
      currency: nextCurrency,
      ownerType: "group",
      ownerGroupId: sharedMembership.group_id,
      isShared: true,
    };
  }

  const { data: roomMember, error: roomMemberError } = await supabase
    .from("room_members")
    .select(
      "id, room_id, user_id, individual_blocked_balance, individual_currency"
    )
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (roomMemberError) {
    throw roomMemberError;
  }

  const blockedBalance = toMoney(roomMember?.individual_blocked_balance, 0);
  const nextTotal = nextAvailable + blockedBalance;
  const nextCurrency = roomMember?.individual_currency || "USD";

  if (roomMember?.id) {
    const { error: updateError } = await supabase
      .from("room_members")
      .update({
        individual_available_balance: nextAvailable,
        individual_total_balance: nextTotal,
        individual_currency: nextCurrency,
        individual_equity: nextTotal,
      })
      .eq("id", roomMember.id);

    if (updateError) {
      throw updateError;
    }
  }

  return {
    availableBalance: nextAvailable,
    blockedBalance,
    totalBalance: nextTotal,
    currency: nextCurrency,
    ownerType: "user",
    ownerGroupId: null,
    isShared: false,
  };
}

export async function fetchRoomBalanceAdjustments(roomId) {
  const { data, error } = await supabase
    .from("balance_adjustments")
    .select("*, student:profiles!balance_adjustments_user_id_fkey(user_id, name, email), teacher:profiles!balance_adjustments_teacher_id_fkey(user_id, name, email)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((entry) => ({
    id: entry.id,
    roomId: entry.room_id,
    userId: entry.user_id,
    teacherId: entry.teacher_id,
    adjustmentType: entry.adjustment_type,
    previousBalance: Number(entry.previous_balance ?? 0),
    adjustmentAmount: Number(entry.adjustment_amount ?? 0),
    newBalance: Number(entry.new_balance ?? 0),
    reason: entry.reason || "",
    createdAt: entry.created_at,
    student: entry.student
      ? {
          id: entry.student.user_id,
          name: entry.student.name || "",
          email: entry.student.email || "",
        }
      : null,
    teacher: entry.teacher
      ? {
          id: entry.teacher.user_id,
          name: entry.teacher.name || "",
          email: entry.teacher.email || "",
        }
      : null,
  }));
}




