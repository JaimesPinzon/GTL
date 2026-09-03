export const DEFAULT_BALANCE = 0;
export const DEFAULT_APP_HOME_PATH = "/plataforma";
export const CLIENT_PROFILE_STORAGE_KEY = "gtlProfileExtras";
export const CLIENT_SECURITY_STORAGE_KEY = "gtlSecurityExtras";
export const CLIENT_NOTIFICATION_STORAGE_KEY = "gtlNotificationExtras";
export const CLIENT_APPEARANCE_STORAGE_KEY = "gtlAppearanceExtras";
export const CLIENT_MEMBERSHIP_STORAGE_KEY = "gtlMembershipExtras";
export const CLIENT_PREFERENCES_STORAGE_KEY = "gtlPreferencesExtras";
export const CLIENT_ACCESSIBILITY_STORAGE_KEY = "gtlAccessibilityExtras";
export const CLIENT_PRIVACY_STORAGE_KEY = "gtlPrivacyExtras";
export const CLIENT_ROOM_STORAGE_KEY = "gtlRoomExtras";

export const CLIENT_PROFILE_DEFAULTS = {
  username: "",
  phone: "",
  city: "",
  region: "",
  gender: "",
  bio: "",
  institution: "",
  academicProgram: "",
  studentCode: "",
  semesterLevel: "",
  mainTeacher: "",
  tradingExperience: "",
  documentId: "",
  lastLoginAt: "",
};

export const CLIENT_SECURITY_DEFAULTS = {
  twoFactorEmail: true,
  twoFactorAuthenticator: false,
  twoFactorSms: false,
  notifyNewDevice: true,
  recoveryEmail: "",
  activeSessions: [],
  loginHistory: [],
  lastPasswordChangedAt: "",
  temporarilyDisabled: false,
};

export const CLIENT_NOTIFICATION_DEFAULTS = {
  emailEnabled: true,
  inAppEnabled: true,
  soundsEnabled: true,
  popupsEnabled: true,
  digestFrequency: "daily",
  categories: {
    academic: true,
    financial: true,
    administrative: true,
    security: true,
  },
  alerts: {
    academicActivity: true,
    roomAlerts: true,
    grades: true,
    forums: true,
    lowBalance: true,
    activityOpenClose: true,
    maintenance: true,
  },
};

export const CLIENT_APPEARANCE_DEFAULTS = {
  themeMode: "dark",
  primaryColor: "#3b82f6",
  secondaryColor: "#0f172a",
  borderStyle: "rounded",
  fontSize: "medium",
  componentSize: "medium",
  dashboardStyle: "technical",
  homeWidgets: {
    portfolio: true,
    activeRooms: true,
    pendingActivities: true,
    news: false,
    ranking: true,
    watchlist: true,
  },
  homeWidgetOrder: [
    "portfolio",
    "activeRooms",
    "pendingActivities",
    "ranking",
    "watchlist",
    "news",
  ],
};

export const CLIENT_MEMBERSHIP_DEFAULTS = {
  currentPlan: "Gratis",
  planStartedAt: "",
  planExpiresAt: "",
  billingStatus: "Sin facturacion activa",
  paymentMethod: "No aplica",
  autoRenew: false,
  paymentHistory: [],
};

export const CLIENT_PREFERENCES_DEFAULTS = {
  interfaceLanguage: "es",
  timezone: "(UTC-05:00) Bogota",
  dateFormat: "DD/MM/YYYY",
  hourFormat: "24h",
  numberFormat: "es-CO",
  preferredCurrency: "USD",
  defaultHomePage: DEFAULT_APP_HOME_PATH,
  defaultActiveRoomId: "",
  defaultDashboardView: "technical",
  tablePageSize: "10",
  notificationSounds: true,
  contextualHelpMessages: true,
};

export const CLIENT_ACCESSIBILITY_DEFAULTS = {
  highContrast: false,
  reducedMotion: false,
  keyboardNavigation: true,
  screenReaderFriendly: false,
  colorBlindSafe: false,
  underlineLinks: false,
  strongFocusIndicators: false,
};

export const CLIENT_PRIVACY_DEFAULTS = {
  profileVisibility: "members",
  fullNameVisibility: "teachers",
  aliasVisibility: "members",
  portfolioVisibility: "teachers",
  performanceVisibility: "teachers",
  forumParticipationVisibility: "members",
  appearInRankings: true,
  shareStatistics: false,
  dataConsentGranted: true,
  dataConsentUpdatedAt: "",
  dataDeletionRequestedAt: "",
};

export const CLIENT_ROOM_DEFAULTS = {
  history: [],
};

export const pickClientProfileFields = (source = {}) => ({
  username: source.username ?? "",
  phone: source.phone ?? "",
  city: source.city ?? "",
  region: source.region ?? "",
  gender: source.gender ?? "",
  bio: source.bio ?? "",
  institution: source.institution ?? "",
  academicProgram: source.academicProgram ?? "",
  studentCode: source.studentCode ?? "",
  semesterLevel: source.semesterLevel ?? "",
  mainTeacher: source.mainTeacher ?? "",
  tradingExperience: source.tradingExperience ?? "",
  documentId: source.documentId ?? "",
  lastLoginAt: source.lastLoginAt ?? "",
});

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readClientProfileStore = () => {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CLIENT_PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("No se pudo leer el almacenamiento local del perfil:", error);
    return {};
  }
};

const writeClientProfileStore = (value) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(CLIENT_PROFILE_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn("No se pudo guardar el almacenamiento local del perfil:", error);
  }
};

export const readClientProfileExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_PROFILE_DEFAULTS };
  }

  const store = readClientProfileStore();
  return {
    ...CLIENT_PROFILE_DEFAULTS,
    ...(store[userId] || {}),
  };
};

export const persistClientProfileExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_PROFILE_DEFAULTS };
  }

  const store = readClientProfileStore();
  const nextValue = {
    ...CLIENT_PROFILE_DEFAULTS,
    ...(store[userId] || {}),
    ...pickClientProfileFields(updates),
  };

  writeClientProfileStore({
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

const readStorageRecord = (storageKey) => {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("No se pudo leer un almacenamiento local:", error);
    return {};
  }
};

const writeStorageRecord = (storageKey, value) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.warn("No se pudo guardar un almacenamiento local:", error);
  }
};

export const readClientSecurityExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_SECURITY_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_SECURITY_STORAGE_KEY);
  return {
    ...CLIENT_SECURITY_DEFAULTS,
    ...(store[userId] || {}),
  };
};

export const persistClientSecurityExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_SECURITY_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_SECURITY_STORAGE_KEY);
  const nextValue = {
    ...CLIENT_SECURITY_DEFAULTS,
    ...(store[userId] || {}),
    ...updates,
  };

  writeStorageRecord(CLIENT_SECURITY_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientNotificationExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_NOTIFICATION_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_NOTIFICATION_STORAGE_KEY);
  return {
    ...CLIENT_NOTIFICATION_DEFAULTS,
    ...(store[userId] || {}),
    categories: {
      ...CLIENT_NOTIFICATION_DEFAULTS.categories,
      ...(store[userId]?.categories || {}),
    },
    alerts: {
      ...CLIENT_NOTIFICATION_DEFAULTS.alerts,
      ...(store[userId]?.alerts || {}),
    },
  };
};

export const persistClientNotificationExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_NOTIFICATION_DEFAULTS };
  }

  const current = readClientNotificationExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
    categories: {
      ...current.categories,
      ...(updates.categories || {}),
    },
    alerts: {
      ...current.alerts,
      ...(updates.alerts || {}),
    },
  };

  const store = readStorageRecord(CLIENT_NOTIFICATION_STORAGE_KEY);
  writeStorageRecord(CLIENT_NOTIFICATION_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientAppearanceExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_APPEARANCE_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_APPEARANCE_STORAGE_KEY);
  return {
    ...CLIENT_APPEARANCE_DEFAULTS,
    ...(store[userId] || {}),
    homeWidgets: {
      ...CLIENT_APPEARANCE_DEFAULTS.homeWidgets,
      ...(store[userId]?.homeWidgets || {}),
    },
    homeWidgetOrder:
      store[userId]?.homeWidgetOrder || CLIENT_APPEARANCE_DEFAULTS.homeWidgetOrder,
  };
};

export const persistClientAppearanceExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_APPEARANCE_DEFAULTS };
  }

  const current = readClientAppearanceExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
    homeWidgets: {
      ...current.homeWidgets,
      ...(updates.homeWidgets || {}),
    },
    homeWidgetOrder: updates.homeWidgetOrder || current.homeWidgetOrder,
  };

  const store = readStorageRecord(CLIENT_APPEARANCE_STORAGE_KEY);
  writeStorageRecord(CLIENT_APPEARANCE_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientMembershipExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_MEMBERSHIP_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_MEMBERSHIP_STORAGE_KEY);
  return {
    ...CLIENT_MEMBERSHIP_DEFAULTS,
    ...(store[userId] || {}),
    paymentHistory: store[userId]?.paymentHistory || [],
  };
};

export const persistClientMembershipExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_MEMBERSHIP_DEFAULTS };
  }

  const current = readClientMembershipExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
    paymentHistory: updates.paymentHistory || current.paymentHistory,
  };

  const store = readStorageRecord(CLIENT_MEMBERSHIP_STORAGE_KEY);
  writeStorageRecord(CLIENT_MEMBERSHIP_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientPreferencesExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_PREFERENCES_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_PREFERENCES_STORAGE_KEY);
  return {
    ...CLIENT_PREFERENCES_DEFAULTS,
    ...(store[userId] || {}),
  };
};

export const persistClientPreferencesExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_PREFERENCES_DEFAULTS };
  }

  const current = readClientPreferencesExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
  };

  const store = readStorageRecord(CLIENT_PREFERENCES_STORAGE_KEY);
  writeStorageRecord(CLIENT_PREFERENCES_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientAccessibilityExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_ACCESSIBILITY_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_ACCESSIBILITY_STORAGE_KEY);
  const preferenceStore = readStorageRecord(CLIENT_PREFERENCES_STORAGE_KEY);

  return {
    ...CLIENT_ACCESSIBILITY_DEFAULTS,
    ...(store[userId] || {}),
    reducedMotion:
      store[userId]?.reducedMotion ??
      preferenceStore[userId]?.reducedMotion ??
      CLIENT_ACCESSIBILITY_DEFAULTS.reducedMotion,
  };
};

export const persistClientAccessibilityExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_ACCESSIBILITY_DEFAULTS };
  }

  const current = readClientAccessibilityExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
  };

  const store = readStorageRecord(CLIENT_ACCESSIBILITY_STORAGE_KEY);
  writeStorageRecord(CLIENT_ACCESSIBILITY_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientPrivacyExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_PRIVACY_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_PRIVACY_STORAGE_KEY);
  return {
    ...CLIENT_PRIVACY_DEFAULTS,
    ...(store[userId] || {}),
  };
};

export const persistClientPrivacyExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_PRIVACY_DEFAULTS };
  }

  const current = readClientPrivacyExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
  };

  const store = readStorageRecord(CLIENT_PRIVACY_STORAGE_KEY);
  writeStorageRecord(CLIENT_PRIVACY_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const readClientRoomExtras = (userId) => {
  if (!userId) {
    return { ...CLIENT_ROOM_DEFAULTS };
  }

  const store = readStorageRecord(CLIENT_ROOM_STORAGE_KEY);
  return {
    ...CLIENT_ROOM_DEFAULTS,
    ...(store[userId] || {}),
    history: store[userId]?.history || [],
  };
};

export const persistClientRoomExtras = (userId, updates = {}) => {
  if (!userId) {
    return { ...CLIENT_ROOM_DEFAULTS };
  }

  const current = readClientRoomExtras(userId);
  const nextValue = {
    ...current,
    ...updates,
    history: updates.history || current.history,
  };

  const store = readStorageRecord(CLIENT_ROOM_STORAGE_KEY);
  writeStorageRecord(CLIENT_ROOM_STORAGE_KEY, {
    ...store,
    [userId]: nextValue,
  });

  return nextValue;
};

export const appendClientRoomHistory = (userId, room, metadata = {}) => {
  if (!userId || !room?.id) {
    return { ...CLIENT_ROOM_DEFAULTS };
  }

  const current = readClientRoomExtras(userId);
  const nextEntry = {
    id: room.id,
    name: room.name || "Sala",
    accessCode: room.accessCode || "",
    description: room.description || "",
    state: metadata.state || room.state || "archived",
    membershipRole: metadata.membershipRole || room.membershipRole || "student",
    membershipState: metadata.membershipState || room.membershipState || "left",
    joinedAt: metadata.joinedAt || room.joinedAt || "",
    leftAt: metadata.leftAt || new Date().toISOString(),
    createdAt: room.createdAt || "",
    updatedAt: metadata.updatedAt || new Date().toISOString(),
  };

  const history = [
    nextEntry,
    ...current.history.filter((entry) => entry.id !== room.id),
  ].slice(0, 24);

  return persistClientRoomExtras(userId, { history });
};

export const buildSessionRecord = ({
  sessionId,
  deviceLabel,
  location = "Ubicacion no disponible",
  status = "active",
  lastSeenAt,
  createdAt,
} = {}) => ({
  id:
    sessionId ||
    `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  deviceLabel:
    deviceLabel ||
    (typeof navigator !== "undefined" ? navigator.userAgent : "Dispositivo actual"),
  location,
  status,
  createdAt: createdAt || new Date().toISOString(),
  lastSeenAt: lastSeenAt || new Date().toISOString(),
});

export const registerSecurityLoginEvent = (userId, metadata = {}) => {
  if (!userId) {
    return { ...CLIENT_SECURITY_DEFAULTS };
  }

  const current = readClientSecurityExtras(userId);
  const nextSession = buildSessionRecord(metadata);
  const activeSessions = [
    nextSession,
    ...current.activeSessions.filter((session) => session.id !== nextSession.id),
  ].slice(0, 5);

  const loginHistory = [
    {
      id: `login_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: nextSession.lastSeenAt,
      deviceLabel: nextSession.deviceLabel,
      location: nextSession.location,
      status: metadata.status || "success",
      isNewDevice: metadata.isNewDevice ?? false,
    },
    ...current.loginHistory,
  ].slice(0, 12);

  return persistClientSecurityExtras(userId, {
    ...current,
    activeSessions,
    loginHistory,
  });
};

export const buildTradingUser = (authUser, existingUser = {}, overrides = {}) => {
  const metadata = authUser?.user_metadata || {};
  const fallbackBalance =
    overrides.balance ??
    existingUser.balance ??
    DEFAULT_BALANCE;
  const fallbackInitialBalance =
    overrides.initialBalance ??
    existingUser.initialBalance ??
    fallbackBalance;

  return {
    id: authUser?.id || existingUser.id || overrides.id,
    name: overrides.name ?? metadata.name ?? existingUser.name ?? "",
    email: authUser?.email || existingUser.email || overrides.email || "",
    role: overrides.role ?? metadata.role ?? existingUser.role ?? "student",
    balance: fallbackBalance,
    initialBalance: fallbackInitialBalance,
    alias: overrides.alias ?? existingUser.alias ?? "",
    lastName: overrides.lastName ?? existingUser.lastName ?? "",
    dob: overrides.dob ?? existingUser.dob ?? "",
    country: overrides.country ?? existingUser.country ?? "",
    address: overrides.address ?? existingUser.address ?? "",
    avatar: overrides.avatar ?? existingUser.avatar ?? "",
    username: overrides.username ?? existingUser.username ?? "",
    phone: overrides.phone ?? existingUser.phone ?? "",
    city: overrides.city ?? existingUser.city ?? "",
    region: overrides.region ?? existingUser.region ?? "",
    gender: overrides.gender ?? existingUser.gender ?? "",
    bio: overrides.bio ?? existingUser.bio ?? "",
    institution: overrides.institution ?? existingUser.institution ?? "",
    academicProgram: overrides.academicProgram ?? existingUser.academicProgram ?? "",
    studentCode: overrides.studentCode ?? existingUser.studentCode ?? "",
    semesterLevel: overrides.semesterLevel ?? existingUser.semesterLevel ?? "",
    mainTeacher: overrides.mainTeacher ?? existingUser.mainTeacher ?? "",
    tradingExperience: overrides.tradingExperience ?? existingUser.tradingExperience ?? "",
    documentId: overrides.documentId ?? existingUser.documentId ?? "",
    language: overrides.language ?? existingUser.language ?? metadata.language ?? "es",
    timezone: overrides.timezone ?? existingUser.timezone ?? "(UTC-05:00) Bogota",
    plan: overrides.plan ?? existingUser.plan ?? "Gratis",
    verified: overrides.verified ?? existingUser.verified ?? false,
    createdAt: overrides.createdAt ?? existingUser.createdAt ?? authUser?.created_at ?? "",
    lastLoginAt:
      overrides.lastLoginAt ??
      existingUser.lastLoginAt ??
      authUser?.last_sign_in_at ??
      "",
    positions: overrides.positions ?? existingUser.positions ?? [],
    transactions: overrides.transactions ?? existingUser.transactions ?? [],
  };
};

export const upsertTradingUser = (users, nextUser) => {
  const existingIndex = users.findIndex(
    (user) => user.id === nextUser.id || user.email === nextUser.email
  );

  if (existingIndex === -1) {
    return [...users, nextUser];
  }

  return users.map((user, index) => (index === existingIndex ? nextUser : user));
};
