import assert from "node:assert/strict";
import test from "node:test";

import { buildEventClusterId, classifyNewsSentiment } from "../src/modules/news/analysis.ts";

test("event clustering produces stable day-and-keyword identifiers", () => {
  const first = buildEventClusterId("Reserva Federal mantiene las tasas de interés", "2026-09-16T10:00:00Z");
  const second = buildEventClusterId("Reserva Federal mantiene las tasas de interés", "2026-09-16T18:00:00Z");
  assert.equal(first, second);
  assert.match(first, /^20260916-/);
});

test("sentiment classification remains descriptive and bounded", () => {
  assert.deepEqual(classifyNewsSentiment("La empresa crece y mejora su ganancia"), { label: "positive", score: 1 });
  assert.deepEqual(classifyNewsSentiment("El mercado cae por riesgo de pérdidas"), { label: "negative", score: -1 });
  const mixed = classifyNewsSentiment("La acción sube pese al riesgo de caída");
  assert.equal(mixed.label, "mixed");
  assert.ok(mixed.score >= -1 && mixed.score <= 1);
});
