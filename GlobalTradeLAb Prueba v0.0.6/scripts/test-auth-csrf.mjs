import assert from "node:assert/strict";
import { test } from "node:test";

import { createModuleLoader } from "./helpers/load-module.mjs";

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

const createAuthHarness = ({ fetchImpl, sharedStorage, BroadcastChannelImpl, navigatorImpl }) => {
  const deletedCookies = [];
  const storage = sharedStorage || new Map();
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
  if (BroadcastChannelImpl) {
    window.BroadcastChannel = BroadcastChannelImpl;
  }
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
      ...(BroadcastChannelImpl ? { BroadcastChannel: BroadcastChannelImpl } : {}),
      ...(navigatorImpl ? { navigator: navigatorImpl } : {}),
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

  assert.equal(calls.filter(({ url }) => url.endsWith("/api/auth/csrf")).length, 2);
  assert.ok(deletedCookies.some((cookie) => cookie.startsWith("gtl_csrf=; Path=/; Max-Age=0")));
  assert.ok(deletedCookies.some((cookie) => cookie.startsWith("__Host-gtl_csrf=; Path=/; Max-Age=0")));
});

test("coordinates CSRF and refresh across two tabs", async () => {
  const channels = new Map();
  class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.listeners = new Set();
      const entries = channels.get(name) || new Set();
      entries.add(this);
      channels.set(name, entries);
    }
    addEventListener(type, listener) {
      if (type === "message") this.listeners.add(listener);
    }
    postMessage(data) {
      for (const channel of channels.get(this.name) || []) {
        if (channel === this) continue;
        for (const listener of channel.listeners) {
          setTimeout(() => listener({ data }), 0);
        }
      }
    }
  }

  let lockTail = Promise.resolve();
  const navigatorImpl = {
    locks: {
      request: (_name, _options, action) => {
        const result = lockTail.then(action);
        lockTail = result.catch(() => {});
        return result;
      },
    },
  };

  const backend = { csrfToken: "csrf-0", generation: 0, activeRequests: 0, maxActiveRequests: 0 };
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith("/api/auth/csrf")) {
      return jsonResponse(200, { ok: true, csrfToken: backend.csrfToken });
    }
    if (url.endsWith("/api/auth/refresh")) {
      backend.activeRequests += 1;
      backend.maxActiveRequests = Math.max(backend.maxActiveRequests, backend.activeRequests);
      try {
        assert.equal(options.headers["X-CSRF-Token"], backend.csrfToken);
        await new Promise((resolve) => setTimeout(resolve, 10));
        backend.generation += 1;
        backend.csrfToken = `csrf-${backend.generation}`;
        return jsonResponse(200, {
          ok: true,
          accessToken: `backend-access-token-${backend.generation}`,
          accessTokenExpiresIn: 900,
          csrfToken: backend.csrfToken,
          user: { id: "user-1" },
        });
      } finally {
        backend.activeRequests -= 1;
      }
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const sharedStorage = new Map();
  const firstTab = createAuthHarness({ fetchImpl, sharedStorage, BroadcastChannelImpl: FakeBroadcastChannel, navigatorImpl });
  const secondTab = createAuthHarness({ fetchImpl, sharedStorage, BroadcastChannelImpl: FakeBroadcastChannel, navigatorImpl });

  await Promise.all([firstTab.auth.bootstrapCsrf(), secondTab.auth.bootstrapCsrf()]);
  await Promise.all([firstTab.auth.refreshSession("access-expired"), secondTab.auth.refreshSession("access-expired")]);

  assert.equal(backend.maxActiveRequests, 1);
  assert.equal(backend.generation, 2);
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
