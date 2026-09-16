import assert from "node:assert/strict";
import test from "node:test";

import { generateSyntheticTicks } from "../src/modules/financial-lab/engine.ts";

const input = {
  sessionId: "session-test",
  seed: 41729,
  market: {
    start_at: "2026-01-01T00:00:00.000Z",
    timeframe_minutes: 5,
    duration_periods: 24,
    expected_return: 0,
    volatility: 0.012,
    average_volume: 100000,
    jump_probability: 0.02,
    jump_magnitude: 0.04,
    mean_reversion: 0.03,
    max_period_change: 0.2,
    trend: "sideways",
  },
  assets: [
    { id: "asset-alfa", initial_price: 100 },
    { id: "asset-beta", initial_price: 48 },
  ],
  events: [
    {
      activation_period: 10,
      event: { impact_percent: -0.025, volatility_multiplier: 1.8, duration_periods: 3 },
    },
  ],
};

test("the same seed produces exactly the same synthetic market", () => {
  const first = generateSyntheticTicks(input);
  const second = generateSyntheticTicks(input);
  assert.deepEqual(first, second);
  assert.equal(first.length, 48);
});

test("generated rows are normalized, positive OHLC candles", () => {
  const ticks = generateSyntheticTicks(input);
  ticks.forEach((tick) => {
    assert.ok(tick.open_price > 0);
    assert.ok(tick.close_price > 0);
    assert.ok(tick.high_price >= Math.max(tick.open_price, tick.close_price));
    assert.ok(tick.low_price <= Math.min(tick.open_price, tick.close_price));
    assert.ok(tick.volume >= 0);
  });
});

test("a different seed changes the trajectory", () => {
  const first = generateSyntheticTicks(input);
  const second = generateSyntheticTicks({ ...input, seed: input.seed + 1 });
  assert.notDeepEqual(first, second);
});

