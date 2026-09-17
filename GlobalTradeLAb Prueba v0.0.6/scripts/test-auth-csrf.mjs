import assert from "node:assert/strict";
import { test } from "node:test";

import { createModuleLoader } from "./helpers/load-module.mjs";

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

const createAuthHarness = ({ fetchImpl }) => {
  const deletedCookies = [];
  const storage = new Map();
  const document = {
    get cookie() {
      // Simulates an old cookie owned by globaltradelab.site. The auth client
      // must never use this value for requests to api.globaltradelab.site.
      return "gtl_csrf=legacy-frontend-token";
    },
    set cookie(value) {
      deletedCookies.push(value);
    },
  };
  const window = {
    location: {
      hash: "",
      search: "",
      protocol: "https:",
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout,
  };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
      signInWithPassword: async () => ({ data: { session: null }, error: null }),
    },
  };
  const load = createModuleLoader(
    {
      "@/lib/env": {
        getAuthBackendUrl: (path) => `https://api.globaltradelab.site${path}`,
      },
      "@/lib/auth-config": {
        getOAuthRedirectUrl: () => "https://globaltradelab.site/login",
      },
      "@/lib/supabase": {
        getCachedSupabaseAccessToken: () => null,
        isSupabaseAccessToken: () => false,
        supabase,
        syncSupabaseAccessToken: () => {},
      },
    },
    {
      document,
      fetch: fetchImpl,
      window,
    }
  );

  return {
    auth: load("src/lib/auth-api.js"),
    deletedCookies,
  };
};

test("uses the CSRF token returned by JSON and ignores a stale frontend cookie", async () => {
  const calls = [];
  const { auth, deletedCookies } = createAuthHarness({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/api/auth/csrf")) {
        return jsonResponse(200, { ok: true, csrfToken: "server-token" });
      }
      if (url.endsWith("/api/auth/refresh")) {
        assert.equal(options.credentials, "include");
        assert.equal(options.headers["X-CSRF-Token"], "server-token");
        return jsonResponse(200, {
          ok: true,
          accessToken: "backend-access-token",
          accessTokenExpiresIn: 900,
          csrfToken: "rotated-server-token",
          user: { id: "user-1" },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  await auth.bootstrapCsrf();
  await auth.refreshSession();

  assert.equal(calls.filter(({ url }) => url.endsWith("/api/auth/csrf")).length, 1);
  assert.ok(deletedCookies.some((cookie) => cookie.startsWith("gtl_csrf=; Path=/; Max-Age=0")));
  assert.ok(deletedCookies.some((cookie) => cookie.startsWith("__Host-gtl_csrf=; Path=/; Max-Age=0")));
});

test("deduplicates concurrent refresh requests", async () => {
  let refreshCalls = 0;
  let resolveRefresh;
  const refreshResponse = new Promise((resolve) => {
    resolveRefresh = resolve;
  });
  const { auth } = createAuthHarness({
    fetchImpl: async (url) => {
      if (url.endsWith("/api/auth/csrf")) {
        return jsonResponse(200, { ok: true, csrfToken: "csrf-token" });
      }
      if (url.endsWith("/api/auth/refresh")) {
        refreshCalls += 1;
        return refreshResponse;
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const firstRefresh = auth.refreshSession("access-expired");
  const secondRefresh = auth.refreshSession("retry-after-401");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(refreshCalls, 1);
  resolveRefresh(
    jsonResponse(200, {
      ok: true,
      accessToken: "backend-access-token",
      accessTokenExpiresIn: 900,
      csrfToken: "next-csrf-token",
      user: { id: "user-1" },
    })
  );
  await Promise.all([firstRefresh, secondRefresh]);
  assert.equal(refreshCalls, 1);
});

test("shares one CSRF recovery across simultaneous failed mutations", async () => {
  let csrfCalls = 0;
  const mutationTokens = [];
  const { auth } = createAuthHarness({
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith("/api/auth/csrf")) {
        csrfCalls += 1;
        return jsonResponse(200, {
          ok: true,
          csrfToken: csrfCalls === 1 ? "initial-token" : "recovered-token",
        });
      }
      if (url.endsWith("/api/auth/logout") || url.endsWith("/api/auth/logout-all")) {
        const token = options.headers["X-CSRF-Token"];
        mutationTokens.push(token);
        if (token === "initial-token") {
          return jsonResponse(403, { ok: false, error: "CSRF validation failed." });
        }
        assert.equal(token, "recovered-token");
        return jsonResponse(200, { ok: true });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  await auth.bootstrapCsrf();
  await Promise.all([auth.logoutSession(), auth.logoutAllSessions()]);

  assert.equal(csrfCalls, 2);
  assert.deepEqual(
    mutationTokens.sort(),
    ["initial-token", "initial-token", "recovered-token", "recovered-token"].sort()
  );
});
