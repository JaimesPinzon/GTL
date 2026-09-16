import assert from "node:assert/strict";
import test from "node:test";

import { normalizeNewsSymbol, resolveNewsAssetAvailability } from "../src/lib/news-navigation.js";
import { buildNewsChartMarkers } from "../src/lib/news-chart-markers.js";

const assets = [
  { id: "NVDA", type: "stock" },
  { id: "BTCUSD", type: "crypto" },
  { id: "SPY", type: "etf" },
];
const classes = [
  { id: "stocks-class", name: "Acciones", allowedMarkets: ["stocks", "indices"] },
  { id: "crypto-class", name: "Cripto", allowedMarkets: ["crypto"] },
];

test("news symbols are normalized for market navigation", () => {
  assert.equal(normalizeNewsSymbol(" btc/usd "), "BTCUSD");
});

test("an asset requires an accessible class", () => {
  const result = resolveNewsAssetAvailability({ symbol: "NVDA", classId: null, classes, assets });
  assert.equal(result.available, false);
  assert.equal(result.reason, "class-required");
});

test("the class market configuration controls asset availability", () => {
  const unavailable = resolveNewsAssetAvailability({ symbol: "NVDA", classId: "crypto-class", classes, assets });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.reason, "market-disabled");

  const available = resolveNewsAssetAvailability({ symbol: "SPY", classId: "stocks-class", classes, assets });
  assert.equal(available.available, true);
  assert.equal(available.requiredMarket, "indices");
});

test("unknown instruments never produce an operational route", () => {
  const result = resolveNewsAssetAvailability({ symbol: "WTI", classId: "stocks-class", classes, assets });
  assert.equal(result.available, false);
  assert.equal(result.reason, "asset-unsupported");
});

test("news markers snap to the nearest visible candle and preserve focus", () => {
  const eventTime = Date.parse("2026-09-16T12:01:00Z") / 1000;
  const markers = buildNewsChartMarkers([
    { id: "news-1", title: "Event", publishedAt: "2026-09-16T12:01:00Z", sentiment: { label: "mixed" } },
  ], [{ time: eventTime - 60 }, { time: eventTime + 60 }], "news-1");
  assert.equal(markers.length, 1);
  assert.equal(markers[0].text, "NEWS");
  assert.equal(markers[0].shape, "arrowDown");
});
