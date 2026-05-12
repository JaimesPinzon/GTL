export const PUBLIC_HOME_PATH = "/";
export const APP_ROOT_PATH = "/app";
export const APP_HOME_PATH = `${APP_ROOT_PATH}/classes`;
export const LEGACY_APP_HOME_PATH = "/plataforma";

export const GLOBAL_APP_PATHS = {
  classes: `${APP_ROOT_PATH}/classes`,
  settings: `${APP_ROOT_PATH}/settings`,
  support: `${APP_ROOT_PATH}/support`,
};

export const CLASS_CONTEXT_PATHS = {
  dashboard: "dashboard",
  markets: "markets",
  editClass: "edictclass",
};

export const CLASS_CONTEXT_NAV_ITEMS = [
  { id: "dashboard", path: CLASS_CONTEXT_PATHS.dashboard },
  { id: "markets", path: CLASS_CONTEXT_PATHS.markets },
];

export const buildClassHomeRoute = (classId) => `${APP_ROOT_PATH}/classes/${classId}`;
export const buildClassEditRoute = (classId) => `${APP_ROOT_PATH}/classes/${classId}/${CLASS_CONTEXT_PATHS.editClass}`;

export const buildClassRoute = (classId, section = CLASS_CONTEXT_PATHS.dashboard) =>
  `${APP_ROOT_PATH}/classes/${classId}/${section}`;

export const normalizeHomePath = () => APP_HOME_PATH;

export const resolvePreferredHomePage = () => APP_HOME_PATH;
