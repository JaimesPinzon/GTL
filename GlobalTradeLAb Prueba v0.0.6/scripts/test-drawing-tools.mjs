import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDrawingConfigurationTemplate,
  createDrawing,
  drawingIsReadOnly,
  normalizeDrawing,
} from "../src/components/PriceChart/drawings/drawingDefaults.js";
import { calculateMeasurement, extendLineToViewport } from "../src/components/PriceChart/drawings/drawingGeometry.js";
import { drawingIsVisibleInTimeframe } from "../src/components/PriceChart/drawings/drawingRegistry.js";
import {
  anchorToPoint,
  applyMagnetToAnchor,
  pointToAnchor,
} from "../src/components/PriceChart/drawings/drawingCoordinates.js";

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

test("fibonacci uses anchor length by default and migrates the old infinite default", () => {
  const fresh = createDrawing({
    type: "fibonacciRetracement",
    symbol: "BTCUSD",
    timeframe: "1H",
    anchors: [{ time: 100, price: 10 }, { time: 200, price: 15 }],
  });
  const migrated = normalizeDrawing({
    ...fresh,
    fibonacci: { ...fresh.fibonacci, extendRight: true, extensionConfigured: undefined },
  });

  assert.equal(fresh.fibonacci.extendLeft, false);
  assert.equal(fresh.fibonacci.extendRight, false);
  assert.equal(migrated.fibonacci.extendRight, false);
});

test("hidden state from legacy string values can be restored", () => {
  const visible = normalizeDrawing({
    type: "rectangle",
    anchors: [{ time: 100, price: 10 }, { time: 200, price: 15 }],
    state: { hidden: "false" },
  });
  const hidden = normalizeDrawing({ ...visible, state: { hidden: "true" } });

  assert.equal(visible.state.hidden, false);
  assert.equal(hidden.state.hidden, true);
});

test("next-phase position and fibonacci extension models include their configuration", () => {
  const position = createDrawing({
    type: "longPosition",
    symbol: "BTCUSD",
    timeframe: "1H",
    anchors: [{ time: 100, price: 10 }, { time: 200, price: 9 }, { time: 300, price: 12 }],
  });
  const extension = createDrawing({
    type: "fibonacciExtension",
    symbol: "BTCUSD",
    timeframe: "1H",
    anchors: [{ time: 100, price: 10 }, { time: 200, price: 12 }, { time: 300, price: 11 }],
  });

  assert.equal(position.position.accountRiskPercent, 1);
  assert.equal(extension.fibonacci.levels.some((level) => level.value === 1.618), true);
  assert.equal(extension.fibonacci.extendRight, false);
});

test("future chart space creates projected anchors without snapping to the last candle", () => {
  const data = [
    { time: 100, open: 10, high: 12, low: 9, close: 11 },
    { time: 200, open: 11, high: 13, low: 10, close: 12 },
  ];
  const chart = {
    timeScale: () => ({
      coordinateToLogical: () => 5,
      coordinateToTime: () => null,
      logicalToCoordinate: (logical) => logical * 100,
      timeToCoordinate: () => null,
    }),
  };
  const series = {
    coordinateToPrice: () => 15,
    priceToCoordinate: (price) => price,
  };
  const anchor = pointToAnchor({ point: { x: 500, y: 15 }, chart, series, data });
  const magnetized = applyMagnetToAnchor({
    anchor,
    point: { x: 500, y: 15 },
    data,
    series,
    mode: "strong",
  });

  assert.equal(anchor.time, 600);
  assert.equal(anchor.logical, 5);
  assert.equal(anchor.candleIndex, null);
  assert.deepEqual(magnetized, anchor);
  assert.deepEqual(anchorToPoint({ anchor, chart, series, data }), { x: 500, y: 15 });
});

test("new drawings can inherit the latest configuration for their tool", () => {
  const source = createDrawing({
    type: "rectangle",
    symbol: "BTCUSD",
    timeframe: "1H",
    anchors: [{ time: 100, price: 10 }, { time: 200, price: 12 }],
  });
  source.style = { ...source.style, color: "#22c55e", width: 4, fillOpacity: 0.5 };
  const target = createDrawing({
    type: "rectangle",
    symbol: "BTCUSD",
    timeframe: "1H",
    anchors: [{ time: 300, price: 12 }, { time: 400, price: 15 }],
  });
  const configured = applyDrawingConfigurationTemplate(target, source);

  assert.equal(configured.style.color, "#22c55e");
  assert.equal(configured.style.width, 4);
  assert.equal(configured.style.fillOpacity, 0.5);
});

test("educational drawings distinguish editable owners from read-only class copies", () => {
  const owned = createDrawing({
    type: "trendline",
    symbol: "BTCUSD",
    timeframe: "1H",
    ownerId: "teacher-1",
    anchors: [{ time: 100, price: 10 }, { time: 200, price: 12 }],
  });
  const shared = normalizeDrawing({
    ...owned,
    ownership: { ownerId: "teacher-1", visibility: "class", classId: "class-1" },
    education: {
      explanation: "Observe la ruptura de resistencia",
      showExplanation: true,
      isTemplate: true,
      readOnly: true,
    },
  });

  assert.equal(drawingIsReadOnly(owned, "teacher-1"), false);
  assert.equal(drawingIsReadOnly(shared, "student-1"), true);
  assert.equal(shared.education.isTemplate, true);
  assert.equal(shared.education.explanation, "Observe la ruptura de resistencia");
});
