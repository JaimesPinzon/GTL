import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_INDICATOR_PANE_HEIGHT,
  MAX_INDICATOR_PANE_HEIGHT,
  MIN_INDICATOR_PANE_HEIGHT,
  clampIndicatorPaneHeight,
} from "../src/components/PriceChart/hooks/useResizableIndicatorPane.js";

test("indicator pane height stays inside its fixed limits", () => {
  assert.equal(clampIndicatorPaneHeight(12), MIN_INDICATOR_PANE_HEIGHT);
  assert.equal(clampIndicatorPaneHeight(900), MAX_INDICATOR_PANE_HEIGHT);
});

test("indicator pane leaves enough vertical room for the main chart", () => {
  assert.equal(clampIndicatorPaneHeight(300, 340), 180);
});

test("invalid indicator pane heights fall back to the default", () => {
  assert.equal(clampIndicatorPaneHeight("invalid"), DEFAULT_INDICATOR_PANE_HEIGHT);
});
