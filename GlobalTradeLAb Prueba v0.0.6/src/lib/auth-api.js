import { getAuthBackendUrl } from "@/lib/env";
import { getOAuthRedirectUrl } from "@/lib/auth-config";
import {
  getCachedSupabaseAccessToken,
  isSupabaseAccessToken,
  supabase,
  syncSupabaseAccessToken,
} from "@/lib/supabase";

const authListeners = new Set();
const broadcastChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("gtl-auth")
    : null;

let accessToken = null;
let accessTokenExpiresAt = 0;
let refreshPromise = null;
let csrfBootstrapPromise = null;
let csrfFailureCooldownUntil = 0;
let csrfToken = "";

const AUTH_RESTORE_HINT_KEY = "gtl_auth_restore_hint";
const OAUTH_CALLBACK_SESSION_ATTEMPTS = 40;
const OAUTH_CALLBACK_SESSION_DELAY_MS = 200;
const OAUTH_BRIDGE_RETRY_ATTEMPTS = 24;
const OAUTH_BRIDGE_RETRY_DELAY_MS = 250;

const decodeJwtPayload = (token) => {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const isTokenExpiredOrNearExpiry = (token, leewaySeconds = 20) => {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) {
    return false;
  }

  return exp * 1000 <= Date.now() + leewaySeconds * 1000;
};

const isSupabaseSessionMissingError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "AuthSessionMissingError" || message.includes("auth session missing");
};

const isSupabaseClockSkewError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const payloadMessage = String(error?.payload?.error || error?.payload?.error_description || "").toLowerCase();
  const combinedMessage = `${message} ${payloadMessage}`;

  return (
    combinedMessage.includes("issued in the future") ||
    combinedMessage.includes("clock for skew") ||
    combinedMessage.includes("not yet valid") ||
    (combinedMessage.includes("iat") && combinedMessage.includes("future"))
  );
};

const setAuthRestoreHint = (enabled) => {
  if (typeof window === "undefined") {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(AUTH_RESTORE_HINT_KEY, "1");
    return;
  }

  window.localStorage.removeItem(AUTH_RESTORE_HINT_KEY);
};

const hasOAuthCallbackTokensInUrl = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const hash = String(window.location.hash || "");
  if (hash.includes("access_token=") || hash.includes("refresh_token=")) {
    return true;
  }

  const searchParams = new URLSearchParams(window.location.search || "");
  return Boolean(searchParams.get("code"));
};

const extractTokenFromHash = (tokenName) => {
  if (typeof window === "undefined") {
    return "";
  }

  const rawHash = String(window.location.hash || "");
  const hash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  if (!hash) {
    return "";
  }

  const params = new URLSearchParams(hash);
  return String(params.get(tokenName) || "").trim();
};

const extractTokenFromSearch = (tokenName) => {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search || "");
  return String(params.get(tokenName) || "").trim();
};

const getOAuthCallbackAccessTokenFromUrl = () =>
  extractTokenFromHash("access_token") || extractTokenFromSearch("access_token");

const wait = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const hasClientSessionHints = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (hasOAuthCallbackTokensInUrl()) {
    return true;
  }

  const cachedToken = getCachedSupabaseAccessToken();
  if (cachedToken && !isTokenExpiredOrNearExpiry(cachedToken)) {
    return true;
  }

  return window.localStorage.getItem(AUTH_RESTORE_HINT_KEY) === "1";
};

const emitAuthEvent = (event) => {
  authListeners.forEach((listener) => {
    listener(event);
  });

  broadcastChannel?.postMessage(event);
};

broadcastChannel?.addEventListener("message", (message) => {
  const event = message.data;

  if (event?.csrfToken) {
    csrfToken = event.csrfToken;
  }

  authListeners.forEach((listener) => {
    listener(event);
  });
});

const setAccessToken = (token, expiresInSeconds = 0) => {
  accessToken = token || null;
  accessTokenExpiresAt = token ? Date.now() + Math.max(0, expiresInSeconds - 10) * 1000 : 0;
  if (!token) {
    return;
  }

  if (isSupabaseAccessToken(token)) {
    syncSupabaseAccessToken(token);
  }
};

const clearAccessToken = () => {
  accessToken = null;
  accessTokenExpiresAt = 0;
  setAuthRestoreHint(false);
};

const ensureSupabasePasswordSession = async ({ email, password }) => {
  if (!email || !password) {
    return;
  }

  const { data: currentSessionData, error: currentSessionError } = await supabase.auth.getSession();
  if (!currentSessionError && currentSessionData?.session?.access_token) {
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  const supabaseAccessToken = data?.session?.access_token || null;
  if (supabaseAccessToken) {
    syncSupabaseAccessToken(supabaseAccessToken);
  }
};

const setCsrfToken = (nextCsrfToken) => {
  csrfToken = nextCsrfToken || "";
};

const getCsrfToken = () => csrfToken;

const jsonHeaders = {
  "Content-Type": "application/json",
};

const parseJson = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || "Request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const isCsrfValidationError = (error) => {
  if (error?.status !== 403) {
    return false;
  }

  const message = String(error?.payload?.error || error?.message || "").toLowerCase();
  return message.includes("csrf");
};

const request = async (
  path,
  {
    method = "GET",
    body,
    auth = false,
    csrf = false,
    credentials = "include",
    headers: customHeaders,
    retryOnCsrfFailure = true,
  } = {}
) => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const shouldSendJsonBody = body !== undefined && body !== null && !["GET", "HEAD"].includes(normalizedMethod);
  const headers = {
    ...(shouldSendJsonBody ? jsonHeaders : {}),
    ...(customHeaders || {}),
  };

  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (csrf) {
    const currentCsrfToken = getCsrfToken();
    if (!currentCsrfToken) {
      await bootstrapCsrf();
    }

    headers["X-CSRF-Token"] = getCsrfToken();
  }

  try {
    const response = await fetch(getAuthBackendUrl(path), {
      method: normalizedMethod,
      credentials,
      headers,
      body: shouldSendJsonBody ? JSON.stringify(body) : undefined,
    });

    return await parseJson(response);
  } catch (error) {
    if (!csrf || !retryOnCsrfFailure || !isCsrfValidationError(error)) {
      throw error;
    }

    setCsrfToken("");
    await bootstrapCsrf();

    return request(path, {
      method: normalizedMethod,
      body,
      auth,
      csrf,
      credentials,
      headers: customHeaders,
      retryOnCsrfFailure: false,
    });
  }
};

export const bootstrapCsrf = async () => {
  if (getCsrfToken()) {
    return getCsrfToken();
  }

  if (Date.now() < csrfFailureCooldownUntil) {
    const error = new Error("CSRF bootstrap is temporarily paused after a recent failure.");
    error.code = "CSRF_BOOTSTRAP_COOLDOWN";
    throw error;
  }

  csrfBootstrapPromise =
    csrfBootstrapPromise ||
    request("/api/auth/csrf")
      .then((payload) => {
        csrfBootstrapPromise = null;
        csrfFailureCooldownUntil = 0;
        setCsrfToken(payload.csrfToken);
        return payload.csrfToken;
      })
      .catch((error) => {
        csrfBootstrapPromise = null;
        csrfFailureCooldownUntil = Date.now() + 5000;
        throw error;
      });

  return csrfBootstrapPromise;
};

const applySessionPayload = (payload, source) => {
  setAccessToken(payload.accessToken, payload.accessTokenExpiresIn);
  setAuthRestoreHint(Boolean(payload?.user && payload?.accessToken));
  if (payload.csrfToken) {
    setCsrfToken(payload.csrfToken);
  }
  // El bootstrap inicial ya actualiza el estado local de auth; reenviar ese mismo evento
  // provoca sincronizaciones duplicadas y carreras en el contexto.
  if (source !== "bootstrap") {
    emitAuthEvent({
      type: "session-updated",
      source,
      user: payload.user,
      csrfToken: payload.csrfToken || getCsrfToken(),
    });
  }
  return payload;
};

const resolveSupabaseAccessTokenForBridge = async () => {
  if (hasOAuthCallbackTokensInUrl()) {
    const tokenFromUrl = getOAuthCallbackAccessTokenFromUrl();
    if (tokenFromUrl && !isTokenExpiredOrNearExpiry(tokenFromUrl)) {
      return tokenFromUrl;
    }

    for (let attempt = 0; attempt < OAUTH_CALLBACK_SESSION_ATTEMPTS; attempt += 1) {
      const { data, error } = await supabase.auth.getSession();
      if (error && !isSupabaseSessionMissingError(error) && !isSupabaseClockSkewError(error)) {
        throw error;
      }

      const callbackSessionToken = data?.session?.access_token || null;
      if (callbackSessionToken && !isTokenExpiredOrNearExpiry(callbackSessionToken)) {
        return callbackSessionToken;
      }

      if (attempt < OAUTH_CALLBACK_SESSION_ATTEMPTS - 1) {
        await wait(OAUTH_CALLBACK_SESSION_DELAY_MS);
      }
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (isSupabaseSessionMissingError(error) || isSupabaseClockSkewError(error)) {
      return null;
    }
    throw error;
  }

  const sessionAccessToken = data?.session?.access_token;
  if (sessionAccessToken && !isTokenExpiredOrNearExpiry(sessionAccessToken)) {
    return sessionAccessToken;
  }

  const cachedToken = getCachedSupabaseAccessToken();
  if (cachedToken && !isTokenExpiredOrNearExpiry(cachedToken)) {
    return cachedToken;
  }

  if (!sessionAccessToken && !cachedToken) {
    return null;
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    if (isSupabaseSessionMissingError(refreshError)) {
      return null;
    }
    throw refreshError;
  }

  return refreshedData?.session?.access_token || null;
};

const bootstrapBackendSessionFromSupabase = async (source = "oauth-bridge") => {
  let accessToken = await resolveSupabaseAccessTokenForBridge();
  if (!accessToken) {
    return null;
  }

  let payload = null;
  const isOAuthCallback = hasOAuthCallbackTokensInUrl();
  const maxAttempts = isOAuthCallback ? OAUTH_BRIDGE_RETRY_ATTEMPTS : 2;
  let lastInvalidTokenError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      payload = await request("/api/auth/oauth-login", {
        method: "POST",
        body: {
          accessToken,
        },
      });
      break;
    } catch (error) {
      const normalizedMessage = String(error?.payload?.error || error?.message || "").toLowerCase();
      const invalidSupabaseToken = error?.status === 401 && normalizedMessage.includes("supabase access token is invalid");

      if (!invalidSupabaseToken) {
        throw error;
      }

      lastInvalidTokenError = error;

      if (attempt >= maxAttempts - 1) {
        break;
      }

      if (isOAuthCallback) {
        const tokenFromUrl = getOAuthCallbackAccessTokenFromUrl();
        if (tokenFromUrl && !isTokenExpiredOrNearExpiry(tokenFromUrl)) {
          accessToken = tokenFromUrl;
        } else {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError && !isSupabaseSessionMissingError(sessionError) && !isSupabaseClockSkewError(sessionError)) {
            throw error;
          }

          const callbackSessionToken = sessionData?.session?.access_token || null;
          if (callbackSessionToken) {
            accessToken = callbackSessionToken;
          }
        }

        await wait(OAUTH_BRIDGE_RETRY_DELAY_MS);
        continue;
      }

      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        if (isSupabaseSessionMissingError(refreshError)) {
          return null;
        }
        throw error;
      }

      accessToken = refreshedData?.session?.access_token || null;
      if (!accessToken) {
        throw error;
      }
    }
  }

  if (!payload && lastInvalidTokenError) {
    throw lastInvalidTokenError;
  }

  if (!payload) {
    return null;
  }

  return applySessionPayload(payload, source);
};

export const restoreSession = async () => {
  if (!hasClientSessionHints()) {
    clearAccessToken();
    setCsrfToken("");
    return null;
  }

  const isOAuthCallback = hasOAuthCallbackTokensInUrl();

  try {
    const bridgedPayload = await bootstrapBackendSessionFromSupabase(
      isOAuthCallback ? "oauth-bridge-callback" : "oauth-bridge-restore"
    );
    if (bridgedPayload) {
      return bridgedPayload;
    }
  } catch (bridgeError) {
    if (!isSupabaseSessionMissingError(bridgeError)) {
      console.error(isOAuthCallback ? "oauth bridge callback error" : "oauth bridge restore error", bridgeError);
    }
  }

  if (isOAuthCallback) {
    // During OAuth callback there is commonly no backend refresh cookie yet.
    // Avoid calling /restore here to prevent false-negative 401 loops.
    return null;
  }

  try {
    const payload = await request("/api/auth/restore", {
      method: "GET",
    });
    applySessionPayload(payload, "bootstrap");
    return payload;
  } catch (error) {
    if (
      error?.status === 401 &&
      (error?.payload?.error === "Refresh cookie is missing." ||
        error?.payload?.error === "Refresh token is invalid.")
    ) {
      clearAccessToken();
      setCsrfToken("");
      return null;
    }

    const shouldBubbleRecoverableError =
      !error?.status ||
      error?.status >= 500 ||
      String(error?.message || "").toLowerCase().includes("failed to fetch");

    if (shouldBubbleRecoverableError) {
      throw error;
    }

    clearAccessToken();
    setCsrfToken("");
    return null;
  }
};

export const loginWithPassword = async ({ email, password }) => {
  await bootstrapCsrf();
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
    csrf: true,
  });
  try {
    await ensureSupabasePasswordSession({ email, password });
  } catch (supabaseSessionError) {
    console.warn("loginWithPassword supabase session warning", supabaseSessionError);
  }
  return applySessionPayload(payload, "login");
};

export const loginWithGoogleOAuth = async () => {
  const redirectTo = getOAuthRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
};

export const registerWithPassword = async ({ name, email, password, role }) => {
  await bootstrapCsrf();
  const payload = await request("/api/auth/register", {
    method: "POST",
    body: { name, email, password, role },
    csrf: true,
  });
  return applySessionPayload(payload, "register");
};

export const refreshSession = async (source = "refresh") => {
  refreshPromise =
    refreshPromise ||
    request("/api/auth/refresh", {
      method: "POST",
      csrf: true,
    })
      .then((payload) => {
        refreshPromise = null;
        return applySessionPayload(payload, source);
      })
      .catch((error) => {
        refreshPromise = null;
        clearAccessToken();
        if (error?.status === 401 || error?.status === 403) {
          setCsrfToken("");
        }
        const shouldEmitForcedLogout = ![
          "bootstrap",
          "access-expired",
          "retry-after-401",
          "oauth-bridge-access",
        ].includes(source);

        if (shouldEmitForcedLogout) {
          emitAuthEvent({ type: "logged-out", source: "refresh-failed" });
        }
        throw error;
      });

  return refreshPromise;
};

export const logoutSession = async () => {
  try {
    await request("/api/auth/logout", {
      method: "POST",
      csrf: true,
    });
  } finally {
    clearAccessToken();
    setCsrfToken("");
    emitAuthEvent({ type: "logged-out", source: "logout" });
  }
};

export const logoutAllSessions = async () => {
  try {
    await request("/api/auth/logout-all", {
      method: "POST",
      csrf: true,
    });
  } finally {
    clearAccessToken();
    setCsrfToken("");
    emitAuthEvent({ type: "logged-out", source: "logout-all" });
  }
};

export const listSessions = async () => {
  const payload = await fetchWithAuth("/api/auth/sessions", {
    method: "GET",
  });
  return payload.sessions || [];
};

export const revokeSessionById = async (sessionId) => {
  const payload = await fetchWithAuth(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  return Boolean(payload?.revoked);
};

export const changePassword = async ({ currentPassword, newPassword }) => {
  await request("/api/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
    auth: true,
    csrf: true,
  });
  clearAccessToken();
  setCsrfToken("");
  emitAuthEvent({ type: "logged-out", source: "password-changed" });
  return true;
};

export const subscribeToAuthEvents = (listener) => {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
};

export const getAccessToken = async () => {
  if (accessToken && Date.now() < accessTokenExpiresAt) {
    return accessToken;
  }

  try {
    const payload = await refreshSession("access-expired");
    return payload.accessToken;
  } catch (refreshError) {
    const isRecoverableRefreshFailure = refreshError?.status === 401 || refreshError?.status === 403;
    if (!isRecoverableRefreshFailure) {
      throw refreshError;
    }

    const bridgedPayload = await bootstrapBackendSessionFromSupabase("oauth-bridge-access");
    if (bridgedPayload?.accessToken) {
      return bridgedPayload.accessToken;
    }

    throw refreshError;
  }
};

export const fetchWithAuth = async (path, options = {}) => {
  try {
    const token = await getAccessToken();
    return await request(path, {
      ...options,
      auth: true,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (error?.status === 401) {
      await refreshSession("retry-after-401");
      const token = await getAccessToken();
      return request(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    throw error;
  }
};
