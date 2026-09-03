const ROOM_SETTINGS_STORAGE_KEY = "gtlRoomSettingsByRoomId";

export const ROOM_SETTINGS_DEFAULTS = {
  allowRanking: true,
  allowGrades: true,
  portfolioVisibility: "teacher_only",
  allowedMarkets: ["forex", "crypto"],
  coverImageUrl: "",
  operationStartDate: null,
  operationCloseDate: null,
};

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readRoomSettingsStore = () => {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ROOM_SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("readRoomSettingsStore error", error);
    return {};
  }
};

const writeRoomSettingsStore = (value) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(ROOM_SETTINGS_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn("writeRoomSettingsStore error", error);
  }
};

const normalizeMarkets = (value) => {
  if (!Array.isArray(value)) {
    return [...ROOM_SETTINGS_DEFAULTS.allowedMarkets];
  }

  const cleaned = value
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);

  return cleaned.length ? cleaned : [...ROOM_SETTINGS_DEFAULTS.allowedMarkets];
};

const normalizeRoomSettings = (settings = {}) => {
  return {
    ...ROOM_SETTINGS_DEFAULTS,
    ...settings,
    allowRanking: settings.allowRanking ?? ROOM_SETTINGS_DEFAULTS.allowRanking,
    allowGrades: settings.allowGrades ?? ROOM_SETTINGS_DEFAULTS.allowGrades,
    portfolioVisibility: settings.portfolioVisibility || ROOM_SETTINGS_DEFAULTS.portfolioVisibility,
    allowedMarkets: normalizeMarkets(settings.allowedMarkets),
    coverImageUrl: settings.coverImageUrl || "",
    operationStartDate: settings.operationStartDate || null,
    operationCloseDate: settings.operationCloseDate || null,
  };
};

export const readRoomSettings = (roomId) => {
  if (!roomId) {
    return { ...ROOM_SETTINGS_DEFAULTS };
  }

  const store = readRoomSettingsStore();
  return normalizeRoomSettings(store[roomId] || {});
};

export const persistRoomSettings = (roomId, updates = {}) => {
  if (!roomId) {
    return { ...ROOM_SETTINGS_DEFAULTS };
  }

  const store = readRoomSettingsStore();
  const current = normalizeRoomSettings(store[roomId] || {});
  const nextValue = normalizeRoomSettings({
    ...current,
    ...updates,
  });

  writeRoomSettingsStore({
    ...store,
    [roomId]: nextValue,
  });

  return nextValue;
};

export const mergeRoomWithSettings = (room) => {
  if (!room?.id) {
    return room;
  }

  const localSettings = readRoomSettings(room.id);
  return {
    ...room,
    allowRanking: room.allowRanking ?? localSettings.allowRanking,
    allowGrades: room.allowGrades ?? localSettings.allowGrades,
    portfolioVisibility: room.portfolioVisibility || localSettings.portfolioVisibility,
    allowedMarkets: normalizeMarkets(room.allowedMarkets ?? localSettings.allowedMarkets),
    coverImageUrl: room.coverImageUrl || localSettings.coverImageUrl || "",
    operationStartDate: room.operationStartDate || room.startDate || localSettings.operationStartDate || null,
    operationCloseDate: room.operationCloseDate || room.endDate || localSettings.operationCloseDate || null,
  };
};

