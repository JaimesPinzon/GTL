import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const legacyStorageKey = "sb-stdwhmaenhibnaammwdj-auth-token";
const expectedIssuer = `${env.VITE_SUPABASE_URL}/auth/v1`;

const getProjectRefStorageKey = () => {
  try {
    const host = new URL(env.VITE_SUPABASE_URL).hostname;
    const projectRef = String(host || "").split(".")[0] || "";
    return projectRef ? `sb-${projectRef}-auth-token` : "";
  } catch {
    return "";
  }
};

const getStorageKeyCandidates = () => {
  const projectKey = getProjectRefStorageKey();
  return [projectKey, legacyStorageKey].filter(Boolean);
};

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

export const isSupabaseAccessToken = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const issuer = String(payload.iss || "");
  return Boolean(payload.sub) && issuer === expectedIssuer;
};

const extractSupabaseToken = (value) => {
  if (!value) {
    return null;
  }

  const token = value?.access_token || value?.currentSession?.access_token;
  return isSupabaseAccessToken(token) ? token : null;
};

const readTokenFromStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storageCandidates = [window.localStorage, window.sessionStorage].filter(Boolean);
  const keyCandidates = getStorageKeyCandidates();

  for (const storage of storageCandidates) {
    for (const key of keyCandidates) {
      const raw = storage.getItem(key);
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        const token = extractSupabaseToken(parsed);
        if (token) {
          return token;
        }

        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const nestedToken = extractSupabaseToken(entry);
            if (nestedToken) {
              return nestedToken;
            }
          }
        }
      } catch {
        // ignore malformed entries
      }

      // Cleanup stale/invalid payloads to avoid reusing non-Supabase tokens.
      storage.removeItem(key);
    }
  }

  return null;
};

let cachedAccessToken = readTokenFromStorage();

const refreshRealtimeAuthorization = (token = null) => {
  try {
    const nextToken = isSupabaseAccessToken(token) ? token : null;
    const setAuthPromise = nextToken
      ? supabase.realtime.setAuth(nextToken)
      : supabase.realtime.setAuth();

    Promise.resolve(setAuthPromise).catch((error) => {
      console.warn("supabase realtime setAuth warning", error);
    });
  } catch (error) {
    console.warn("supabase realtime setAuth warning", error);
  }
};

export const syncSupabaseAccessToken = (token) => {
  const safeToken = isSupabaseAccessToken(token) ? token : null;
  cachedAccessToken = safeToken;

  if (typeof window === "undefined") {
    return;
  }

  const keyCandidates = getStorageKeyCandidates();
  const nextValue = safeToken
    ? JSON.stringify({
        access_token: safeToken,
        currentSession: {
          access_token: safeToken,
        },
      })
    : null;

  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((storage) => {
    keyCandidates.forEach((key) => {
      if (nextValue) {
        storage.setItem(key, nextValue);
      } else {
        storage.removeItem(key);
      }
    });
  });

  refreshRealtimeAuthorization(safeToken);
};

export const clearSupabaseAuthStorage = () => {
  if (typeof window === "undefined") {
    cachedAccessToken = null;
    return;
  }

  const keyCandidates = getStorageKeyCandidates();
  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((storage) => {
    keyCandidates.forEach((key) => {
      storage.removeItem(key);
    });
  });

  cachedAccessToken = null;
};

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

supabase.auth.onAuthStateChange((_event, session) => {
  syncSupabaseAccessToken(session?.access_token || null);
});

void supabase.auth
  .getSession()
  .then(({ data }) => {
    const sessionToken = data?.session?.access_token || null;
    const token = sessionToken || cachedAccessToken || readTokenFromStorage();
    refreshRealtimeAuthorization(token);
    if (sessionToken) {
      syncSupabaseAccessToken(sessionToken);
    }
  })
  .catch(() => {
    refreshRealtimeAuthorization(cachedAccessToken || readTokenFromStorage());
  });

export const getCachedSupabaseAccessToken = () => cachedAccessToken || readTokenFromStorage();
