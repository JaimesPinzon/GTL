export const PUBLIC_HOME_PATH = "/";
export const APP_ROOT_PATH = "/app";
export const APP_HOME_PATH = `${APP_ROOT_PATH}/classes`;
export const LEGACY_APP_HOME_PATH = "/plataforma";

export const GLOBAL_APP_PATHS = {
  classes: `${APP_ROOT_PATH}/classes`,
  learn: `${APP_ROOT_PATH}/learn`,
  news: `${APP_ROOT_PATH}/news`,
  settings: `${APP_ROOT_PATH}/settings`,
  support: `${APP_ROOT_PATH}/support`,
};

export const CLASS_CONTEXT_PATHS = {
  menu: "menu",
  overview: "overview",
  dashboard: "dashboard",
  markets: "markets",
  trading: "markets/trade",
  financialLab: "lab",
  legacyFinancialLab: "financial-lab",
  portfolios: "portfolios",
  academic: "academic",
  academicActivities: "academic/activities",
  academicSubmissions: "academic/submissions",
  academicForums: "academic/forums",
  academicGrades: "academic/grades",
  academicStudents: "academic/students",
  audit: "audit",
  editClass: "settings",
  legacyEditClass: "edictclass",
};

export const CLASS_CONTEXT_NAV_ITEMS = [
  { id: "dashboard", path: CLASS_CONTEXT_PATHS.dashboard },
  { id: "overview", path: CLASS_CONTEXT_PATHS.overview },
  { id: "markets", path: CLASS_CONTEXT_PATHS.markets },
  { id: "financialLab", path: CLASS_CONTEXT_PATHS.financialLab },
  { id: "portfolios", path: CLASS_CONTEXT_PATHS.portfolios },
  { id: "academic", path: CLASS_CONTEXT_PATHS.academic },
];

export const buildClassHomeRoute = (classId) => buildClassRoute(classId, CLASS_CONTEXT_PATHS.overview);
export const buildClassEditRoute = (classId) => `${APP_ROOT_PATH}/classes/${classId}/${CLASS_CONTEXT_PATHS.editClass}`;

export const buildClassRoute = (classId, section = CLASS_CONTEXT_PATHS.overview) =>
  `${APP_ROOT_PATH}/classes/${classId}/${section}`;

export const buildNewsArticleRoute = (newsId) => `${GLOBAL_APP_PATHS.news}/${encodeURIComponent(newsId)}`;
export const buildNewsSymbolRoute = (symbol) => `${GLOBAL_APP_PATHS.news}/symbol/${encodeURIComponent(symbol)}`;

export const normalizeHomePath = () => APP_HOME_PATH;

export const resolvePreferredHomePage = () => APP_HOME_PATH;
