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
import { APP_HOME_PATH, buildClassHomeRoute, buildClassRoute } from "@/lib/routes";

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

  const value = useMemo(
    () => ({
      accessibleClasses,
      activeClass: resolvedActiveClass,
      activeClassId: resolvedActiveClass?.id || activeRoomId || null,
      hasActiveClass: Boolean(resolvedActiveClass?.id || activeRoomId),
      isHydratingClass,
      routeClassId: routeClassId || null,
      selectActiveClass,
      validateClassAccess,
    }),
    [
      accessibleClasses,
      activeRoomId,
      isHydratingClass,
      resolvedActiveClass,
      routeClassId,
      selectActiveClass,
      validateClassAccess,
    ]
  );

  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>;
};
