import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2,
  BookOpen,
  GraduationCap,
  Info,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { useClassContext } from "@/features/classes/context/ClassContext";
import {
  APP_HOME_PATH,
  CLASS_CONTEXT_NAV_ITEMS,
  GLOBAL_APP_PATHS,
  buildClassRoute,
} from "@/lib/routes";

const SIDEBAR_PINNED_KEY = "gtl.sidebar.pinned";
let sidebarPinnedMemory = false;
let sidebarHoverMemory = false;

const Sidebar = () => {
  const { t } = useTranslation();
  const { user, logout } = useTradingContext();
  const { activeClassId, hasActiveClass } = useClassContext() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const closeTimerRef = useRef(null);
  const [isPinned, setIsPinned] = useState(() => {
    if (sidebarPinnedMemory) {
      return true;
    }

    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_PINNED_KEY) === "true";
  });
  const [isHovered, setIsHovered] = useState(() => sidebarHoverMemory);

  const isOpen = isPinned || isHovered;
  const isInsideClassWorkspace = useMemo(
    () => /^\/app\/classes\/[^/]+(\/.*)?$/.test(location.pathname),
    [location.pathname]
  );

  const globalNavItems = useMemo(
    () => [
      {
        id: "classes",
        icon: GraduationCap,
        label: t("navigation.sidebar.classes"),
        path: GLOBAL_APP_PATHS.classes,
      },
      {
        id: "learn",
        icon: BookOpen,
        label: t("navigation.sidebar.learn"),
        path: GLOBAL_APP_PATHS.learn,
      },
      {
        id: "settings",
        icon: Settings,
        label: t("navigation.sidebar.settings"),
        path: GLOBAL_APP_PATHS.settings,
      },
      {
        id: "support",
        icon: Info,
        label: t("navigation.sidebar.help"),
        path: GLOBAL_APP_PATHS.support,
      },
    ],
    [t]
  );

  const classNavItems = useMemo(
    () =>
      CLASS_CONTEXT_NAV_ITEMS.map((item) => ({
        ...item,
        icon:
          item.id === "dashboard"
            ? BookOpen
            : BarChart2,
        label:
          item.id === "dashboard"
            ? "Dashboard"
            : t("navigation.sidebar.markets"),
        path: activeClassId ? buildClassRoute(activeClassId, item.path) : null,
      })),
    [activeClassId, t]
  );

  useEffect(() => {
    sidebarPinnedMemory = isPinned;
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, String(isPinned));
  }, [isPinned]);

  useEffect(() => {
    sidebarHoverMemory = isHovered;
  }, [isHovered]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openSidebar = () => {
    clearCloseTimer();
    sidebarHoverMemory = true;
    setIsHovered(true);
  };

  const scheduleSidebarClose = () => {
    clearCloseTimer();

    if (isPinned) {
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      sidebarHoverMemory = false;
      setIsHovered(false);
      closeTimerRef.current = null;
    }, 160);
  };

  const handleLogout = () => {
    clearCloseTimer();
    sidebarHoverMemory = false;
    sidebarPinnedMemory = false;
    setIsPinned(false);
    setIsHovered(false);
    logout();
    navigate("/login", { replace: true });
  };

  const keepSidebarStable = () => {
    openSidebar();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.button
            type="button"
            aria-label={t("navigation.sidebar.overlayCloseAriaLabel")}
            className="fixed inset-0 z-40 bg-background/35 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              clearCloseTimer();
              sidebarHoverMemory = false;
              sidebarPinnedMemory = false;
              setIsPinned(false);
              setIsHovered(false);
            }}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        initial={false}
        className="app-chrome-strong fixed inset-y-0 left-0 z-50 flex h-screen flex-col justify-between border-r app-chrome-divider shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
        animate={{ width: isOpen ? 272 : 72 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        onMouseEnter={openSidebar}
        onMouseLeave={scheduleSidebarClose}
      >
        <div>
          <div
            className={`flex items-center pb-4 pt-5 ${
              isOpen ? "justify-between gap-2 px-4" : "justify-center px-3"
            }`}
          >
            {isOpen ? (
              <NavLink to={APP_HOME_PATH} className="min-w-0">
                <h1 className="truncate bg-gradient-to-r from-[#76a2ff] via-[#4f82ff] to-[#2f66e3] bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                  {t("common.appName")}
                </h1>
              </NavLink>
            ) : (
              <div className="h-10 w-10 rounded-2xl bg-primary/10" />
            )}

            <button
              type="button"
              aria-label={t("navigation.sidebar.collapseAriaLabel")}
              onClick={() =>
                setIsPinned((previous) => {
                  const nextValue = !previous;
                  sidebarPinnedMemory = nextValue;
                  window.localStorage.setItem(SIDEBAR_PINNED_KEY, String(nextValue));
                  return nextValue;
                })
              }
              className={`flex shrink-0 items-center justify-center text-slate-300 transition hover:bg-primary/10 hover:text-primary ${
                isOpen
                  ? "h-10 w-10 rounded-xl bg-secondary/60"
                  : "h-[52px] w-full rounded-2xl bg-transparent"
              }`}
            >
              {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <nav className="space-y-2 px-3">
            {globalNavItems.map((item) => {
              const Icon = item.icon;
              const isClassesSection = item.id === "classes";
              const isGlobalActive =
                location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

              return (
                <div key={item.id} className="space-y-1">
                  <NavLink
                    to={item.path}
                    onMouseDown={keepSidebarStable}
                    onClick={keepSidebarStable}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${
                      isGlobalActive
                        ? "bg-primary/18 text-primary shadow-[inset_0_1px_0_hsla(var(--primary-foreground)/0.06)] ring-1 ring-primary/18"
                        : "text-muted-foreground hover:bg-accent/75 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {isOpen ? <span className="truncate text-lg font-medium">{item.label}</span> : null}
                  </NavLink>

                  {isOpen && isClassesSection && hasActiveClass && isInsideClassWorkspace ? (
                    <div className="space-y-1 pl-4">
                      {classNavItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isActive = Boolean(
                          subItem.path && location.pathname.startsWith(subItem.path)
                        );

                        return (
                          <NavLink
                            key={subItem.id}
                            to={subItem.path || APP_HOME_PATH}
                            onMouseDown={keepSidebarStable}
                            onClick={keepSidebarStable}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                            }`}
                          >
                            <SubIcon className="h-4 w-4 shrink-0 opacity-80" />
                            <span className="truncate">{subItem.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/8 p-3">
          {user ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 rounded-2xl px-4 py-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              {isOpen ? <span>{t("common.actions.logOut")}</span> : null}
            </Button>
          ) : (
            <NavLink
              to="/login"
              onMouseDown={keepSidebarStable}
              onClick={keepSidebarStable}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-muted-foreground transition-all duration-200 hover:bg-accent/75 hover:text-foreground"
            >
              <UserCircle className="h-5 w-5" />
              {isOpen ? <span>{t("common.actions.logIn")}</span> : null}
            </NavLink>
          )}
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
