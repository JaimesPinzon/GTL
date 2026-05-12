import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAuthManager } from "@/hooks/useAuthManager";
import { usePortfolioManager } from "@/hooks/usePortfolioManager";
import { useTranslation } from "react-i18next";
import { restoreSession, subscribeToAuthEvents } from "@/lib/auth-api";
import { clearSupabaseAuthStorage, supabase } from "@/lib/supabase";
import {
  adjustStudentRoomBalance,
  createRoom,
  deleteCurrentAccount,
  fetchAccessibleProfiles,
  fetchPortfolio,
  fetchProfile,
  fetchRoomHistory,
  fetchRoomMembers,
  fetchRoomSimAccounts,
  fetchStudentRooms,
  fetchTeacherRooms,
  joinRoomByCode,
  leaveRoom,
  setStudentRoomBalance,
  syncPortfolio,
  updateRoomDetails,
  updateRoomState,
  updateAuthIdentity,
  upsertProfile,
} from "@/lib/trading-db";
import {
  appendClientRoomHistory,
  buildTradingUser,
  persistClientAccessibilityExtras,
  persistClientAppearanceExtras,
  persistClientMembershipExtras,
  persistClientNotificationExtras,
  persistClientPreferencesExtras,
  persistClientPrivacyExtras,
  persistClientSecurityExtras,
  readClientAccessibilityExtras,
  readClientAppearanceExtras,
  readClientMembershipExtras,
  readClientNotificationExtras,
  readClientPreferencesExtras,
  readClientPrivacyExtras,
  readClientRoomExtras,
  persistClientProfileExtras,
  readClientSecurityExtras,
  readClientProfileExtras,
} from "@/lib/trading-profile";

const TradingContext = createContext({});
const SESSION_STORAGE_KEYS = [
  "allTradingUsers",
  "currentTradingUserId",
  "activeTradingSimulation",
  "activeTradingRoomId",
];
const ACCESSIBLE_ROOMS_STORAGE_KEY = "gtl.accessible-rooms";

const readCachedAccessibleRooms = (userId) => {
  if (!userId || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACCESSIBLE_ROOMS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return Array.isArray(parsed?.[userId]) ? parsed[userId] : [];
  } catch (error) {
    console.warn("readCachedAccessibleRooms error", error);
    return [];
  }
};

const persistCachedAccessibleRooms = (userId, rooms) => {
  if (!userId || typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(ACCESSIBLE_ROOMS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(
      ACCESSIBLE_ROOMS_STORAGE_KEY,
      JSON.stringify({
        ...parsed,
        [userId]: Array.isArray(rooms) ? rooms : [],
      })
    );
  } catch (error) {
    console.warn("persistCachedAccessibleRooms error", error);
  }
};

const isRecoverableSupabaseAuthError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("lock broken by another request") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("load failed")
  );
};

const normalizeAppLanguage = (value) => {
  if (typeof value !== "string") {
    return "es";
  }

  const normalizedValue = value.toLowerCase();
  return normalizedValue.startsWith("en") ? "en" : "es";
};

const buildConnectionIssue = (error, t) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (isOffline) {
    return {
      title: t("app.connection.offlineTitle"),
      description: t("app.connection.offlineDescription"),
    };
  }

  return {
    title: t("app.connection.networkErrorTitle"),
    description: t("app.connection.networkErrorDescription"),
    details: message,
  };
};

export const useTradingContext = () => useContext(TradingContext);

export const TradingProvider = ({ children }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const [allUsers, setAllUsers] = useLocalStorage("allTradingUsers", []);
  const [currentUserId, setCurrentUserId] = useLocalStorage("currentTradingUserId", null);
  const [activeRoomId, setActiveRoomId] = useLocalStorage("activeTradingRoomId", null);
  const [currentUser, setCurrentUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomAccounts, setRoomAccounts] = useState([]);
  const [roomPortfolios, setRoomPortfolios] = useState({});
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [connectionIssue, setConnectionIssue] = useState(null);
  const [securityState, setSecurityState] = useState(null);
  const [notificationState, setNotificationState] = useState(null);
  const [appearanceState, setAppearanceState] = useState(null);
  const [membershipState, setMembershipState] = useState(null);
  const [preferencesState, setPreferencesState] = useState(null);
  const [accessibilityState, setAccessibilityState] = useState(null);
  const [privacyState, setPrivacyState] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const isLoggingOutRef = useRef(false);
  const currentUserIdRef = useRef(currentUserId);
  const authBootstrapStartedRef = useRef(false);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const symbolTemplates = useMemo(
    () => [
      { id: "AAPL", nameKey: "trading.assets.apple", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.018 },
      { id: "MSFT", nameKey: "trading.assets.microsoft", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.017 },
      { id: "AMZN", nameKey: "trading.assets.amazon", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.022 },
      { id: "GOOGL", nameKey: "trading.assets.alphabet", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.019 },
      { id: "NVDA", nameKey: "trading.assets.nvidia", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.03 },
      { id: "TSLA", nameKey: "trading.assets.tesla", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.032 },
      { id: "META", nameKey: "trading.assets.meta", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.021 },
      { id: "BRK.B", nameKey: "trading.assets.berkshire", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.011 },
      { id: "JPM", nameKey: "trading.assets.jpmorgan", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.016 },
      { id: "JNJ", nameKey: "trading.assets.johnson", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.012 },
      { id: "QQQ", nameKey: "trading.assets.qqq", currency: "USD", type: "etf", exchangeLabel: "NASDAQ", baseVolatility: 0.014 },
      { id: "DIA", nameKey: "trading.assets.dia", currency: "USD", type: "etf", exchangeLabel: "NYSE Arca", baseVolatility: 0.011 },
      { id: "SPY", nameKey: "trading.assets.spy", currency: "USD", type: "etf", exchangeLabel: "NYSE Arca", baseVolatility: 0.012 },
      { id: "BTCUSD", nameKey: "trading.assets.bitcoin", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.03 },
      { id: "ETHUSD", nameKey: "trading.assets.ethereum", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.04 },
      { id: "NU", nameKey: "trading.assets.nuHoldings", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.025 },
      { id: "XRPUSD", nameKey: "trading.assets.ripple", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.05 },
      { id: "ADAUSD", nameKey: "trading.assets.cardano", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.045 },
      { id: "SOLUSD", nameKey: "trading.assets.solana", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.055 },
    ],
    []
  );

  const loadTradingState = useCallback(
    async (authUserOrId) => {
      const userId =
        typeof authUserOrId === "string" ? authUserOrId : authUserOrId?.id;

      if (!userId) {
        setCurrentUser(null);
        setSecurityState(null);
        setNotificationState(null);
        setAppearanceState(null);
        setMembershipState(null);
        setPreferencesState(null);
        setAccessibilityState(null);
        setPrivacyState(null);
        setRoomState(null);
        setAllUsers([]);
        return;
      }

      const authUser =
        typeof authUserOrId === "string"
          ? (
              await supabase.auth.getUser()
            ).data.user
          : authUserOrId;
      const localProfileExtras = readClientProfileExtras(userId);
      const localSecurityExtras = readClientSecurityExtras(userId);
      const localNotificationExtras = readClientNotificationExtras(userId);
      const localAppearanceExtras = readClientAppearanceExtras(userId);
      const localMembershipExtras = readClientMembershipExtras(userId);
      let localPreferencesExtras = readClientPreferencesExtras(userId);
      const localAccessibilityExtras = readClientAccessibilityExtras(userId);
      const localPrivacyExtras = readClientPrivacyExtras(userId);
      const localRoomExtras = readClientRoomExtras(userId);

      if (authUser) {
        setCurrentUser((previousUser) => ({
          ...buildTradingUser(authUser, localProfileExtras),
          positions: [],
          transactions: [],
        }));
      }

      const fallbackProfile = authUser ? buildTradingUser(authUser, localProfileExtras) : null;
      let profile = null;

      try {
        profile = await fetchProfile(userId);
      } catch (error) {
        console.error("fetchProfile error", error);
      }

      if (!profile) {
        profile = fallbackProfile;
      }

      if (profile) {
        profile = {
          ...profile,
          ...localProfileExtras,
          createdAt: profile.createdAt || authUser?.created_at || "",
          lastLoginAt: authUser?.last_sign_in_at || profile.lastLoginAt || profile.updatedAt || "",
        };
      }

      const resolvedProfileLanguage = normalizeAppLanguage(
        profile?.language ||
          localPreferencesExtras.interfaceLanguage ||
          i18n.resolvedLanguage ||
          i18n.language ||
          "es"
      );

      if (
        normalizeAppLanguage(localPreferencesExtras.interfaceLanguage) !== resolvedProfileLanguage
      ) {
        localPreferencesExtras = persistClientPreferencesExtras(userId, {
          interfaceLanguage: resolvedProfileLanguage,
        });
      }

      if (normalizeAppLanguage(profile?.language) !== resolvedProfileLanguage && profile?.id) {
        profile = {
          ...profile,
          language: resolvedProfileLanguage,
        };
      }

      if (normalizeAppLanguage(i18n.resolvedLanguage) !== resolvedProfileLanguage) {
        await i18n.changeLanguage(resolvedProfileLanguage);
      }

      if (!profile) {
        setCurrentUser(null);
        setSecurityState(null);
        setNotificationState(null);
        setAppearanceState(null);
        setMembershipState(null);
        setPreferencesState(null);
        setAccessibilityState(null);
        setPrivacyState(null);
        setRoomState(null);
        setAllUsers([]);
        setRooms([]);
        setRoomMembers([]);
        setRoomAccounts([]);
        setRoomPortfolios({});
        setActiveRoomId(null);
        return;
      }

      let hydratedUser = {
        ...profile,
        positions: [],
        transactions: [],
      };

      let mergedUsers = [hydratedUser];

      try {
        const accessibleProfiles = await fetchAccessibleProfiles(profile);
        mergedUsers = await Promise.all(
          accessibleProfiles.map(async (profileItem) => {
            if (profileItem.id === hydratedUser.id) {
              return hydratedUser;
            }

            const itemExtras = readClientProfileExtras(profileItem.id);
            return { ...profileItem, ...itemExtras, positions: [], transactions: [] };
          })
        );
      } catch (error) {
        console.error("fetchAccessibleProfiles error", error);
      }

      let accessibleRooms = [];
      const cachedRooms = readCachedAccessibleRooms(hydratedUser.id);
      try {
        accessibleRooms =
          hydratedUser.role === "teacher"
            ? await fetchTeacherRooms(hydratedUser.id)
            : await fetchStudentRooms(hydratedUser.id);
      } catch (error) {
        console.error("fetchAccessibleRooms error", error);
        accessibleRooms = cachedRooms;
      }

      if (accessibleRooms.length === 0 && cachedRooms.length > 0) {
        accessibleRooms = cachedRooms;
      }

      if (accessibleRooms.length > 0) {
        persistCachedAccessibleRooms(hydratedUser.id, accessibleRooms);
      }

      const preferredRoomId =
        localPreferencesExtras?.defaultActiveRoomId &&
        accessibleRooms.find((room) => room.id === localPreferencesExtras.defaultActiveRoomId)?.id;

      const resolvedActiveRoomId =
        accessibleRooms.find((room) => room.id === activeRoomId)?.id ??
        preferredRoomId ??
        null;

      setCurrentUser(hydratedUser);
      setSecurityState(localSecurityExtras);
      setNotificationState(localNotificationExtras);
      setAppearanceState(localAppearanceExtras);
      setMembershipState(localMembershipExtras);
      setPreferencesState(localPreferencesExtras);
      setAccessibilityState(localAccessibilityExtras);
      setPrivacyState(localPrivacyExtras);
      setRoomState(localRoomExtras);
      setAllUsers(mergedUsers);
      setRooms(accessibleRooms);
      setActiveRoomId(resolvedActiveRoomId);
      setRoomMembers([]);
      setRoomAccounts([]);
      setRoomPortfolios({});
    },
    [activeRoomId, i18n, setAllUsers, setActiveRoomId]
  );

  useEffect(() => {
    const syncBrowserNetworkState = () => {
      if (navigator.onLine) {
        setConnectionIssue((current) =>
          current?.title === t("app.connection.offlineTitle") ? null : current
        );
        return;
      }

      setConnectionIssue(buildConnectionIssue(new Error("Browser offline"), t));
    };

    syncBrowserNetworkState();
    window.addEventListener("online", syncBrowserNetworkState);
    window.addEventListener("offline", syncBrowserNetworkState);

    return () => {
      window.removeEventListener("online", syncBrowserNetworkState);
      window.removeEventListener("offline", syncBrowserNetworkState);
    };
  }, [t]);

  const clearSessionState = useCallback(() => {
    isLoggingOutRef.current = true;
    clearSupabaseAuthStorage();
    if (typeof window !== "undefined") {
      SESSION_STORAGE_KEYS.forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      });
    }
    setConnectionIssue(null);
    setCurrentUser(null);
    setSecurityState(null);
    setNotificationState(null);
    setAppearanceState(null);
    setMembershipState(null);
    setPreferencesState(null);
    setAccessibilityState(null);
    setPrivacyState(null);
    setRoomState(null);
    setAllUsers([]);
    setCurrentUserId(null);
    setRooms([]);
    setRoomMembers([]);
    setRoomAccounts([]);
    setRoomPortfolios({});
    setActiveRoomId(null);

    window.setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1500);
  }, [setActiveRoomId, setAllUsers, setCurrentUserId]);

  const syncUserFromAuth = useCallback(
    async (authUser) => {
      if (!authUser) {
        setCurrentUser(null);
        setSecurityState(null);
        setNotificationState(null);
        setAppearanceState(null);
        setMembershipState(null);
        setPreferencesState(null);
        setAccessibilityState(null);
        setPrivacyState(null);
        setRoomState(null);
        setAllUsers([]);
        setRooms([]);
        setRoomMembers([]);
        setRoomAccounts([]);
        setRoomPortfolios({});
        setActiveRoomId(null);
        return null;
      }

      await loadTradingState(authUser);
      return authUser;
    },
    [loadTradingState, setActiveRoomId, setAllUsers]
  );

  const restoreLocalSessionState = useCallback(
    (userId) => {
      if (!userId) {
        return false;
      }

      const persistedUser = allUsers.find((item) => item.id === userId);
      const localProfileExtras = readClientProfileExtras(userId);
      const localPreferencesExtras = readClientPreferencesExtras(userId);
      const resolvedLanguage = normalizeAppLanguage(
        localPreferencesExtras.interfaceLanguage || i18n.resolvedLanguage || i18n.language || "es"
      );

      setCurrentUserId(userId);
      setCurrentUser((previousUser) => ({
        ...(persistedUser || previousUser || { id: userId }),
        ...localProfileExtras,
        language:
          persistedUser?.language ||
          previousUser?.language ||
          resolvedLanguage,
        positions: persistedUser?.positions ?? previousUser?.positions ?? [],
        transactions: persistedUser?.transactions ?? previousUser?.transactions ?? [],
      }));
      setSecurityState(readClientSecurityExtras(userId));
      setNotificationState(readClientNotificationExtras(userId));
      setAppearanceState(readClientAppearanceExtras(userId));
      setMembershipState(readClientMembershipExtras(userId));
      setPreferencesState({
        ...localPreferencesExtras,
        interfaceLanguage: resolvedLanguage,
      });
      setAccessibilityState(readClientAccessibilityExtras(userId));
      setPrivacyState(readClientPrivacyExtras(userId));
      setRoomState(readClientRoomExtras(userId));

      if (normalizeAppLanguage(i18n.resolvedLanguage) !== resolvedLanguage) {
        void i18n.changeLanguage(resolvedLanguage);
      }

      return Boolean(persistedUser || localProfileExtras);
    },
    [allUsers, i18n, setCurrentUserId]
  );

  useEffect(() => {
    let isMounted = true;
    if (authBootstrapStartedRef.current) {
      return undefined;
    }

    authBootstrapStartedRef.current = true;
    const loadingSafetyTimer = window.setTimeout(() => {
      if (!isMounted) {
        return;
      }

      setIsLoadingAuth(false);
    }, 4000);

    const initializeAuth = async () => {
      try {
        const session = await restoreSession();
        const authUser = session?.user ?? null;
        const nextUserId = authUser?.id ?? null;

        if (isLoggingOutRef.current) {
          clearSessionState();
          return;
        }

        setCurrentUserId(nextUserId);
        setConnectionIssue(null);

        if (authUser) {
          await loadTradingState(authUser);
        } else {
          setCurrentUser(null);
          setSecurityState(null);
          setNotificationState(null);
        setAppearanceState(null);
    setMembershipState(null);
    setPreferencesState(null);
    setAccessibilityState(null);
    setPrivacyState(null);
    setRoomState(null);
        setAllUsers([]);
          setRooms([]);
          setRoomMembers([]);
          setRoomAccounts([]);
          setRoomPortfolios({});
        }
      } catch (error) {
        console.error("initializeAuth error", error);
        const isRecoverableError = isRecoverableSupabaseAuthError(error);

        if (isRecoverableError) {
          setConnectionIssue(buildConnectionIssue(error, t));
        }
        const fallbackAuthUser = null;

        if (fallbackAuthUser) {
          if (isLoggingOutRef.current) {
            clearSessionState();
            return;
          }
          setCurrentUserId(fallbackAuthUser.id);
          setCurrentUser((previousUser) => ({
            ...buildTradingUser(fallbackAuthUser, readClientProfileExtras(fallbackAuthUser.id)),
            positions: previousUser?.positions ?? [],
            transactions: previousUser?.transactions ?? [],
          }));
          setSecurityState(readClientSecurityExtras(fallbackAuthUser.id));
          setNotificationState(readClientNotificationExtras(fallbackAuthUser.id));
          setAppearanceState(readClientAppearanceExtras(fallbackAuthUser.id));
          setMembershipState(readClientMembershipExtras(fallbackAuthUser.id));
          setPreferencesState(readClientPreferencesExtras(fallbackAuthUser.id));
          setAccessibilityState(readClientAccessibilityExtras(fallbackAuthUser.id));
          setPrivacyState(readClientPrivacyExtras(fallbackAuthUser.id));
          setRoomState(readClientRoomExtras(fallbackAuthUser.id));
        } else if (isRecoverableError && restoreLocalSessionState(currentUserIdRef.current)) {
          setRooms([]);
          setRoomMembers([]);
          setRoomAccounts([]);
          setRoomPortfolios({});
        } else {
          setCurrentUser(null);
          setSecurityState(null);
          setNotificationState(null);
          setAppearanceState(null);
          setMembershipState(null);
          setPreferencesState(null);
          setAccessibilityState(null);
          setPrivacyState(null);
          setRoomState(null);
          setAllUsers([]);
          setRooms([]);
          setRoomMembers([]);
          setRoomAccounts([]);
          setRoomPortfolios({});
          setCurrentUserId(null);
          setActiveRoomId(null);
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initializeAuth();
    const unsubscribeAuthEvents = subscribeToAuthEvents(async (event) => {
      if (!isMounted) {
        return;
      }

      if (event.type === "logged-out") {
        clearSessionState();
        setIsLoadingAuth(false);
        return;
      }

      if (event.type !== "session-updated" || !event.user) {
        return;
      }

      try {
        setCurrentUserId(event.user.id);
        setConnectionIssue(null);
        await loadTradingState(event.user);
      } catch (error) {
        console.error("auth event sync error", error);
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(loadingSafetyTimer);
      unsubscribeAuthEvents();
    };
  }, [clearSessionState, loadTradingState, restoreLocalSessionState, setActiveRoomId, setAllUsers, setCurrentUserId, t]);

  const updateUser = useCallback(
    async (updates) => {
      if (!currentUser) {
        throw new Error("No authenticated user");
      }

      await updateAuthIdentity({
        email: updates.email && updates.email !== currentUser.email ? updates.email : undefined,
        password: updates.password,
      });

      const portfolioRoomScope = currentUser?.role === "teacher" ? null : activeRoomId;

      const mergedUser = {
        ...currentUser,
        ...updates,
      };
      const localProfileExtras = persistClientProfileExtras(currentUser.id, mergedUser);

      if (updates.language) {
        persistClientPreferencesExtras(currentUser.id, {
          interfaceLanguage: normalizeAppLanguage(updates.language),
        });
      }

      delete mergedUser.password;

      const persistedUser = await upsertProfile(mergedUser);
      let hydratedUser = {
        ...persistedUser,
        ...localProfileExtras,
        positions: updates.positions ?? currentUser.positions ?? [],
        transactions: updates.transactions ?? currentUser.transactions ?? [],
        balance: activeRoomId ? currentUser.balance : persistedUser.balance,
        createdAt: persistedUser.createdAt || currentUser.createdAt || "",
        lastLoginAt: currentUser.lastLoginAt || persistedUser.updatedAt || "",
      };

      await syncPortfolio(hydratedUser.id, hydratedUser.positions, hydratedUser.transactions, portfolioRoomScope);

      if (currentUser?.role !== "teacher" && activeRoomId && typeof updates.balance === "number") {
        const roomBalance = await setStudentRoomBalance({
          roomId: activeRoomId,
          userId: hydratedUser.id,
          availableBalance: updates.balance,
        });

        setRoomAccounts((previous) =>
          previous.map((account) =>
            account.roomId === activeRoomId && account.userId === hydratedUser.id
              ? { ...account, ...roomBalance }
              : account
          )
        );
      }

      const accessibleProfiles = await fetchAccessibleProfiles(persistedUser);
      const mergedUsers = await Promise.all(
        accessibleProfiles.map(async (profile) => {
          if (profile.id === hydratedUser.id) {
            return hydratedUser;
          }

          const itemExtras = readClientProfileExtras(profile.id);

          if (persistedUser.role === "teacher") {
            const relatedPortfolio = await fetchPortfolio(profile.id, activeRoomId);
            return {
              ...profile,
              ...itemExtras,
              positions: relatedPortfolio.positions,
              transactions: relatedPortfolio.transactions,
            };
          }

          return { ...profile, ...itemExtras, positions: [], transactions: [] };
        })
      );

      if (hydratedUser.role !== "teacher" && activeRoomId) {
        try {
          const currentRoomPortfolio = await fetchPortfolio(hydratedUser.id, activeRoomId);
          hydratedUser = {
            ...hydratedUser,
            positions: currentRoomPortfolio.positions,
            transactions: currentRoomPortfolio.transactions,
          };
        } catch (error) {
          console.error("fetchCurrentRoomPortfolio error", error);
        }
      }

      setCurrentUser(hydratedUser);
      setSecurityState(readClientSecurityExtras(hydratedUser.id));
      setNotificationState(readClientNotificationExtras(hydratedUser.id));
      setAppearanceState(readClientAppearanceExtras(hydratedUser.id));
      setMembershipState(readClientMembershipExtras(hydratedUser.id));
      setPreferencesState(readClientPreferencesExtras(hydratedUser.id));
      setAccessibilityState(readClientAccessibilityExtras(hydratedUser.id));
      setPrivacyState(readClientPrivacyExtras(hydratedUser.id));
      setRoomState(readClientRoomExtras(hydratedUser.id));
      setAllUsers(mergedUsers);

      return hydratedUser;
    },
    [activeRoomId, currentUser, setAllUsers]
  );

  const {
    changePassword,
    login,
    logout,
    logoutAllDevices,
    refreshSecuritySessions,
    register,
    revokeDeviceSession,
  } = useAuthManager({
    allUsers,
    setAllUsers,
    setCurrentUserId,
    clearSessionState,
    setConnectionIssue,
    toast,
    syncUserFromAuth,
  });

  const marketData = {};
  const selectedSymbol = "BTCUSD";
  const setSelectedSymbol = () => {};
  const activeSimulation = null;
  const setActiveSimulation = () => {};
  const isLoadingMarket = false;

  const getCurrentPrice = useCallback(
    () => 0,
    []
  );

  const calculateChange = useCallback(
    () => 0,
    []
  );

  const getSymbolData = useCallback(() => {
    return symbolTemplates.map((symbol) => ({
      ...symbol,
      name: t(symbol.nameKey),
      price: getCurrentPrice(symbol.id),
      change: calculateChange(symbol.id),
    }));
  }, [symbolTemplates, getCurrentPrice, calculateChange, t]);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) || null;

  const activeRoomAccount = currentUser?.role === "teacher"
    ? null
    : roomAccounts.find((account) => account.userId === currentUser?.id && account.roomId === activeRoomId) || null;

  const { openPosition, closePosition } = usePortfolioManager({
    currentUser,
    updateUser,
    toast,
    activeRoom,
    currentBalance: currentUser?.role === "teacher"
      ? currentUser?.balance ?? 0
      : activeRoomAccount?.availableBalance ?? currentUser?.balance ?? 0,
  });

  const studentsInClass =
    currentUser?.role === "teacher"
      ? roomMembers
          .filter((member) => member.roleInRoom === "student")
          .map((member) => {
            const relatedPortfolio = roomPortfolios[member.userId];
            const relatedAccount = roomAccounts.find((account) => account.userId === member.userId);

            return {
              ...(member.profile || {}),
              positions: relatedPortfolio?.positions || [],
              transactions: relatedPortfolio?.transactions || [],
              balance: relatedAccount?.availableBalance ?? 0,
              roomAccount: relatedAccount || null,
            };
          })
      : [];

  const isAuthenticated = Boolean(currentUserId);

  const refreshActiveRoomData = useCallback(async () => {
    if (!activeRoomId) {
      setRoomMembers([]);
      setRoomAccounts([]);
      setRoomPortfolios({});
      return;
    }
    const [nextMembers, nextAccounts] = await Promise.all([
      fetchRoomMembers(activeRoomId),
      fetchRoomSimAccounts(activeRoomId),
    ]);
    const memberPortfolios = await Promise.all(
      nextMembers
        .filter((member) => member.roleInRoom === "student")
        .map(async (member) => [member.userId, await fetchPortfolio(member.userId, activeRoomId)])
    );
    setRoomMembers(nextMembers);
    setRoomAccounts(nextAccounts);
    setRoomPortfolios(Object.fromEntries(memberPortfolios));
    if (currentUser?.id && currentUser?.role !== "teacher") {
      try {
        const nextPortfolio = await fetchPortfolio(currentUser.id, activeRoomId);
        setCurrentUser((previous) =>
          previous
            ? {
                ...previous,
                positions: nextPortfolio.positions,
                transactions: nextPortfolio.transactions,
              }
            : previous
        );
      } catch (error) {
        console.error("refreshCurrentStudentPortfolio error", error);
      }
    }
  }, [activeRoomId, currentUser?.id, currentUser?.role]);

  const refreshRoomsData = useCallback(async () => {
    if (!currentUser?.id) {
      setRooms([]);
      setRoomMembers([]);
      setRoomAccounts([]);
      setRoomPortfolios({});
      return [];
    }

    let accessibleRooms = [];
    const cachedRooms = readCachedAccessibleRooms(currentUser.id);
    try {
      accessibleRooms =
        currentUser.role === "teacher"
          ? await fetchTeacherRooms(currentUser.id)
          : await fetchStudentRooms(currentUser.id);
    } catch (error) {
      console.error("refreshRoomsData fetch error", error);
      accessibleRooms = cachedRooms;
    }

    if (accessibleRooms.length === 0 && cachedRooms.length > 0) {
      accessibleRooms = cachedRooms;
    }

    setRooms(accessibleRooms);
    if (accessibleRooms.length > 0) {
      persistCachedAccessibleRooms(currentUser.id, accessibleRooms);
    }

    const preferredRoomId =
      preferencesState?.defaultActiveRoomId &&
      accessibleRooms.find((room) => room.id === preferencesState.defaultActiveRoomId)?.id;

    const nextActiveRoomId =
      accessibleRooms.find((room) => room.id === activeRoomId)?.id ??
      preferredRoomId ??
      null;

    setActiveRoomId(nextActiveRoomId);
    setRoomMembers([]);
    setRoomAccounts([]);
    setRoomPortfolios({});

    return accessibleRooms;
  }, [activeRoomId, currentUser?.id, currentUser?.role, preferencesState?.defaultActiveRoomId, setActiveRoomId]);

  const deleteAccount = useCallback(async () => {
    await deleteCurrentAccount();
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSecurityState(null);
    setNotificationState(null);
    setAppearanceState(null);
    setMembershipState(null);
    setPreferencesState(null);
    setRoomState(null);
    setAllUsers([]);
    setCurrentUserId(null);
    setRooms([]);
    setRoomMembers([]);
    setRoomAccounts([]);
    setRoomPortfolios({});
    setActiveRoomId(null);
  }, [setActiveRoomId, setAllUsers, setCurrentUserId]);

  const selectRoom = useCallback(
    async (roomId) => {
      if (roomId && !rooms.find((room) => room.id === roomId)) {
        throw new Error("Selected class is not accessible for the current user");
      }

      setActiveRoomId(roomId);

      if (!roomId) {
        setRoomMembers([]);
        setRoomAccounts([]);
        setRoomPortfolios({});
        return;
      }

      try {
        const [nextMembers, nextAccounts] = await Promise.all([
          fetchRoomMembers(roomId),
          fetchRoomSimAccounts(roomId),
        ]);
        const memberPortfolios = await Promise.all(
          nextMembers
            .filter((member) => member.roleInRoom === "student")
            .map(async (member) => [member.userId, await fetchPortfolio(member.userId, roomId)])
        );
        setRoomMembers(nextMembers);
        setRoomAccounts(nextAccounts);
        setRoomPortfolios(Object.fromEntries(memberPortfolios));

        if (currentUser?.id && currentUser?.role !== "teacher") {
          try {
            const nextPortfolio = await fetchPortfolio(currentUser.id, roomId);
            setCurrentUser((previous) => previous ? { ...previous, positions: nextPortfolio.positions, transactions: nextPortfolio.transactions } : previous);
          } catch (error) {
            console.error("selectRoomPortfolio error", error);
          }
        }
      } catch (error) {
        console.error("selectRoom error", error);
      }
    },
    [currentUser?.id, currentUser?.role, rooms, setActiveRoomId]
  );

  const adjustStudentBalance = useCallback(
    async ({ studentUserId, adjustmentType, adjustmentAmount, reason }) => {
      if (!activeRoomId || !currentUser?.id) {
        throw new Error("No active room selected");
      }

      const result = await adjustStudentRoomBalance({
        roomId: activeRoomId,
        studentUserId,
        teacherId: currentUser.id,
        adjustmentType,
        adjustmentAmount,
        reason,
      });

      await refreshActiveRoomData();
      return result;
    },
    [activeRoomId, currentUser?.id, refreshActiveRoomData]
  );

  const updateSecurityState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextSecurityState = persistClientSecurityExtras(currentUser.id, updates);
      setSecurityState(nextSecurityState);
      return nextSecurityState;
    },
    [currentUser?.id]
  );

  const updateNotificationState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextNotificationState = persistClientNotificationExtras(currentUser.id, updates);
      setNotificationState(nextNotificationState);
      return nextNotificationState;
    },
    [currentUser?.id]
  );

  const updateAppearanceState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextAppearanceState = persistClientAppearanceExtras(currentUser.id, updates);
      setAppearanceState(nextAppearanceState);
      return nextAppearanceState;
    },
    [currentUser?.id]
  );

  const updateMembershipState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextMembershipState = persistClientMembershipExtras(currentUser.id, updates);
      setMembershipState(nextMembershipState);
      return nextMembershipState;
    },
    [currentUser?.id]
  );

  const updatePreferencesState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextPreferencesState = persistClientPreferencesExtras(currentUser.id, updates);
      setPreferencesState(nextPreferencesState);
      return nextPreferencesState;
    },
    [currentUser?.id]
  );

  const updateAccessibilityState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextAccessibilityState = persistClientAccessibilityExtras(currentUser.id, updates);
      setAccessibilityState(nextAccessibilityState);
      return nextAccessibilityState;
    },
    [currentUser?.id]
  );

  const updatePrivacyState = useCallback(
    (updates) => {
      if (!currentUser?.id) {
        return null;
      }

      const nextPrivacyState = persistClientPrivacyExtras(currentUser.id, updates);
      setPrivacyState(nextPrivacyState);
      return nextPrivacyState;
    },
    [currentUser?.id]
  );

  const joinRoomWithCode = useCallback(
    async (accessCode) => {
      if (!currentUser?.id) {
        throw new Error("No authenticated user");
      }

      const joinedRoom = await joinRoomByCode({
        userId: currentUser.id,
        accessCode,
      });

      persistCachedAccessibleRooms(currentUser.id, [
        joinedRoom,
        ...readCachedAccessibleRooms(currentUser.id).filter((room) => room.id !== joinedRoom.id),
      ]);
      await refreshRoomsData();
      await selectRoom(joinedRoom.id);
      return joinedRoom;
    },
    [currentUser?.id, refreshRoomsData, selectRoom]
  );

  const createRoomForUser = useCallback(
    async ({ name, description, defaultBalance, defaultCurrency }) => {
      if (!currentUser?.id) {
        throw new Error("No authenticated user");
      }

      const newRoom = await createRoom({
        ownerUserId: currentUser.id,
        name,
        description,
        defaultBalance,
        defaultCurrency,
      });

      persistCachedAccessibleRooms(currentUser.id, [
        newRoom,
        ...readCachedAccessibleRooms(currentUser.id).filter((room) => room.id !== newRoom.id),
      ]);
      await refreshRoomsData();
      await selectRoom(newRoom.id);
      return newRoom;
    },
    [currentUser?.id, refreshRoomsData, selectRoom]
  );

  const leaveCurrentUserRoom = useCallback(
    async (room) => {
      if (!currentUser?.id || !room?.id) {
        throw new Error("Room unavailable");
      }

      await leaveRoom({
        roomId: room.id,
        userId: currentUser.id,
      });

      const nextRoomState = appendClientRoomHistory(currentUser.id, room, {
        membershipRole: room.membershipRole,
        membershipState: "left",
        state: room.state || "archived",
      });
      setRoomState(nextRoomState);
      await refreshRoomsData();
      return true;
    },
    [currentUser?.id, refreshRoomsData]
  );

  const updateManagedRoomState = useCallback(
    async (roomId, nextState) => {
      const nextRoom = await updateRoomState(roomId, nextState);
      await refreshRoomsData();
      return nextRoom;
    },
    [refreshRoomsData]
  );

  const updateManagedRoomDetails = useCallback(
    async (payload) => {
      const nextRoom = await updateRoomDetails(payload);
      await refreshRoomsData();

      if (payload?.roomId === activeRoomId) {
        await selectRoom(payload.roomId);
      }

      return nextRoom;
    },
    [activeRoomId, refreshRoomsData, selectRoom]
  );

  const getRoomHistory = useCallback(async () => {
    if (!currentUser?.id) {
      return [];
    }

    const backendHistory = await fetchRoomHistory(currentUser.id, currentUser.role);
    const localHistory = readClientRoomExtras(currentUser.id).history || [];

    return [...backendHistory, ...localHistory].filter(
      (room, index, collection) => collection.findIndex((entry) => entry.id === room.id) === index
    );
  }, [currentUser?.id, currentUser?.role]);

  const value = {
    user: currentUser,
    balance: currentUser?.role === "teacher"
      ? currentUser?.balance ?? 0
      : activeRoomAccount?.availableBalance ?? currentUser?.balance ?? 0,
    positions: currentUser?.positions || [],
    transactions: currentUser?.transactions || [],
    allUsers,
    studentsInClass,
    rooms,
    activeRoom,
    activeRoomId,
    roomMembers,
    roomAccounts,
    roomPortfolios,
    isAuthenticated,
    marketData,
    selectedSymbol,
    symbols: getSymbolData(),
    initialSymbols: symbolTemplates,
    isLoading: isLoadingAuth,
    connectionIssue,
    securityState,
    notificationState,
    appearanceState,
    membershipState,
    preferencesState,
    accessibilityState,
    privacyState,
    roomState,
    isMarketLoading: isLoadingMarket,
    login,
    logout,
    logoutAllDevices,
    changePassword,
    register,
    refreshSecuritySessions,
    revokeDeviceSession,
    openPosition,
    closePosition,
    getCurrentPrice,
    setSelectedSymbol,
    activeSimulation,
    setActiveSimulation,
    updateUser,
    deleteAccount,
    selectRoom,
    adjustStudentBalance,
    refreshActiveRoomData,
    refreshRoomsData,
    updateSecurityState,
    updateNotificationState,
    updateAppearanceState,
    updateMembershipState,
    updatePreferencesState,
    updateAccessibilityState,
    updatePrivacyState,
    joinRoomWithCode,
    createRoomForUser,
    leaveCurrentUserRoom,
    updateManagedRoomState,
    updateManagedRoomDetails,
    getRoomHistory,
  };

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
};

