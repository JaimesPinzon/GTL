import assert from "node:assert/strict";
import test from "node:test";

import { createModuleLoader } from "./helpers/load-module.mjs";

const createLoader = ({ token = "gtl-access-token", fetchImpl }) => createModuleLoader({
  "@/lib/env": {
    getMarketBackendUrl: (path) => `https://backend.test${path}`,
  },
  "@/lib/market-timeframes": {
    DEFAULT_TIMEFRAME: "1h",
    HISTORY_CACHE_TTL_MS: {},
    toBackendTimeframe: (timeframe) => timeframe,
  },
  "@/lib/auth-api": {
    getAccessToken: async () => token,
  },
  "@/lib/market-assets": {
    ENABLED_MARKET_ASSETS: [{ id: "BTCUSD", backendSymbol: "BTCUSD" }],
  },
}, {
  fetch: fetchImpl,
});

test("drawing persistence uses the canonical GTL access token", async () => {
  let request = null;
  const load = createLoader({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, objects: [] }),
      };
    },
  });
  const { saveMarketDrawingsToBackend } = load("src/lib/backend-market.js");

  await saveMarketDrawingsToBackend({
    symbol: "BTCUSD",
    timeframe: "all",
    objects: [{ id: "drawing-1", type: "trendline" }],
  });

  assert.equal(request.url, "https://backend.test/api/market/drawings");
  assert.equal(request.options.method, "PUT");
  assert.equal(request.options.headers.Authorization, "Bearer gtl-access-token");
});

test("drawing persistence reports a missing GTL session before making a request", async () => {
  let requestCount = 0;
  const load = createLoader({
    token: null,
    fetchImpl: async () => {
      requestCount += 1;
      throw new Error("fetch should not run");
    },
  });
  const { getMarketDrawingsFromBackend } = load("src/lib/backend-market.js");

  await assert.rejects(
    () => getMarketDrawingsFromBackend({ symbol: "BTCUSD", timeframe: "all" }),
    /No authenticated GTL session/,
  );
  assert.equal(requestCount, 0);
});
