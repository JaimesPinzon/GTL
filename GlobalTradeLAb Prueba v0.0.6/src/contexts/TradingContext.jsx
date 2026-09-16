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
import { useActiveRoomAccount } from "@/hooks/useActiveRoomAccount";
import { useRoomWorkspaceData } from "@/hooks/useRoomWorkspaceData";
import { useTranslation } from "react-i18next";
import { restoreSession, subscribeToAuthEvents } from "@/lib/auth-api";
import { clearSupabaseAuthStorage, supabase } from "@/lib/supabase";
import {
  adjustStudentRoomBalance,
  createRoom,
  deleteRoom,
  deleteCurrentAccount,
  fetchAccessibleProfiles,
  fetchPortfolio,
  fetchProfile,
  fetchRoomHistory,
  fetchStudentRooms,
  fetchTeacherRooms,
  ensureRoomMemberTradingFields,
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
import { mergeRoomWithSettings, persistRoomSettings } from "@/lib/room-settings";
import { resolveUserRoomAccount } from "@/lib/room-balance";
import { ENABLED_MARKET_ASSETS } from "@/lib/market-assets";

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

const hasOAuthCallbackTokensInUrl = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const hash = String(window.location.hash || "");
  if (
    hash.includes("access_token=") ||
    hash.includes("refresh_token=") ||
    hash.includes("error=") ||
    hash.includes("error_description=")
  ) {
    return true;
  }

  const searchParams = new URLSearchParams(window.location.search || "");
  return Boolean(searchParams.get("code") || searchParams.get("error") || searchParams.get("error_description"));
};

const isSupabaseSessionNotReadyError = (error) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("issued in the future") ||
    normalizedMessage.includes("clock for skew") ||
    normalizedMessage.includes("not yet valid") ||
    normalizedMessage.includes("auth session missing")
  );
};

const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getSupabaseSessionUserWithRetries = async ({ attempts = 1, delayMs = 120 } = {}) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data: supabaseSessionData, error: supabaseSessionError } = await supabase.auth.getSession();
    if (supabaseSessionError) {
      if (attempt < attempts - 1 && isSupabaseSessionNotReadyError(supabaseSessionError)) {
        await wait(delayMs);
        continue;
      }

      return { user: null, error: supabaseSessionError };
    }

    const user = supabaseSessionData?.session?.user ?? null;
    if (user) {
      return { user, error: null };
    }

    if (attempt < attempts - 1) {
      await wait(delayMs);
    }
  }

  return { user: null, error: null };
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
  const [authenticatedUserId, setAuthenticatedUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomAccounts, setRoomAccounts] = useState([]);
  const activeRoomAccountResourceRef = useRef(null);
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

  useEffect(() => {
    let isMounted = true;

    const syncAuthenticatedUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) {
          return;
        }

        if (error) {
          setAuthenticatedUserId(null);
          return;
        }

        setAuthenticatedUserId(data?.user?.id || null);
      } catch {
        if (isMounted) {
          setAuthenticatedUserId(null);
        }
      }
    };

    void syncAuthenticatedUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticatedUserId(session?.user?.id || null);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const symbolTemplates = useMemo(
    () => ENABLED_MARKET_ASSETS,
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
      let roomsFetchFailed = false;
      try {
        accessibleRooms =
          hydratedUser.role === "teacher"
            ? await fetchTeacherRooms(hydratedUser.id)
            : await fetchStudentRooms(hydratedUser.id);
      } catch (error) {
        console.error("fetchAccessibleRooms error", error);
        roomsFetchFailed = true;
        accessibleRooms = cachedRooms;
      }

      if (roomsFetchFailed && accessibleRooms.length === 0 && cachedRooms.length > 0) {
        accessibleRooms = cachedRooms;
      }

      accessibleRooms = accessibleRooms.map((room) => mergeRoomWithSettings(room));

      // Persist the latest server truth (including an empty list) to avoid stale rooms.
      persistCachedAccessibleRooms(hydratedUser.id, accessibleRooms);

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
        let authUser = session?.user ?? null;

        if (!authUser) {
          const isOAuthCallback = hasOAuthCallbackTokensInUrl();
          const { user: supabaseSessionUser, error: supabaseSessionError } =
            await getSupabaseSessionUserWithRetries({
              attempts: isOAuthCallback ? 40 : 1,
              delayMs: 200,
            });

          if (supabaseSessionError) {
            console.error("initializeAuth supabase session error", supabaseSessionError);
          }

          authUser = supabaseSessionUser;
        }

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
        let fallbackAuthUser = null;
        try {
          const isOAuthCallback = hasOAuthCallbackTokensInUrl();
          let fallbackUserError = null;

          for (let attempt = 0; attempt < (isOAuthCallback ? 20 : 1); attempt += 1) {
            const { data, error } = await supabase.auth.getUser();
            fallbackUserError = error;
            if (data?.user) {
              fallbackAuthUser = data.user;
              break;
            }

            if (attempt < (isOAuthCallback ? 20 : 1) - 1) {
              await wait(200);
            }
          }

          if (fallbackUserError) {
            console.error("initializeAuth fallback user error", fallbackUserError);
          }
        } catch (fallbackError) {
          console.error("initializeAuth fallback lookup error", fallbackError);
        }

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

      const portfolioRoomScope = activeRoomId || null;

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
      let nextRoomBalance = null;
      let updatedRoomBalance = null;

      if (activeRoomId && typeof updates.balance === "number") {
        const roomBalance = await setStudentRoomBalance({
          roomId: activeRoomId,
          userId: currentUser.id,
          availableBalance: updates.balance,
        });

        const previousAccount = activeRoomAccountResourceRef.current?.getSnapshot().account;
        if (previousAccount?.roomId === activeRoomId) {
          activeRoomAccountResourceRef.current.commit({ ...previousAccount, ...roomBalance, roomId: activeRoomId });
        }
        updatedRoomBalance = roomBalance;
        nextRoomBalance = roomBalance.availableBalance;

        setRoomAccounts((previous) => {
          const isSharedGroupBalance =
            roomBalance.ownerType === "group" && Boolean(roomBalance.ownerGroupId);

          const hasExistingAccount = previous.some(
            (account) => account.roomId === activeRoomId && account.userId === currentUser.id
          );

          const mappedRoomBalance = {
            id: hasExistingAccount
              ? previous.find((account) => account.roomId === activeRoomId && account.userId === currentUser.id)?.id
              : `rm:${activeRoomId}:${currentUser.id}`,
            roomId: activeRoomId,
            userId: currentUser.id,
            availableBalance: roomBalance.availableBalance,
            blockedBalance: roomBalance.blockedBalance,
            totalBalance: roomBalance.totalBalance,
            currency: roomBalance.currency || "USD",
            state: "active",
            ownerType: roomBalance.ownerType || "user",
            ownerGroupId: roomBalance.ownerGroupId || null,
            isShared: Boolean(roomBalance.isShared),
            createdAt: null,
            updatedAt: null,
          };

          if (hasExistingAccount) {
            return previous.map((account) =>
              (() => {
                if (account.roomId !== activeRoomId) {
                  return account;
                }

                if (account.userId === currentUser.id) {
                  return { ...account, ...mappedRoomBalance };
                }

                if (isSharedGroupBalance && account.ownerGroupId === roomBalance.ownerGroupId) {
                  return {
                    ...account,
                    availableBalance: roomBalance.availableBalance,
                    blockedBalance: roomBalance.blockedBalance,
                    totalBalance: roomBalance.totalBalance,
                    currency: roomBalance.currency || account.currency || "USD",
                    state: "active",
                    ownerType: roomBalance.ownerType || account.ownerType || "group",
                    ownerGroupId: roomBalance.ownerGroupId || account.ownerGroupId || null,
                    isShared: Boolean(roomBalance.isShared),
                    updatedAt: null,
                  };
                }

                return account;
              })()
            );
          }

          return [...previous, mappedRoomBalance];
        });
      }

      const resolvedUserBalance = activeRoomId
        ? (typeof nextRoomBalance === "number" ? nextRoomBalance : currentUser?.balance ?? 0)
        : (typeof updates.balance === "number" ? updates.balance : currentUser?.balance ?? 0);

      let hydratedUser = {
        ...persistedUser,
        ...localProfileExtras,
        positions: updates.positions ?? currentUser.positions ?? [],
        transactions: updates.transactions ?? currentUser.transactions ?? [],
        balance: resolvedUserBalance,
        initialBalance: currentUser?.initialBalance ?? persistedUser?.initialBalance ?? resolvedUserBalance,
        createdAt: persistedUser.createdAt || currentUser.createdAt || "",
        lastLoginAt: currentUser.lastLoginAt || persistedUser.updatedAt || "",
      };

      await syncPortfolio(hydratedUser.id, hydratedUser.positions, hydratedUser.transactions, portfolioRoomScope);

      if (
        activeRoomId &&
        updatedRoomBalance?.ownerType === "group" &&
        updatedRoomBalance?.ownerGroupId
      ) {
        const groupMemberIds = [
          ...new Set(
            roomAccounts
              .filter(
                (account) =>
                  account.roomId === activeRoomId &&
                  account.ownerGroupId === updatedRoomBalance.ownerGroupId
              )
              .map((account) => account.userId)
              .filter(Boolean)
          ),
        ];

        const otherGroupMemberIds = groupMemberIds.filter((memberId) => memberId !== hydratedUser.id);

        if (otherGroupMemberIds.length > 0) {
          await Promise.all(
            otherGroupMemberIds.map((memberId) =>
              syncPortfolio(memberId, hydratedUser.positions, hydratedUser.transactions, portfolioRoomScope)
            )
          );
        }

        if (groupMemberIds.length > 0) {
          setRoomPortfolios((previous) => ({
            ...previous,
            ...Object.fromEntries(
              groupMemberIds.map((memberId) => [
                memberId,
                {
                  positions: hydratedUser.positions,
                  transactions: hydratedUser.transactions,
                },
              ])
            ),
          }));
        }
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

      if (activeRoomId) {
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
    [activeRoomId, currentUser, roomAccounts, setAllUsers]
  );

  const {
    changePassword,
    login,
    loginWithGoogle,
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
  const roomUserIdCandidates = useMemo(() => {
    const rawCandidates = [authenticatedUserId, currentUser?.id, currentUserId];
    const seen = new Set();

    return rawCandidates
      .map((candidate) => String(candidate || "").trim())
      .filter((candidate) => {
        if (!candidate || seen.has(candidate)) {
          return false;
        }

        seen.add(candidate);
        return true;
      });
  }, [authenticatedUserId, currentUser?.id, currentUserId]);
  const effectiveRoomUserId = roomUserIdCandidates[0] || null;
  const effectiveRoomMutationUserId = authenticatedUserId || null;
  const directActiveRoomAccount = resolveUserRoomAccount({
    roomId: activeRoomId,
    userId: effectiveRoomUserId,
    userIds: roomUserIdCandidates,
    roomAccounts,
    roomMembers,
  });
  const roomAccountState = useActiveRoomAccount({
    roomId: activeRoomId,
    userIds: roomUserIdCandidates,
    knownAccount: directActiveRoomAccount,
  });
  activeRoomAccountResourceRef.current = roomAccountState.resource;
  const activeRoomAccount = roomAccountState.account ||
    (roomAccountState.status === "loading" ? directActiveRoomAccount : null);
  const activeRoomAccountStatus = activeRoomAccount ? "ready" : roomAccountState.status;
  const refreshRoomAccount = roomAccountState.resource.refresh;

  const resolvedContextBalance = activeRoomId
    ? activeRoomAccount?.availableBalance ?? null
    : currentUser?.balance ?? 0;

  const tradeScopeRef = useRef(null);
  tradeScopeRef.current = `${activeRoomId || ''}:${currentUser?.id || ''}`;
  const commitRoomTrade = useCallback((result) => {
    if (tradeScopeRef.current !== `${activeRoomId || ''}:${currentUser?.id || ''}`) return;
    activeRoomAccountResourceRef.current?.commit(result.account);
    setCurrentUser((previous) => previous ? { ...previous, positions: result.positions, transactions: result.transactions } : previous);
    setRoomAccounts((previous) => {
      const exists = previous.some((account) => account.roomId === activeRoomId && account.userId === result.account.userId);
      const rows = previous.map((account) => account.roomId === activeRoomId && (account.userId === result.account.userId
        || (result.account.isShared && account.ownerGroupId === result.account.ownerGroupId))
        ? { ...account, availableBalance: result.account.availableBalance, blockedBalance: result.account.blockedBalance, totalBalance: result.account.totalBalance }
        : account);
      return exists ? rows : [...rows, result.account];
    });
  }, [activeRoomId, currentUser?.id]);

  const { openPosition, closePosition, isSubmittingTrade } = usePortfolioManager({
    currentUser,
    onTradeCommitted: commitRoomTrade,
    toast,
    activeRoom,
    currentBalance: resolvedContextBalance,
  });

  const studentsInClass =
    currentUser?.role === "teacher"
      ? roomMembers
          .filter((member) => member.roleInRoom === "student")
          .map((member) => {
            const relatedPortfolio = roomPortfolios[member.userId];
            const relatedAccount = resolveUserRoomAccount({
              roomId: activeRoomId,
              userId: member.userId,
              roomAccounts,
              roomMembers,
            });

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
  const applyCurrentRoomPortfolio = useCallback((portfolio) => {
    setCurrentUser((previous) => previous ? {
      ...previous,
      positions: portfolio.positions,
      transactions: portfolio.transactions,
    } : previous);
  }, []);

  const { refresh: refreshActiveRoomData, portfolioStatus: roomPortfolioStatus } = useRoomWorkspaceData({
    roomId: activeRoomId,
    userId: effectiveRoomUserId,
    userRole: currentUser?.role,
    onMembers: setRoomMembers,
    onAccounts: setRoomAccounts,
    onPortfolios: setRoomPortfolios,
    onCurrentPortfolio: applyCurrentRoomPortfolio,
  });

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
    let roomsFetchFailed = false;
    try {
      accessibleRooms =
        currentUser.role === "teacher"
          ? await fetchTeacherRooms(currentUser.id)
          : await fetchStudentRooms(currentUser.id);
    } catch (error) {
      console.error("refreshRoomsData fetch error", error);
      roomsFetchFailed = true;
      accessibleRooms = cachedRooms;
    }

    if (roomsFetchFailed && accessibleRooms.length === 0 && cachedRooms.length > 0) {
      accessibleRooms = cachedRooms;
    }

    accessibleRooms = accessibleRooms.map((room) => mergeRoomWithSettings(room));

    setRooms(accessibleRooms);
    // Persist the latest server truth (including an empty list) to avoid stale rooms.
    persistCachedAccessibleRooms(currentUser.id, accessibleRooms);

    const preferredRoomId =
      preferencesState?.defaultActiveRoomId &&
      accessibleRooms.find((room) => room.id === preferencesState.defaultActiveRoomId)?.id;

    const nextActiveRoomId =
      accessibleRooms.find((room) => room.id === activeRoomId)?.id ??
      preferredRoomId ??
      null;

    setActiveRoomId(nextActiveRoomId);
    if (nextActiveRoomId !== activeRoomId) {
      setRoomMembers([]);
      setRoomAccounts([]);
      setRoomPortfolios({});
    }

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
      if (roomId) {
        const isRoomInState = rooms.some((room) => room.id === roomId);
        const isRoomInCache =
          currentUser?.id &&
          readCachedAccessibleRooms(currentUser.id).some((room) => room.id === roomId);

        if (!isRoomInState && !isRoomInCache) {
          const refreshedRooms = await refreshRoomsData().catch((error) => {
            console.warn("selectRoom refreshRoomsData warning", error);
            return [];
          });
          const isRoomInRefreshedData = refreshedRooms.some((room) => room.id === roomId);

          if (!isRoomInRefreshedData) {
            throw new Error("Selected class is not accessible for the current user");
          }
        }
      }

      setActiveRoomId(roomId);
      if (roomId !== activeRoomId || !roomId) {
        setRoomMembers([]);
        setRoomAccounts([]);
        setRoomPortfolios({});
      }

      // Data loading is owned by useRoomWorkspaceData when activeRoomId changes.
      // No account initialization or second roster/portfolio load on navigation.
    },
    [activeRoomId, currentUser?.id, refreshRoomsData, rooms, setActiveRoomId]
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
    async (accessCodeOrPayload) => {
      if (!currentUser?.id) {
        throw new Error("No authenticated user");
      }

      const accessCode =
        typeof accessCodeOrPayload === "string"
          ? accessCodeOrPayload
          : accessCodeOrPayload?.accessCode;

      const joinedRoom = await joinRoomByCode({
        userId: currentUser.id,
        accessCode,
      });
      const hydratedJoinedRoom = mergeRoomWithSettings(joinedRoom);

      persistCachedAccessibleRooms(currentUser.id, [
        hydratedJoinedRoom,
        ...readCachedAccessibleRooms(currentUser.id).filter((room) => room.id !== hydratedJoinedRoom.id),
      ]);
      await refreshRoomsData();
      try {
        await selectRoom(hydratedJoinedRoom.id);
      } catch (selectionError) {
        console.warn("joinRoomWithCode selectRoom warning", selectionError);
      }
      return hydratedJoinedRoom;
    },
    [currentUser?.id, refreshRoomsData, selectRoom]
  );

  const createRoomForUser = useCallback(
    async ({
      name,
      description,
      defaultBalance,
      defaultCurrency,
      startDate,
      endDate,
      roomSettings,
    }) => {
      if (!currentUser?.id) {
        throw new Error("No authenticated user");
      }

      const newRoom = await createRoom({
        ownerUserId: currentUser.id,
        name,
        description,
        defaultBalance,
        defaultCurrency,
        startDate,
        endDate,
        roomSettings,
      });
      if (effectiveRoomMutationUserId) {
        try {
          await ensureRoomMemberTradingFields({
            roomId: newRoom.id,
            userId: effectiveRoomMutationUserId,
            defaultBalance: Number(newRoom.default_balance ?? newRoom.defaultBalance ?? defaultBalance ?? 0),
            defaultCurrency: newRoom.default_currency ?? newRoom.defaultCurrency ?? defaultCurrency ?? "USD",
            createIfMissingRole: "teacher",
          });
        } catch (error) {
          console.warn("createRoomForUser ensureRoomMemberTradingFields warning", error);
        }
      }
      const persistedSettings = persistRoomSettings(newRoom.id, {
        ...roomSettings,
        operationStartDate: roomSettings?.operationStartDate || startDate || null,
        operationCloseDate: roomSettings?.operationCloseDate || endDate || null,
      });
      const hydratedRoom = mergeRoomWithSettings({
        ...newRoom,
        ...persistedSettings,
      });

      persistCachedAccessibleRooms(currentUser.id, [
        hydratedRoom,
        ...readCachedAccessibleRooms(currentUser.id).filter((room) => room.id !== hydratedRoom.id),
      ]);
      const refreshedRooms = await refreshRoomsData();
      if (!refreshedRooms.some((room) => room.id === hydratedRoom.id)) {
        setRooms((previousRooms) => [
          hydratedRoom,
          ...previousRooms.filter((room) => room.id !== hydratedRoom.id),
        ]);
        persistCachedAccessibleRooms(currentUser.id, [
          hydratedRoom,
          ...readCachedAccessibleRooms(currentUser.id).filter((room) => room.id !== hydratedRoom.id),
        ]);
      }
      await selectRoom(hydratedRoom.id);
      return hydratedRoom;
    },
    [currentUser?.id, effectiveRoomMutationUserId, refreshRoomsData, selectRoom]
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

      const nextAccessibleRooms = [
        ...readCachedAccessibleRooms(currentUser.id).filter((cachedRoom) => cachedRoom.id !== room.id),
      ];
      persistCachedAccessibleRooms(currentUser.id, nextAccessibleRooms);
      setRooms((previousRooms) => previousRooms.filter((existingRoom) => existingRoom.id !== room.id));

      if (activeRoomId === room.id) {
        setActiveRoomId(null);
        setRoomMembers([]);
        setRoomAccounts([]);
        setRoomPortfolios({});
      }

      const nextRoomState = appendClientRoomHistory(currentUser.id, room, {
        membershipRole: room.membershipRole,
        membershipState: "left",
        state: room.state || "archived",
      });
      setRoomState(nextRoomState);

      await refreshRoomsData().catch((refreshError) => {
        console.warn("leaveCurrentUserRoom refreshRoomsData warning", refreshError);
      });

      return true;
    },
    [activeRoomId, currentUser?.id, refreshRoomsData, setActiveRoomId]
  );

  const updateManagedRoomState = useCallback(
    async (roomId, nextState) => {
      const nextRoom = await updateRoomState(roomId, nextState);
      await refreshRoomsData();
      return nextRoom;
    },
    [refreshRoomsData]
  );

  const deleteManagedRoom = useCallback(
    async (roomId) => {
      await deleteRoom(roomId);
      await refreshRoomsData();
      return true;
    },
    [refreshRoomsData]
  );

  const updateManagedRoomDetails = useCallback(
    async (payload) => {
      const nextRoom = await updateRoomDetails(payload);
      if (payload?.roomId && payload?.roomSettings) {
        persistRoomSettings(payload.roomId, payload.roomSettings);
      }
      await refreshRoomsData();

      if (payload?.roomId === activeRoomId) {
        await refreshActiveRoomData();
      }

      return nextRoom;
    },
    [activeRoomId, refreshRoomsData, refreshActiveRoomData]
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
    authenticatedUserId,
    balance: resolvedContextBalance,
    positions: roomPortfolioStatus === "ready" ? currentUser?.positions || [] : [],
    transactions: roomPortfolioStatus === "ready" ? currentUser?.transactions || [] : [],
    roomPortfolioStatus,
    allUsers,
    studentsInClass,
    rooms,
    activeRoom,
    activeRoomId,
    activeRoomAccount,
    activeRoomAccountStatus,
    refreshRoomAccount,
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
    loginWithGoogle,
    logout,
    logoutAllDevices,
    changePassword,
    register,
    refreshSecuritySessions,
    revokeDeviceSession,
      openPosition,
      isSubmittingTrade,
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
    deleteManagedRoom,
    updateManagedRoomState,
    updateManagedRoomDetails,
    getRoomHistory,
  };

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
};

