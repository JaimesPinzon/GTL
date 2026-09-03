import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Toaster } from "@/components/ui/toaster";
import { TradingProvider, useTradingContext } from "@/contexts/TradingContext";
import AppLayout from "@/components/layout/AppLayout";
import ClassRouteGuard from "@/app/guards/ClassRouteGuard";
import {
  APP_HOME_PATH,
  APP_ROOT_PATH,
  CLASS_CONTEXT_PATHS,
  GLOBAL_APP_PATHS,
  LEGACY_APP_HOME_PATH,
} from "@/lib/routes";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const LearnPage = lazy(() => import("@/pages/LearnPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const PublicSectionPage = lazy(() => import("@/pages/PublicSectionPage"));
const ClassesPanel = lazy(() => import("@/components/ClassesPanel"));
const TeacherMarkets = lazy(() => import("@/components/teacher/TeacherMarkets"));
const ClassOverviewPage = lazy(() => import("@/features/classes/pages/ClassOverviewPage"));
const EditClassPage = lazy(() => import("@/features/classes/pages/EditClassPage"));

const hexToHslTriplet = (hex) => {
  const normalized = hex.replace("#", "");
  if (![3, 6].includes(normalized.length)) {
    return null;
  }

  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        h = 60 * ((b - r) / delta + 2);
        break;
      default:
        h = 60 * ((r - g) / delta + 4);
        break;
    }
  }

  const hue = Math.round(h < 0 ? h + 360 : h);
  const saturation = Number((s * 100).toFixed(1));
  const lightness = Number((l * 100).toFixed(1));
  return `${hue} ${saturation}% ${lightness}%`;
};

const ScreenLoader = ({ title, subtitle }) => (
  <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
    </div>
  </div>
);

const RouteFallback = () => {
  const { t } = useTranslation();
  return (
    <ScreenLoader
      title={t("app.loading.title")}
      subtitle={t("app.loading.subtitle")}
    />
  );
};

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useTradingContext();
  const { t } = useTranslation();

  if (isLoading) {
    return <ScreenLoader title={t("app.loading.title")} subtitle={t("app.loading.subtitle")} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const AuthRoute = () => {
  const { isAuthenticated, isLoading } = useTradingContext();
  const { t } = useTranslation();

  if (isLoading) {
    return <ScreenLoader title={t("common.states.loading")} />;
  }

  if (isAuthenticated) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return <Outlet />;
};

const ConnectionBanner = ({ connectionIssue }) => {
  const { t } = useTranslation();

  if (!connectionIssue) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-4 z-[100] w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-destructive/30 bg-background/95 px-5 py-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-destructive">
            {connectionIssue.title || t("app.connection.networkErrorTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {connectionIssue.description || t("app.connection.serverUnavailable")}
          </p>
          {connectionIssue.details ? (
            <p className="mt-2 break-words text-xs text-muted-foreground/80">
              {t("app.connection.technicalDetails", { details: connectionIssue.details })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
          onClick={() => window.location.reload()}
        >
          {t("common.actions.retry")}
        </button>
      </div>
    </div>
  );
};

const PageScroller = ({ children, className = "mx-auto w-full max-w-7xl p-4 md:p-6" }) => (
  <div className={`scrollbar-dashboard h-full overflow-y-auto overflow-x-hidden ${className}`}>
    {children}
  </div>
);

const AppearanceBridge = () => {
  const { appearanceState, accessibilityState } = useTradingContext();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const storedTheme = appearanceState?.themeMode || window.localStorage.getItem("theme") || "dark";
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const applyResolvedTheme = () => {
      const nextTheme = storedTheme === "auto" ? (mediaQuery?.matches ? "dark" : "light") : storedTheme;
      root.classList.remove("light", "dark");
      root.classList.add(nextTheme);
      window.localStorage.setItem("theme", storedTheme);
    };

    const primaryColor = appearanceState?.primaryColor || "#3b82f6";
    const secondaryColor = appearanceState?.secondaryColor || "#0f172a";
    const borderRadius = appearanceState?.borderStyle === "standard" ? "0.5rem" : "1.1rem";

    const primaryHsl = hexToHslTriplet(primaryColor);
    const secondaryHsl = hexToHslTriplet(secondaryColor);

    if (primaryHsl) {
      root.style.setProperty("--primary", primaryHsl);
    }

    if (secondaryHsl) {
      root.style.setProperty("--secondary", secondaryHsl);
      root.style.setProperty("--accent", secondaryHsl);
      root.style.setProperty("--muted", secondaryHsl);
    }

    root.style.setProperty("--radius", borderRadius);
    root.dataset.fontSize = appearanceState?.fontSize || "medium";
    root.dataset.componentSize = appearanceState?.componentSize || "medium";
    root.dataset.dashboardStyle = appearanceState?.dashboardStyle || "technical";
    root.dataset.reducedMotion = accessibilityState?.reducedMotion ? "true" : "false";
    root.dataset.highContrast = accessibilityState?.highContrast ? "true" : "false";
    root.dataset.keyboardNavigation = accessibilityState?.keyboardNavigation ? "true" : "false";
    root.dataset.screenReaderFriendly = accessibilityState?.screenReaderFriendly ? "true" : "false";
    root.dataset.colorBlindSafe = accessibilityState?.colorBlindSafe ? "true" : "false";
    root.dataset.underlineLinks = accessibilityState?.underlineLinks ? "true" : "false";
    root.dataset.strongFocusIndicators = accessibilityState?.strongFocusIndicators ? "true" : "false";

    applyResolvedTheme();

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", applyResolvedTheme);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(applyResolvedTheme);
    }

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", applyResolvedTheme);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(applyResolvedTheme);
      }
    };
  }, [accessibilityState, appearanceState]);

  return null;
};

const SettingsRouteElement = () => {
  const { appearanceState, accessibilityState, updateAppearanceState } = useTradingContext();
  const [resolvedTheme, setResolvedTheme] = useState("dark");

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const storedTheme = appearanceState?.themeMode || window.localStorage.getItem("theme") || "dark";
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const applyResolvedTheme = () => {
      const nextTheme = storedTheme === "auto" ? (mediaQuery?.matches ? "dark" : "light") : storedTheme;
      setResolvedTheme(nextTheme);
      root.classList.remove("light", "dark");
      root.classList.add(nextTheme);
      window.localStorage.setItem("theme", storedTheme);
    };

    const primaryColor = appearanceState?.primaryColor || "#3b82f6";
    const secondaryColor = appearanceState?.secondaryColor || "#0f172a";
    const borderRadius = appearanceState?.borderStyle === "standard" ? "0.5rem" : "1.1rem";

    const primaryHsl = hexToHslTriplet(primaryColor);
    const secondaryHsl = hexToHslTriplet(secondaryColor);

    if (primaryHsl) {
      root.style.setProperty("--primary", primaryHsl);
    }

    if (secondaryHsl) {
      root.style.setProperty("--secondary", secondaryHsl);
      root.style.setProperty("--accent", secondaryHsl);
      root.style.setProperty("--muted", secondaryHsl);
    }

    root.style.setProperty("--radius", borderRadius);
    root.dataset.fontSize = appearanceState?.fontSize || "medium";
    root.dataset.componentSize = appearanceState?.componentSize || "medium";
    root.dataset.dashboardStyle = appearanceState?.dashboardStyle || "technical";
    root.dataset.reducedMotion = accessibilityState?.reducedMotion ? "true" : "false";
    root.dataset.highContrast = accessibilityState?.highContrast ? "true" : "false";
    root.dataset.keyboardNavigation = accessibilityState?.keyboardNavigation ? "true" : "false";
    root.dataset.screenReaderFriendly = accessibilityState?.screenReaderFriendly ? "true" : "false";
    root.dataset.colorBlindSafe = accessibilityState?.colorBlindSafe ? "true" : "false";
    root.dataset.underlineLinks = accessibilityState?.underlineLinks ? "true" : "false";
    root.dataset.strongFocusIndicators = accessibilityState?.strongFocusIndicators ? "true" : "false";

    applyResolvedTheme();

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", applyResolvedTheme);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(applyResolvedTheme);
    }

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", applyResolvedTheme);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(applyResolvedTheme);
      }
    };
  }, [accessibilityState, appearanceState]);

  return (
    <PageScroller className="h-full w-full p-0">
      <SettingsPage
        currentTheme={resolvedTheme}
        setThemeMode={(mode) => updateAppearanceState?.({ themeMode: mode })}
      />
    </PageScroller>
  );
};

function AppContent() {
  const { connectionIssue, accessibilityState } = useTradingContext();
  const { t } = useTranslation();

  return (
    <Router>
      <AppearanceBridge />
      {accessibilityState?.keyboardNavigation ? (
        <a
          href="#app-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          {t("app.accessibility.skipToMain")}
        </a>
      ) : null}

      <ConnectionBanner connectionIssue={connectionIssue} />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/plataforma-info" element={<PublicSectionPage />} />
          <Route path="/mercados" element={<PublicSectionPage />} />
          <Route path="/funcionalidades" element={<PublicSectionPage />} />
          <Route path="/aprendizaje" element={<PublicSectionPage />} />
          <Route path="/acerca-de" element={<PublicSectionPage />} />
          <Route path="/contacto" element={<PublicSectionPage />} />

          <Route element={<AuthRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path={LEGACY_APP_HOME_PATH} element={<Navigate to={APP_HOME_PATH} replace />} />
            <Route path={APP_ROOT_PATH} element={<AppLayout />}>
              <Route index element={<Navigate to={APP_HOME_PATH} replace />} />
              <Route
                path="classes"
                element={
                  <PageScroller>
                    <ClassesPanel />
                  </PageScroller>
                }
              />
              <Route
                path="learn"
                element={
                  <PageScroller>
                    <LearnPage />
                  </PageScroller>
                }
              />
              <Route element={<ClassRouteGuard />}>
                <Route
                  path="classes/:classId"
                  element={<ClassOverviewPage />}
                />
                <Route path={`classes/:classId/${CLASS_CONTEXT_PATHS.dashboard}`} element={<Dashboard />} />
                <Route
                  path={`classes/:classId/${CLASS_CONTEXT_PATHS.markets}`}
                  element={
                    <PageScroller>
                      <TeacherMarkets />
                    </PageScroller>
                  }
                />
              </Route>
              <Route element={<ClassRouteGuard requiredRole="teacher" />}>
                <Route
                  path={`classes/:classId/${CLASS_CONTEXT_PATHS.editClass}`}
                  element={<EditClassPage />}
                />
              </Route>
              <Route path="settings" element={<SettingsRouteElement />} />
              <Route path="learn" element={<LearnPage />} />
              <Route
                path="support"
                element={
                  <PageScroller>
                    <HelpPage />
                  </PageScroller>
                }
              />
              <Route path="help" element={<Navigate to={GLOBAL_APP_PATHS.support} replace />} />
            </Route>
          </Route>

          <Route path="/markets" element={<Navigate to="/mercados" replace />} />
          <Route path="/classes" element={<Navigate to={GLOBAL_APP_PATHS.classes} replace />} />
          <Route path="/settings" element={<Navigate to={GLOBAL_APP_PATHS.settings} replace />} />
          <Route path="/help" element={<Navigate to={GLOBAL_APP_PATHS.support} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <Toaster />
    </Router>
  );
}

function App() {
  return (
    <TradingProvider>
      <AppContent />
    </TradingProvider>
  );
}

export default App;
