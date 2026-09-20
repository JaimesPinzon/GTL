export const ROUTE_LOADERS = {
  dashboard: () => import("@/pages/Dashboard"),
  login: () => import("@/pages/Login"),
  register: () => import("@/pages/Register"),
  learn: () => import("@/pages/LearnPage"),
  settings: () => import("@/pages/SettingsPage"),
  support: () => import("@/pages/HelpPage"),
  news: () => import("@/features/news/pages/NewsPage"),
  newsArticle: () => import("@/features/news/pages/NewsArticlePage"),
  landing: () => import("@/pages/LandingPage"),
  publicSection: () => import("@/pages/PublicSectionPage"),
  classes: () => import("@/components/ClassesPanel"),
  markets: () => import("@/components/teacher/TeacherMarkets"),
  classOverview: () => import("@/features/classes/pages/ClassOverviewPage"),
  classPortfolio: () => import("@/features/classes/pages/ClassPortfolioPage"),
  classAcademic: () => import("@/features/classes/pages/ClassAcademicPage"),
  classAudit: () => import("@/features/classes/pages/ClassAuditPage"),
  classLayout: () => import("@/features/classes/layouts/ClassLayout"),
  editClass: () => import("@/features/classes/pages/EditClassPage"),
  financialLab: () => import("@/features/financial-lab/pages/FinancialLabPage"),
};

const loadedRoutes = new Set();
const pendingRoutes = new Map();

export function preloadRoute(routeId) {
  const loader = ROUTE_LOADERS[routeId];
  if (!loader || loadedRoutes.has(routeId)) return Promise.resolve();
  if (pendingRoutes.has(routeId)) return pendingRoutes.get(routeId);

  const request = loader()
    .then((module) => {
      loadedRoutes.add(routeId);
      pendingRoutes.delete(routeId);
      return module;
    })
    .catch((error) => {
      pendingRoutes.delete(routeId);
      throw error;
    });

  pendingRoutes.set(routeId, request);
  return request;
}

export function getRouteIdForPath(pathname = "") {
  if (/^\/app\/classes\/[^/]+\/portfolios(?:\/|$)/.test(pathname)) return "classPortfolio";
  if (/^\/app\/classes\/[^/]+\/(?:dashboard|markets\/trade)(?:\/|$)/.test(pathname)) return "dashboard";
  if (/^\/app\/classes\/[^/]+\/markets(?:\/|$)/.test(pathname)) return "markets";
  if (/^\/app\/classes\/[^/]+\/(?:financial-lab|lab)(?:\/|$)/.test(pathname)) return "financialLab";
  if (/^\/app\/classes\/[^/]+\/academic(?:\/|$)/.test(pathname)) return "classAcademic";
  if (/^\/app\/classes\/[^/]+(?:\/|$)/.test(pathname)) return "classOverview";
  if (pathname.startsWith("/app/news")) return "news";
  if (pathname.startsWith("/app/learn")) return "learn";
  if (pathname.startsWith("/app/settings")) return "settings";
  if (pathname.startsWith("/app/support")) return "support";
  if (pathname.startsWith("/app/classes")) return "classes";
  return null;
}

export function preloadPath(pathname) {
  const routeId = getRouteIdForPath(pathname);
  return routeId ? preloadRoute(routeId) : Promise.resolve();
}

export function preloadDashboardDestinations() {
  return Promise.allSettled([
    "classes",
    "news",
    "classOverview",
    "markets",
    "classPortfolio",
    "classAcademic",
    "financialLab",
  ].map(preloadRoute));
}
