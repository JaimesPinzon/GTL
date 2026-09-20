import assert from "node:assert/strict";
import test from "node:test";

import { getRouteIdForPath } from "../src/lib/route-loaders.js";

test("dashboard destinations resolve to their preload modules", () => {
  const room = "/app/classes/room-1";
  assert.equal(getRouteIdForPath(`${room}/dashboard`), "dashboard");
  assert.equal(getRouteIdForPath(`${room}/markets/trade`), "dashboard");
  assert.equal(getRouteIdForPath(`${room}/portfolios`), "classPortfolio");
  assert.equal(getRouteIdForPath(`${room}/overview`), "classOverview");
  assert.equal(getRouteIdForPath("/app/news"), "news");
  assert.equal(getRouteIdForPath("/app/classes"), "classes");
});

test("market and laboratory routes do not preload the dashboard module", () => {
  assert.equal(getRouteIdForPath("/app/classes/room-1/markets"), "markets");
  assert.equal(getRouteIdForPath("/app/classes/room-1/lab"), "financialLab");
});
