import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createModuleLoader } from './helpers/load-module.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function setup({ members, accounts, portfolio }) {
  const calls = { members: [], accounts: [], portfolios: [], initializations: 0 };
  const warnings = [];
  const loader = createModuleLoader({
    '@/lib/trading-db': {
      fetchRoomMembers: (roomId) => { calls.members.push(roomId); return members(roomId); },
      fetchRoomSimAccounts: (roomId) => { calls.accounts.push(roomId); return accounts(roomId); },
      fetchPortfolio: (userId, roomId) => { calls.portfolios.push([userId, roomId]); return portfolio(userId, roomId); },
      ensureRoomMemberTradingFields: () => { calls.initializations++; throw new Error('Navigation cannot initialize balances'); },
    },
  }, { console: { warn: (warning) => warnings.push(warning) } });
  const { useRoomWorkspaceData } = loader('src/hooks/useRoomWorkspaceData.js');
  let state;
  function Harness({ roomId = 'room-a', userRole = 'teacher' }) {
    const [membersState, setMembers] = React.useState([]);
    const [accountsState, setAccounts] = React.useState([]);
    const [portfolios, setPortfolios] = React.useState({});
    const [currentPortfolio, setCurrentPortfolio] = React.useState(null);
    const request = useRoomWorkspaceData({
      roomId, userId: 'teacher-1', userRole,
      onMembers: setMembers, onAccounts: setAccounts, onPortfolios: setPortfolios,
      onCurrentPortfolio: setCurrentPortfolio,
    });
    state = { ...request, members: membersState, accounts: accountsState, portfolios, currentPortfolio };
    return null;
  }
  return { Harness, calls, warnings, state: () => state };
}

test('the teacher portfolio and balance load before the slow roster and student portfolios', async () => {
  const roster = deferred(), balances = deferred(), own = deferred(), student = deferred();
  const harness = setup({ members: () => roster.promise, accounts: () => balances.promise,
    portfolio: (userId) => userId === 'teacher-1' ? own.promise : student.promise });
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(harness.Harness)); });
    assert.equal(harness.state().portfolioStatus, 'loading');
    await act(async () => {
      own.resolve({ positions: [{ id: 'teacher-position' }], transactions: [] });
      balances.resolve([{ userId: 'teacher-1', totalBalance: 10000 }]);
    });
    assert.equal(harness.state().portfolioStatus, 'ready');
    assert.equal(harness.state().currentPortfolio.positions[0].id, 'teacher-position');
    assert.equal(harness.state().accounts[0].totalBalance, 10000);
    assert.equal(harness.state().members.length, 0);
    await act(async () => { roster.resolve([{ userId: 'student-1', roleInRoom: 'student' }]); });
    assert.equal(harness.state().members.length, 1);
    assert.equal(harness.state().portfolios['student-1'], undefined);
    await act(async () => { student.resolve({ positions: [], transactions: [] }); });
    assert.equal(harness.calls.initializations, 0);
    assert.deepEqual(harness.calls.members, ['room-a']);
    assert.deepEqual(harness.calls.accounts, ['room-a']);
    assert.deepEqual(harness.calls.portfolios, [['teacher-1', 'room-a'], ['student-1', 'room-a']]);
  } finally { await act(async () => { renderer?.unmount(); }); }
});

test('concurrent refreshes share the load and a completed load can be refreshed again', async () => {
  const response = deferred();
  const harness = setup({ members: () => response.promise, accounts: () => response.promise,
    portfolio: async () => ({ positions: [], transactions: [] }) });
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(harness.Harness)); });
    const first = harness.state().refresh();
    assert.equal(harness.state().refresh(), first);
    await act(async () => { response.resolve([]); await first; });
    assert.equal(harness.calls.members.length, 1);
    assert.equal(harness.calls.accounts.length, 1);
    await act(async () => { await harness.state().refresh(); });
    assert.equal(harness.calls.members.length, 2);
    assert.equal(harness.calls.accounts.length, 2);
    assert.equal(harness.calls.initializations, 0);
  } finally { await act(async () => { renderer?.unmount(); }); }
});

test('roster errors retain successful account and own portfolio reads without retries', async () => {
  const harness = setup({
    members: async () => { throw { code: '42501', message: 'Permission denied' }; },
    accounts: async () => [{ totalBalance: 0 }],
    portfolio: async () => ({ positions: [], transactions: [] }),
  });
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(harness.Harness)); });
    assert.equal(harness.state().portfolioStatus, 'ready');
    assert.equal(harness.state().accounts[0].totalBalance, 0);
    assert.equal(harness.warnings.length, 1);
    assert.match(harness.warnings[0], /42501 Permission denied/);
    assert.equal(harness.calls.members.length, 1);
    assert.equal(harness.calls.initializations, 0);
  } finally { await act(async () => { renderer?.unmount(); }); }
});

test('switching rooms ignores a late portfolio response from the previous room', async () => {
  const oldPortfolio = deferred(), newPortfolio = deferred();
  const harness = setup({ members: async () => [], accounts: async () => [],
    portfolio: (_userId, roomId) => roomId === 'room-a' ? oldPortfolio.promise : newPortfolio.promise });
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(harness.Harness)); });
    await act(async () => { renderer.update(React.createElement(harness.Harness, { roomId: 'room-b' })); });
    assert.equal(harness.state().portfolioStatus, 'loading');
    await act(async () => { newPortfolio.resolve({ positions: [{ id: 'room-b-position' }], transactions: [] }); });
    await act(async () => { oldPortfolio.resolve({ positions: [{ id: 'room-a-position' }], transactions: [] }); });
    assert.equal(harness.state().currentPortfolio.positions[0].id, 'room-b-position');
    assert.equal(harness.state().portfolioStatus, 'ready');
  } finally { await act(async () => { renderer?.unmount(); }); }
});

test('a failed own portfolio remains unready until an explicit successful retry', async () => {
  let unavailable = true;
  const harness = setup({ members: async () => [], accounts: async () => [],
    portfolio: async () => { if (unavailable) throw new Error('offline'); return { positions: [], transactions: [] }; } });
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(harness.Harness)); });
    assert.equal(harness.state().portfolioStatus, 'error');
    unavailable = false;
    await act(async () => { await harness.state().refresh(); });
    assert.equal(harness.state().portfolioStatus, 'ready');
  } finally { await act(async () => { renderer?.unmount(); }); }
});
