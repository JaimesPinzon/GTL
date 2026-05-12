import { getAuthBackendUrl } from "@/lib/env";
import { syncSupabaseAccessToken } from "@/lib/supabase";

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
  syncSupabaseAccessToken(token || null);
};

const clearAccessToken = () => {
  accessToken = null;
  accessTokenExpiresAt = 0;
  syncSupabaseAccessToken(null);
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

const request = async (path, { method = "GET", body, auth = false, csrf = false, headers: customHeaders } = {}) => {
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

  const response = await fetch(getAuthBackendUrl(path), {
    method: normalizedMethod,
    credentials: "include",
    headers,
    body: shouldSendJsonBody ? JSON.stringify(body) : undefined,
  });

  return parseJson(response);
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

export const restoreSession = async () => {
  try {
    const payload = await request("/api/auth/restore", {
      method: "GET",
    });
    applySessionPayload(payload, "bootstrap");
    return payload;
  } catch (error) {
    if (
      (error?.status === 401 &&
        (error?.payload?.error === "Refresh cookie is missing." ||
          error?.payload?.error === "Refresh token is invalid.")) ||
      (error?.status === 500 && error?.payload?.error === "Internal server error.")
    ) {
      clearAccessToken();
      setCsrfToken("");
      return null;
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
  return applySessionPayload(payload, "login");
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
        if (source !== "bootstrap") {
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

  const payload = await refreshSession("access-expired");
  return payload.accessToken;
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
