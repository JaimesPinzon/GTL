import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useTradingContext } from "@/contexts/TradingContext";
import { APP_HOME_PATH, CLASS_CONTEXT_PATHS, buildClassHomeRoute, buildClassRoute } from "@/lib/routes";
import { ENABLED_MARKET_ASSETS } from "@/lib/market-assets";
import { normalizeNewsSymbol, resolveNewsAssetAvailability } from "@/lib/news-navigation";

const ACTIVE_CLASS_STORAGE_KEY = "gtl.active-class-id";
const ClassContext = createContext(null);

export const useClassContext = () => useContext(ClassContext);

export const ClassContextProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { classId: routeClassId } = useParams();
  const {
    isAuthenticated,
    isLoading,
    rooms,
    activeRoom,
    activeRoomId,
    selectRoom,
  } = useTradingContext();
  const [isHydratingClass, setIsHydratingClass] = useState(false);
  const lastHydratedClassIdRef = useRef(null);

  const accessibleClasses = rooms || [];

  const getStoredClassId = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(ACTIVE_CLASS_STORAGE_KEY);
  }, []);

  const persistActiveClassId = useCallback((classId) => {
    if (typeof window === "undefined") {
      return;
    }

    if (classId) {
      window.localStorage.setItem(ACTIVE_CLASS_STORAGE_KEY, classId);
      return;
    }

    window.localStorage.removeItem(ACTIVE_CLASS_STORAGE_KEY);
  }, []);

  const validateClassAccess = useCallback(
    (classId) => accessibleClasses.some((room) => room.id === classId),
    [accessibleClasses]
  );

  const selectActiveClass = useCallback(
    async (classId, options = {}) => {
      const { navigateToSection, navigateToHome = false, replace = false } = options;

      if (!classId || !validateClassAccess(classId)) {
        persistActiveClassId(null);
        return false;
      }

      setIsHydratingClass(true);

      try {
        await selectRoom(classId);
        persistActiveClassId(classId);
        lastHydratedClassIdRef.current = classId;

        if (navigateToSection) {
          navigate(buildClassRoute(classId, navigateToSection), { replace });
        } else if (navigateToHome) {
          navigate(buildClassHomeRoute(classId), { replace });
        }

        return true;
      } finally {
        setIsHydratingClass(false);
      }
    },
    [navigate, persistActiveClassId, selectRoom, validateClassAccess]
  );

  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      return;
    }

    if (routeClassId) {
      if (!validateClassAccess(routeClassId)) {
        navigate(APP_HOME_PATH, { replace: true });
        return;
      }

      if (lastHydratedClassIdRef.current !== routeClassId) {
        void selectActiveClass(routeClassId, { replace: true });
        return;
      }

      persistActiveClassId(routeClassId);
      lastHydratedClassIdRef.current = routeClassId;
      return;
    }

    const storedClassId = getStoredClassId();

    if (storedClassId && !validateClassAccess(storedClassId)) {
      persistActiveClassId(null);
    }
  }, [
    activeRoomId,
    getStoredClassId,
    isAuthenticated,
    isLoading,
    navigate,
    persistActiveClassId,
    routeClassId,
    selectActiveClass,
    validateClassAccess,
  ]);

  useEffect(() => {
    if (!location.pathname.startsWith(APP_HOME_PATH)) {
      return;
    }

    if (activeRoomId) {
      persistActiveClassId(activeRoomId);
    }
  }, [activeRoomId, location.pathname, persistActiveClassId]);

  const resolvedActiveClass =
    accessibleClasses.find((room) => room.id === routeClassId) ||
    activeRoom ||
    accessibleClasses.find((room) => room.id === activeRoomId) ||
    null;

  const getAssetAvailability = useCallback(
    (symbol, classId = resolvedActiveClass?.id || activeRoomId) => {
      return resolveNewsAssetAvailability({
        symbol,
        classId,
        classes: accessibleClasses,
        assets: ENABLED_MARKET_ASSETS,
      });
    },
    [accessibleClasses, activeRoomId, resolvedActiveClass]
  );

  const openAssetInClass = useCallback(
    async (symbol, options = {}) => {
      const classId = options.classId || resolvedActiveClass?.id || activeRoomId || null;
      const availability = getAssetAvailability(symbol, classId);
      if (!availability.available) return availability;

      const normalizedSymbol = normalizeNewsSymbol(symbol);
      const query = new URLSearchParams({ symbol: normalizedSymbol });
      if (options.newsId) query.set("news", options.newsId);
      if (options.returnTo) query.set("returnTo", options.returnTo);
      const selected = await selectActiveClass(classId);
      if (!selected) return { ...availability, available: false, reason: "class-forbidden" };
      navigate(`${buildClassRoute(classId, CLASS_CONTEXT_PATHS.markets)}?${query.toString()}`);
      return availability;
    },
    [activeRoomId, getAssetAvailability, navigate, resolvedActiveClass, selectActiveClass]
  );

  const value = useMemo(
    () => ({
      accessibleClasses,
      activeClass: resolvedActiveClass,
      activeClassId: resolvedActiveClass?.id || activeRoomId || null,
      hasActiveClass: Boolean(resolvedActiveClass?.id || activeRoomId),
      isHydratingClass,
      getAssetAvailability,
      isAssetAvailable: (symbol, classId) => getAssetAvailability(symbol, classId).available,
      openAssetInClass,
      routeClassId: routeClassId || null,
      selectActiveClass,
      validateClassAccess,
    }),
    [
      accessibleClasses,
      activeRoomId,
      isHydratingClass,
      getAssetAvailability,
      openAssetInClass,
      resolvedActiveClass,
      routeClassId,
      selectActiveClass,
      validateClassAccess,
    ]
  );

  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>;
};
