import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createModuleLoader } from './helpers/load-module.mjs';

const history = [
  { time: 1789429440, open: 78319.296875, high: 78319.296875, low: 78303.9609375, close: 78303.9609375 },
  { time: 1789429500, open: 78303.9609375, high: 78303.9609375, low: 78281.84375, close: 78283.3671875 },
];
const account = { id: 'rm:member-1', roomId: 'room-1', userId: 'teacher-1', availableBalance: 10000, totalBalance: 15000, blockedBalance: 5000, currency: 'USD' };
const Workspace = React.createContext(null);

test('open, close, reopen and submit use the shared balance and actual last chart price', async () => {
  let resolveAccount;
  const accountResponse = new Promise((resolve) => { resolveAccount = resolve; });
  let accountRequests = 0;
  let subscriptionCount = 0;
  let releaseCount = 0;
  let realtime;
  let workspace;
  let setPanelOpen;
  const saved = [];
  const storage = new Map();
  const timers = new Map();
  let nextTimer = 0;
  const fakeWindow = {
    sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    setInterval: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearInterval: (id) => timers.delete(id),
    addEventListener() {}, removeEventListener() {},
  };
  let market;
  const replacements = {
    'react': React,
    'react-router-dom': { useLocation: () => ({ pathname: '/app/classes/room-1/trading' }) },
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    'framer-motion': { AnimatePresence: ({ children }) => children, motion: { aside: 'aside', div: 'div' } },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/use-toast': { useToast: () => ({ toast() {} }) },
    '@/lib/market-data': { formatCurrency: (value) => String(value), formatPercentage: (value) => String(value) },
    '@/features/classes/context/ClassContext': { useClassContext: () => ({ activeClassId: 'room-1', hasActiveClass: true }) },
    '@/lib/routes': { CLASS_CONTEXT_PATHS: { trading: 'trading' } },
    '@/lib/room-balance': {
      fetchResolvedUserRoomAccount: () => { accountRequests++; return accountResponse; },
      subscribeToRoomAccount: ({ onChange }) => {
        subscriptionCount++;
        realtime = onChange;
        return () => { releaseCount++; };
      },
    },
    '@/lib/room-trades': {
      submitRoomTrade: async (order) => {
        const position = {
          id: `pos_${order.requestId}`,
          symbol: order.symbol,
          type: order.type,
          amount: order.amount,
          entryPrice: order.price,
          openDate: '2026-09-15T00:00:00.000Z',
          justification: order.justification,
          attachmentName: order.attachmentName,
        };
        saved.push(order);
        return {
          account: {
            ...account,
            availableBalance: account.availableBalance - order.amount,
            blockedBalance: account.blockedBalance + order.amount,
            totalBalance: account.totalBalance,
          },
          positions: [position],
          transactions: [{ id: `txn_${order.requestId}`, symbol: order.symbol }],
          profitOrLoss: 0,
        };
      },
    },
    '@/lib/backend-market': {
      getQuotesFromBackend: async () => [{ localSymbol: 'BTCUSD', ok: true, stale: true, data: { close: '79727.58', percent_change: '-1.8983', timestamp: '2026-09-04T23:26:58.64185+00:00' } }],
      getMarketHistoryFromBackend: async () => [{ localSymbol: 'BTCUSD', data: history }],
      getMarketOhlcFromBackend: async () => history,
    },
    '@/features/classes/hooks/useTradingWorkspace': { useTradingWorkspace: () => ({ ...React.useContext(Workspace), ...market.useClassMarketContext() }) },
    './TradeForm/TradeFormUI': { __esModule: true, default: (props) => React.createElement('trade-ui', props) },
  };
  const load = createModuleLoader(replacements, { window: fakeWindow });
  market = load('src/features/classes/context/ClassMarketContext.jsx');
  const { useActiveRoomAccount } = load('src/hooks/useActiveRoomAccount.js');
  const { usePortfolioManager } = load('src/hooks/usePortfolioManager.js');
  const { useChartData } = load('src/components/PriceChart/hooks/useChartData.js');
  const TradeSidePanel = load('src/components/TradeSidePanel.jsx').default;
  const user = { id: 'teacher-1', role: 'teacher', positions: [], transactions: [] };

  function ChartProbe() {
    const state = market.useClassMarketContext();
    const chart = useChartData({
      cacheScopeKey: user.id, chartType: 'candlestick', currentTimeframe: '1m',
      selectedSymbol: state.selectedSymbol, selectedMarketData: state.marketData[state.selectedSymbol],
    });
    return React.createElement('chart-price', { price: chart.visibleOhlcData.at(-1)?.close });
  }
  function Harness() {
    const live = useActiveRoomAccount({ roomId: 'room-1', userIds: ['teacher-1'], knownAccount: null });
    const [open, setOpen] = React.useState(false);
    setPanelOpen = setOpen;
    const operations = usePortfolioManager({
      currentUser: user, activeRoom: { id: 'room-1' }, currentBalance: live.account?.availableBalance,
      toast() {}, onTradeCommitted: (result) => {
        live.resource.commit(result.account);
        user.positions = result.positions;
        user.transactions = result.transactions;
      },
    });
    workspace = {
      ...operations, user, activeRoomId: 'room-1', activeRoom: { id: 'room-1', defaultCurrency: 'USD' },
      activeRoomAccount: live.account, activeRoomAccountStatus: live.status, balance: live.account?.availableBalance,
    };
    return React.createElement(Workspace.Provider, { value: workspace },
      React.createElement('header-balance', { balance: live.account?.availableBalance }),
      React.createElement(ChartProbe), React.createElement(TradeSidePanel, { open, onClose: () => setOpen(false) }));
  }

  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(market.ClassMarketContextProvider, null, React.createElement(Harness))); });
    await act(async () => { setPanelOpen(true); });
    assert.equal(renderer.root.findByType('trade-ui').props.balanceStatus, 'loading');
    await act(async () => { resolveAccount(account); await accountResponse; });
    const form = () => renderer.root.findByType('trade-ui').props;
    assert.equal(form().balanceStatus, 'ready');
    assert.equal(form().userBalance, 10000);
    assert.equal(form().operatingValue, 5000);
    assert.equal(form().currentPrice, history.at(-1).close);
    assert.equal(form().currentPrice, renderer.root.findByType('chart-price').props.price);
    assert.equal(accountRequests, 1);
    assert.equal(subscriptionCount, 1);

    await act(async () => { setPanelOpen(false); });
    await act(async () => { setPanelOpen(true); });
    assert.equal(form().userBalance, 10000);
    assert.equal(accountRequests, 1);
    assert.equal(subscriptionCount, 1);

    await act(async () => { form().setAmount('1000'); form().setJustification('Integration test'); });
    await act(async () => { await form().handleSubmit({ preventDefault() {} }); });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].price, history.at(-1).close);
    assert.equal(saved[0].amount, 1000);
    assert.equal(form().userBalance, 9000);
    assert.equal(form().operatingValue, 6000);
    assert.equal(renderer.root.findByType('header-balance').props.balance, 9000);

    await act(async () => { realtime({ ...account, availableBalance: 0 }); });
    assert.equal(form().userBalance, 0);
    assert.equal(form().balanceStatus, 'ready');
  } finally {
    await act(async () => { renderer?.unmount(); });
  }
  assert.equal(releaseCount, 1);
  assert.equal(timers.size, 0);
});
