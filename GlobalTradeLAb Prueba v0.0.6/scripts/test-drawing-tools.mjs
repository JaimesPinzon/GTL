import assert from "node:assert/strict";
import test from "node:test";
import { createDrawing, normalizeDrawing } from "../src/components/PriceChart/drawings/drawingDefaults.js";
import { calculateMeasurement, extendLineToViewport } from "../src/components/PriceChart/drawings/drawingGeometry.js";
import { drawingIsVisibleInTimeframe } from "../src/components/PriceChart/drawings/drawingRegistry.js";

test("drawing model stores market anchors instead of pixel coordinates", () => {
  const drawing = createDrawing({
    type: "trendline",
    symbol: "BTCUSD",
    timeframe: "1H",
    ownerId: "user-1",
    anchors: [
      { time: 100, price: 10, logical: 0, snapSource: "low" },
      { time: 200, price: 12, logical: 1, snapSource: "high" },
    ],
  });

  assert.equal(drawing.anchors[0].time, 100);
  assert.equal(drawing.anchors[0].price, 10);
  assert.equal("x" in drawing.anchors[0], false);
  assert.equal("y" in drawing.anchors[0], false);
  assert.equal(drawing.ownership.visibility, "private");
});

test("legacy drawing points are normalized into anchors", () => {
  const drawing = normalizeDrawing({
    id: "legacy",
    type: "trendline",
    points: [{ time: 100, price: 10 }, { time: 200, price: 12 }],
  }, { symbol: "BTCUSD", timeframe: "1H", ownerId: "user-1" });

  assert.equal(drawing.anchors.length, 2);
  assert.equal(drawing.points.length, 2);
  assert.equal(drawing.symbol, "BTCUSD");
  assert.equal(drawing.anchors[0].logical, null);
});

test("infinite and ray lines extend to viewport boundaries", () => {
  const infinite = extendLineToViewport({ x: 25, y: 25 }, { x: 50, y: 50 }, 100, 100);
  const ray = extendLineToViewport({ x: 25, y: 25 }, { x: 50, y: 50 }, 100, 100, "ray");

  assert.deepEqual(infinite, [{ x: 0, y: 0 }, { x: 100, y: 100 }]);
  assert.deepEqual(ray, [{ x: 25, y: 25 }, { x: 100, y: 100 }]);
});

test("measurement counts real candles in the selected time range", () => {
  const measurement = calculateMeasurement({
    anchors: [{ time: 100, price: 10 }, { time: 300, price: 15 }],
  }, [
    { time: 100, high: 11, low: 9, volume: 2 },
    { time: 200, high: 14, low: 10, volume: 3 },
    { time: 300, high: 16, low: 13, volume: 5 },
    { time: 400, high: 20, low: 18, volume: 8 },
  ]);

  assert.equal(measurement.candleCount, 3);
  assert.equal(measurement.high, 16);
  assert.equal(measurement.low, 9);
  assert.equal(measurement.volume, 10);
  assert.equal(measurement.percentage, 50);
});

test("timeframe visibility honors all and single scopes", () => {
  assert.equal(drawingIsVisibleInTimeframe({ timeframeScope: { mode: "all" } }, "1H"), true);
  assert.equal(drawingIsVisibleInTimeframe({ timeframeScope: { mode: "single", timeframe: "1H" } }, "1H"), true);
  assert.equal(drawingIsVisibleInTimeframe({ timeframeScope: { mode: "single", timeframe: "1H" } }, "4H"), false);
});
