import { getCachedSupabaseAccessToken, supabase } from "@/lib/supabase";
import { getBackendUrl } from "@/lib/env";
import { getAccessToken } from "@/lib/auth-api";

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
  balance,
  initial_balance,
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
    balance: Number(profile.balance ?? 0),
    initialBalance: Number(profile.initial_balance ?? 0),
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
  balance: user.balance ?? 0,
  initial_balance: user.initialBalance ?? user.balance ?? 0,
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
  const accessToken = await getAccessToken().catch(() => null);

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
  createdBy: room.created_by,
  createdAt: room.created_at,
  updatedAt: room.updated_at,
});

const VALID_ROOM_STATES = new Set(["active", "inactive", "deleted"]);

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
  const accessToken = await getAccessToken().catch(() => null);

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
  const normalizedCode = accessCode.trim().toUpperCase();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("access_code", normalizedCode)
    .eq("state", "active")
    .maybeSingle();

  if (roomError) {
    throw roomError;
  }

  if (!room) {
    throw new Error("No se encontro una sala activa con ese codigo.");
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

  const { error: accountError } = await supabase
    .from("student_sim_accounts")
    .upsert(
      {
        room_id: room.id,
        user_id: userId,
        available_balance: room.default_balance,
        blocked_balance: 0,
        total_balance: room.default_balance,
        currency: room.default_currency,
        state: "active",
      },
      { onConflict: "room_id,user_id" }
    );

  if (accountError) {
    throw accountError;
  }

  return mapRoomRecord(room);
}

export async function leaveRoom({ roomId, userId }) {
  const { error: membershipError } = await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (membershipError) {
    throw membershipError;
  }

  const { error: accountError } = await supabase
    .from("student_sim_accounts")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (accountError) {
    throw accountError;
  }

  return true;
}

export async function updateRoomState(roomId, nextState) {
  if (!VALID_ROOM_STATES.has(nextState)) {
    throw new Error("Estado de sala invalido.");
  }

  const { data, error } = await supabase
    .from("rooms")
    .update({
      state: nextState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRoomRecord(data);
}

export async function updateRoomDetails({
  roomId,
  name,
  description,
  state,
  defaultBalance,
  defaultCurrency,
}) {
  if (!roomId) {
    throw new Error("Sala no disponible.");
  }

  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("El nombre de la sala es obligatorio.");
  }

  if (!VALID_ROOM_STATES.has(state)) {
    throw new Error("Estado de sala invalido.");
  }

  const payload = {
    name: trimmedName,
    description: String(description || "").trim(),
    state,
    updated_at: new Date().toISOString(),
  };

  if (defaultBalance !== undefined) {
    payload.default_balance = Number(defaultBalance);
  }

  if (defaultCurrency) {
    payload.default_currency = String(defaultCurrency).trim().toUpperCase();
  }

  const { data, error } = await supabase
    .from("rooms")
    .update(payload)
    .eq("id", roomId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRoomRecord(data);
}

const mapSimAccount = (account) => ({
  id: account.id,
  roomId: account.room_id,
  userId: account.user_id,
  availableBalance: Number(account.available_balance ?? 0),
  blockedBalance: Number(account.blocked_balance ?? 0),
  totalBalance: Number(account.total_balance ?? 0),
  currency: account.currency || "USD",
  state: account.state,
  createdAt: account.created_at,
  updatedAt: account.updated_at,
});

export async function fetchRoomMembers(roomId) {
  const { data, error } = await supabase
    .from("room_members")
    .select("id, room_id, user_id, role_in_room, state, joined_at, profile:profiles(*)")
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
    profile: mapProfile(entry.profile),
  }));
}

export async function fetchRoomSimAccounts(roomId) {
  const { data, error } = await supabase
    .from("student_sim_accounts")
    .select("*")
    .eq("room_id", roomId);

  if (error) {
    throw error;
  }

  return data.map(mapSimAccount);
}

export async function adjustStudentRoomBalance({
  roomId,
  studentUserId,
  teacherId,
  adjustmentType,
  adjustmentAmount,
  reason,
}) {
  const { data: account, error: accountError } = await supabase
    .from("student_sim_accounts")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", studentUserId)
    .single();

  if (accountError) {
    throw accountError;
  }

  const previousBalance = Number(account.available_balance ?? 0);
  const numericAdjustment = Number(adjustmentAmount ?? 0);
  const nextBalance =
    adjustmentType === "reset"
      ? numericAdjustment
      : previousBalance + numericAdjustment;

  const { error: updateError } = await supabase
    .from("student_sim_accounts")
    .update({
      available_balance: nextBalance,
      total_balance: nextBalance + Number(account.blocked_balance ?? 0),
    })
    .eq("id", account.id);

  if (updateError) {
    throw updateError;
  }

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
  const { data: account, error: accountError } = await supabase
    .from("student_sim_accounts")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single();

  if (accountError) {
    throw accountError;
  }

  const blockedBalance = Number(account.blocked_balance ?? 0);
  const nextAvailable = Number(availableBalance ?? 0);
  const nextTotal = nextAvailable + blockedBalance;

  const { error: updateError } = await supabase
    .from("student_sim_accounts")
    .update({
      available_balance: nextAvailable,
      total_balance: nextTotal,
    })
    .eq("id", account.id);

  if (updateError) {
    throw updateError;
  }

  return {
    availableBalance: nextAvailable,
    blockedBalance,
    totalBalance: nextTotal,
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




