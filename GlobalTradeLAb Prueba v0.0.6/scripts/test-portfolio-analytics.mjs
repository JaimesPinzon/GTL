import assert from "node:assert/strict";
import test from "node:test";

import {
  getClassPortfolioAnalytics,
  getPortfolioAnalytics,
} from "../src/features/classes/lib/portfolio-analytics.js";

test("portfolio analytics separates realized and unrealized P&L", () => {
  const result = getPortfolioAnalytics({
    availableBalance: 430,
    initialCapital: 2500,
    positions: [{ id: "p1", symbol: "AAPL", type: "BUY", amount: 2000, entryPrice: 100 }],
    transactions: [{ id: "t1", symbol: "NVDA", type: "CLOSE_BUY", amount: 500, profitOrLoss: 50, date: "2026-09-15T10:00:00Z" }],
    getCurrentPrice: () => 110,
    symbols: [{ id: "AAPL", name: "Apple", type: "stock", currency: "USD" }],
  });

  assert.equal(result.realizedPnl, 50);
  assert.equal(result.unrealizedPnl, 200);
  assert.equal(result.tradingPnl, 250);
  assert.equal(result.investedValue, 2200);
  assert.equal(result.portfolioValue, 2630);
  assert.equal(result.positionRows[0].quantity, 20);
  assert.equal(result.positionRows[0].returnPercentage, 10);
});

test("missing live prices fall back to entry price", () => {
  const result = getPortfolioAnalytics({
    availableBalance: 500,
    initialCapital: 1000,
    positions: [{ id: "p1", symbol: "QQQ", type: "BUY", amount: 500, entryPrice: 250 }],
    getCurrentPrice: () => 0,
  });

  assert.equal(result.unrealizedPnl, 0);
  assert.equal(result.portfolioValue, 1000);
  assert.equal(result.positionRows[0].hasLivePrice, false);
});

test("short positions gain value when market price falls", () => {
  const result = getPortfolioAnalytics({
    availableBalance: 500,
    initialCapital: 1000,
    positions: [{ id: "p1", symbol: "BTCUSD", type: "SELL", amount: 500, entryPrice: 100 }],
    getCurrentPrice: () => 90,
  });

  assert.equal(result.unrealizedPnl, 50);
  assert.equal(result.investedValue, 550);
});

test("class analytics aggregate student portfolios", () => {
  const result = getClassPortfolioAnalytics([
    { portfolioValue: 1100, tradingPnl: 100, returnPercentage: 10, positionRows: [{ symbol: "QQQ" }] },
    { portfolioValue: 950, tradingPnl: -50, returnPercentage: -5, positionRows: [{ symbol: "QQQ" }, { symbol: "BTCUSD" }] },
  ]);

  assert.equal(result.studentCount, 2);
  assert.equal(result.totalValue, 2050);
  assert.equal(result.totalPnl, 50);
  assert.equal(result.averageReturn, 2.5);
  assert.equal(result.profitable, 1);
  assert.equal(result.activeAssets, 2);
});
