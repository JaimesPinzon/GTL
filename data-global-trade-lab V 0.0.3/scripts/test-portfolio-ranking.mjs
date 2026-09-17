import assert from "node:assert/strict";
import test from "node:test";

import { buildPortfolioRanking } from "../src/modules/portfolio-ranking/service.ts";

const member = (userId, displayName, overrides = {}) => ({
  userId,
  displayName,
  email: `${userId}@example.com`,
  avatarUrl: null,
  availableBalance: 500,
  groupId: null,
  groupName: null,
  groupAvailableBalance: null,
  groupMemberCount: 1,
  ...overrides,
});

test("ranking uses real portfolio value and deterministic tie breakers", () => {
  const ranking = buildPortfolioRanking({
    members: [member("a", "Ana"), member("b", "Bea"), member("c", "Carla")],
    positions: [
      { id: "pa", userId: "a", groupId: null, symbol: "AAA", type: "BUY", amount: 500, entryPrice: 10 },
      { id: "pb", userId: "b", groupId: null, symbol: "BBB", type: "BUY", amount: 500, entryPrice: 10 },
    ],
    transactions: [
      { id: "ta", userId: "a", groupId: null, date: "2026-09-17T11:00:00Z" },
      { id: "tb", userId: "b", groupId: null, date: "2026-09-17T12:00:00Z" },
    ],
    pricesBySymbol: new Map([["AAA", 12], ["BBB", 12]]),
    defaultInitialBalance: 1000,
    metric: "return_pct",
    period: "class",
    now: new Date("2026-09-17T13:00:00Z"),
  });

  assert.deepEqual(ranking.map((row) => row.userId), ["b", "a"]);
  assert.equal(ranking[0].rank, 1);
  assert.equal(ranking[0].portfolioValue, 1100);
  assert.equal(ranking[0].totalPnl, 100);
  assert.equal(ranking[0].returnPct, 10);
  assert.equal(ranking.some((row) => row.userId === "c"), false);
});

test("period limits operation counts and group capital uses all active members", () => {
  const ranking = buildPortfolioRanking({
    members: [member("a", "Ana", {
      groupId: "g1",
      groupName: "Equipo 1",
      groupAvailableBalance: 1500,
      groupMemberCount: 2,
    })],
    positions: [{ id: "p1", userId: "b", groupId: "g1", symbol: "AAA", type: "BUY", amount: 500, entryPrice: 10 }],
    transactions: [
      { id: "old", userId: "b", groupId: "g1", date: "2026-08-01T12:00:00Z" },
      { id: "new", userId: "a", groupId: "g1", date: "2026-09-16T12:00:00Z" },
    ],
    pricesBySymbol: new Map([["AAA", 10]]),
    defaultInitialBalance: 1000,
    metric: "portfolio_value",
    period: "7d",
    now: new Date("2026-09-17T13:00:00Z"),
  });

  assert.equal(ranking[0].portfolioValue, 2000);
  assert.equal(ranking[0].totalPnl, 0);
  assert.equal(ranking[0].operationsCount, 1);
  assert.equal(ranking[0].lastActivityAt, "2026-09-16T12:00:00Z");
});
