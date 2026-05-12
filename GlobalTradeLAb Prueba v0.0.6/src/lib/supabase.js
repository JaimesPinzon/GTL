import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const storageKey = "sb-stdwhmaenhibnaammwdj-auth-token";

const readTokenFromStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storageCandidates = [window.localStorage, window.sessionStorage].filter(Boolean);

  for (const storage of storageCandidates) {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (token) {
        return token;
      }

      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const nestedToken = entry?.access_token || entry?.currentSession?.access_token;
          if (nestedToken) {
            return nestedToken;
          }
        }
      }
    } catch {
      // ignore malformed entries
    }
  }

  return null;
};

let cachedAccessToken = readTokenFromStorage();

export const syncSupabaseAccessToken = (token) => {
  cachedAccessToken = token || null;

  if (typeof window === "undefined") {
    return;
  }

  const nextValue = token
    ? JSON.stringify({
        access_token: token,
        currentSession: {
          access_token: token,
        },
      })
    : null;

  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((storage) => {
    if (nextValue) {
      storage.setItem(storageKey, nextValue);
      return;
    }

    storage.removeItem(storageKey);
  });
};

export const clearSupabaseAuthStorage = () => {
  if (typeof window === "undefined") {
    cachedAccessToken = null;
    return;
  }

  [window.localStorage, window.sessionStorage].filter(Boolean).forEach((storage) => {
    storage.removeItem(storageKey);
  });

  cachedAccessToken = null;
};

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    accessToken: async () => cachedAccessToken || readTokenFromStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token || readTokenFromStorage();
});

export const getCachedSupabaseAccessToken = () => cachedAccessToken || readTokenFromStorage();
