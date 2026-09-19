import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { createModuleLoader } from './helpers/load-module.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test('quote reads are deduplicated and reused across frontend reloads for 108 seconds', async () => {
  const storedValues = new Map();
  const sessionStorage = {
    getItem: (key) => storedValues.get(key) ?? null,
    setItem: (key, value) => storedValues.set(key, value),
    removeItem: (key) => storedValues.delete(key),
  };
  let fetchCount = 0;
  const fetchGate = deferred();
  const responsePayload = {
    ok: true,
    results: [
      { requestedSymbol: 'BTC/USD', ok: true, data: { close: '100' } },
      { requestedSymbol: 'ETH/USD', ok: true, data: { close: '50' } },
    ],
  };
  const createLoader = () => createModuleLoader({
    '@/lib/env': { getMarketBackendUrl: (path) => `https://backend.test${path}` },
    '@/lib/market-timeframes': {
      DEFAULT_TIMEFRAME: '1m',
      HISTORY_CACHE_TTL_MS: {},
      toBackendTimeframe: (timeframe) => timeframe,
    },
    '@/lib/auth-api': { getAccessToken: async () => null },
    '@/lib/market-assets': {
      ENABLED_MARKET_ASSETS: [
        { id: 'BTCUSD', backendSymbol: 'BTC/USD' },
        { id: 'ETHUSD', backendSymbol: 'ETH/USD' },
      ],
    },
  }, {
    window: { sessionStorage },
    fetch: async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        await fetchGate.promise;
      }
      return { ok: true, json: async () => responsePayload };
    },
  });

  const firstModule = createLoader()('src/lib/backend-market.js');
  const firstRequest = firstModule.getQuotesFromBackend(['BTCUSD', 'ETHUSD']);
  const duplicateRequest = firstModule.getQuotesFromBackend(['BTCUSD', 'ETHUSD']);
  assert.equal(fetchCount, 1);
  fetchGate.resolve();
  await Promise.all([firstRequest, duplicateRequest]);

  await firstModule.getQuotesFromBackend(['BTCUSD', 'ETHUSD']);
  assert.equal(fetchCount, 1);

  const reloadedModule = createLoader()('src/lib/backend-market.js');
  await reloadedModule.getQuotesFromBackend(['BTCUSD', 'ETHUSD']);
  assert.equal(fetchCount, 1);

  await reloadedModule.getQuotesFromBackend(['BTCUSD', 'ETHUSD'], { force: true });
  assert.equal(fetchCount, 2);
});

test('older history stays disabled until the initial chart history owns a valid cursor', async () => {
  const initialRequest = deferred();
  const calls = [];
  let rangedRequestCount = 0;
  const loader = createModuleLoader({
    './ohlcHistoryService': {
      getHistoryLimit: () => 500,
      getRefreshInterval: () => 60_000,
      loadOhlcHistory: (options) => {
        calls.push(options);
        if (!options.from && !options.to) return initialRequest.promise;
        rangedRequestCount += 1;
        return Promise.resolve(
          rangedRequestCount === 1
            ? [{ time: 1_699_999_940, open: 99, high: 101, low: 98, close: 100 }]
            : []
        );
      },
    },
    './ohlcHistoryCache': {
      ensureOhlcCacheScope: () => {},
    },
  }, {
    window: {
      setInterval: () => 1,
      clearInterval: () => {},
    },
  });
  const { useOhlcHistory } = loader('src/components/PriceChart/hooks/useOhlcHistory.js');
  let state;

  function Harness() {
    state = useOhlcHistory({
      cacheScopeKey: 'user-1',
      selectedSymbol: 'BTCUSD',
      timeframe: '1m',
    });
    return null;
  }

  let renderer;
  try {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Harness));
      await Promise.resolve();
    });

    assert.equal(state.isInitialHistoryLoading, true);
    let loadedBeforeInitialHistory;
    await act(async () => {
      loadedBeforeInitialHistory = await state.loadOlderHistory();
    });
    assert.equal(loadedBeforeInitialHistory, false);
    assert.equal(calls.length, 1);
    assert.equal(state.hasReachedOldestHistory, false);

    await act(async () => {
      initialRequest.resolve([
        { time: 1_700_000_000, open: 100, high: 102, low: 99, close: 101 },
        { time: 1_700_000_060, open: 101, high: 103, low: 100, close: 102 },
      ]);
      await initialRequest.promise;
      await Promise.resolve();
    });

    assert.equal(state.isInitialHistoryLoading, false);
    assert.equal(state.chartHistory.length, 2);
    assert.equal(state.hasReachedOldestHistory, false);

    let loadedOlderHistory;
    await act(async () => {
      loadedOlderHistory = await state.loadOlderHistory();
    });
    assert.equal(loadedOlderHistory, true);
    assert.equal(state.chartHistory.length, 3);
    assert.equal(calls.length, 2);
    assert.equal(state.hasReachedOldestHistory, false);

    await act(async () => {
      await state.loadOlderHistory();
    });
    assert.equal(calls.length, 3);
    assert.equal(state.hasReachedOldestHistory, true);
  } finally {
    await act(async () => renderer?.unmount());
  }
});

test('chart data never renders class-level hourly candles as an initial fallback', async () => {
  let chartHistory = [];
  let state;
  const loader = createModuleLoader({
    './useOhlcHistory': {
      useOhlcHistory: () => ({
        chartHistory,
        hasReachedOldestHistory: false,
        historyLimit: 500,
        isInitialHistoryLoading: chartHistory.length === 0,
        isLoadingOlderHistory: false,
        loadOlderHistory: async () => false,
        progressiveHistoryEnabled: true,
      }),
    },
    '../utils': {
      aggregateDataForTimeframe: (data) => data,
      formatPriceDataForChart: (data) => data,
      repairMalformedMinuteCandles: (data) => data,
    },
    '@/lib/market-price': {
      mergeMarketSnapshot: (data) => data,
    },
  });
  const { useChartData } = loader('src/components/PriceChart/hooks/useChartData.js');
  const provisionalHourlyCandles = [
    { time: 1, open: 1, high: 2, low: 1, close: 2 },
    { time: 2, open: 2, high: 3, low: 2, close: 3 },
  ];

  function Harness({ revision }) {
    state = useChartData({
      cacheScopeKey: 'user-1',
      chartType: 'candlestick',
      currentTimeframe: '1m',
      preferredTimezone: 'UTC',
      selectedMarketData: provisionalHourlyCandles,
      selectedSymbol: 'BTCUSD',
      revision,
    });
    return null;
  }

  let renderer;
  try {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Harness, { revision: 0 }));
    });
    assert.equal(state.rawData.length, 0);
    assert.equal(state.formattedSeriesData.length, 0);

    chartHistory = [
      { time: 10, open: 10, high: 12, low: 9, close: 11 },
      { time: 11, open: 11, high: 13, low: 10, close: 12 },
    ];
    await act(async () => {
      renderer.update(React.createElement(Harness, { revision: 1 }));
    });
    assert.equal(state.rawData.length, chartHistory.length);
    assert.equal(state.rawData[0].time, 10);
    assert.equal(state.formattedSeriesData.length, chartHistory.length);
    assert.equal(state.formattedSeriesData[0].time, 10);
  } finally {
    await act(async () => renderer?.unmount());
  }
});

test('class market context performs one initial quote request and no history request', async () => {
  const intervals = [];
  const intervalDelays = [];
  const calls = [];
  const loader = createModuleLoader({
    'react-router-dom': {
      useLocation: () => ({ pathname: '/app/classes/class-1/dashboard', search: '' }),
    },
    'react-i18next': {
      useTranslation: () => ({ t: (key) => key }),
    },
    '@/lib/backend-market': {
      MARKET_QUOTES_REFRESH_INTERVAL_MS: 108_000,
      getQuotesFromBackend: async (symbols, options) => {
        calls.push({ symbols, options });
        return [{
          ok: true,
          localSymbol: 'BTCUSD',
          data: { close: '100', percent_change: '1.5', timestamp: '2026-09-18T12:00:00Z' },
        }];
      },
    },
    '@/lib/market-price': {
      resolveMarketSnapshot: ({ quote }) => quote
        ? { price: Number(quote.close), change: Number(quote.percent_change), time: 1 }
        : null,
    },
    '@/lib/routes': {
      CLASS_CONTEXT_PATHS: { dashboard: 'dashboard', markets: 'markets', trading: 'trading' },
    },
    '@/lib/market-assets': {
      ENABLED_MARKET_ASSETS: [{ id: 'BTCUSD', nameKey: 'btc', currency: 'USD' }],
    },
    '@/features/classes/context/ClassContext': {
      useClassContext: () => ({ activeClassId: 'class-1', hasActiveClass: true }),
    },
  }, {
    window: {
      setInterval: (handler, delay) => {
        intervals.push(handler);
        intervalDelays.push(delay);
        return intervals.length;
      },
      clearInterval: () => {},
    },
  });
  const {
    ClassMarketContextProvider,
    useClassMarketContext,
  } = loader('src/features/classes/context/ClassMarketContext.jsx');
  let state;

  function Consumer() {
    state = useClassMarketContext();
    return null;
  }

  let renderer;
  try {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(
          ClassMarketContextProvider,
          null,
          React.createElement(Consumer)
        )
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(calls.length, 1);
    assert.equal(intervals.length, 1);
    assert.equal(intervalDelays[0], 108_000);
    assert.equal(calls[0].options.force, false);
    assert.equal(state.quoteData.BTCUSD.close, '100');
    assert.equal(Object.hasOwn(state, 'marketData'), false);

    await act(async () => {
      await intervals[0]();
      await Promise.resolve();
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.force, true);
  } finally {
    await act(async () => renderer?.unmount());
  }
});
