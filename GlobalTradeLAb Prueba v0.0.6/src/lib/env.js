const normalizeEnvValue = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^['"]|['"]$/g, "");
};

const getRequiredEnv = (key) => {
  const value = normalizeEnvValue(import.meta.env[key]);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const getOptionalEnv = (key, fallback = "") => {
  const value = normalizeEnvValue(import.meta.env[key]);
  return value || fallback;
};

const getRequiredUrlEnv = (key) => {
  const value = getRequiredEnv(key);

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL in environment variable: ${key}`);
  }
};

export const env = {
  VITE_SUPABASE_URL: getRequiredUrlEnv("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: getRequiredEnv("VITE_SUPABASE_ANON_KEY"),
  VITE_BACKEND_URL: getOptionalEnv("VITE_BACKEND_URL", ""),
  VITE_AUTH_BACKEND_URL: getOptionalEnv("VITE_AUTH_BACKEND_URL", ""),
  VITE_MARKET_BACKEND_URL: getOptionalEnv("VITE_MARKET_BACKEND_URL", ""),
};

const buildBackendUrl = (baseUrl, path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = normalizeEnvValue(baseUrl).replace(/\/$/, "");
  return normalizedBaseUrl ? `${normalizedBaseUrl}${normalizedPath}` : normalizedPath;
};

export const getBackendUrl = (path = "") => buildBackendUrl(env.VITE_BACKEND_URL, path);

export const getAuthBackendUrl = (path = "") =>
  buildBackendUrl(env.VITE_AUTH_BACKEND_URL || env.VITE_BACKEND_URL, path);

export const getMarketBackendUrl = (path = "") =>
  buildBackendUrl(env.VITE_MARKET_BACKEND_URL || env.VITE_BACKEND_URL, path);
