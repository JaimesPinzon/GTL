import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
const baseWorkspace = {
  selectedSymbol: 'BTCUSD',
  initialSymbols: [{ id: 'BTCUSD', currency: 'USD', type: 'crypto' }],
  getCurrentPrice: () => 79727.58,
  user: { id: 'student-1' },
  activeRoomId: 'room-1',
  activeRoom: { defaultCurrency: 'USD', defaultBalance: 10000 },
  balance: 0,
  openPosition: () => { throw new Error('Rendering must not submit an order'); },
};

// Execute the real form and its state logic; replace only external providers
// and the presentation component so the account-loading render can be isolated.
function renderTradeForm(workspace, pathname = '/app/classes/room-1/trading') {
  let renderedProps;
  const replacements = {
    'react': React,
    'react-router-dom': { useLocation: () => ({ pathname }) },
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '@/features/classes/hooks/useTradingWorkspace': { useTradingWorkspace: () => workspace },
    '@/components/ui/use-toast': { useToast: () => ({ toast: () => {} }) },
    './TradeForm/TradeFormUI': {
      __esModule: true,
      default: (props) => {
        renderedProps = props;
        return React.createElement('form', null, String(props.userBalance));
      },
    },
  };

  function loadComponent(relativePath) {
    const filename = new URL(relativePath, import.meta.url);
    const { code } = transformSync(readFileSync(filename, 'utf8'), {
      filename: filename.pathname,
      babelrc: false,
      configFile: false,
      plugins: [
        require.resolve('@babel/plugin-transform-react-jsx'),
        require.resolve('@babel/plugin-transform-modules-commonjs'),
      ],
    });
    const module = { exports: {} };
    runInNewContext(code, {
      module,
      exports: module.exports,
      require: (name) => {
        if (name in replacements) return replacements[name];
        if (name === './TradeForm/TradeFormLogic') {
          return loadComponent('../src/components/TradeForm/TradeFormLogic.js');
        }
        throw new Error(`Unexpected dependency: ${name}`);
      },
      console,
    }, { filename: filename.pathname });
    return module.exports;
  }

  const TradeForm = loadComponent('../src/components/TradeForm.jsx').default;
  const markup = renderToStaticMarkup(React.createElement(TradeForm));
  assert.match(markup, /^<form>/);
  assert.equal(renderedProps.currentPrice, 79727.58);
  return renderedProps;
}

test('opening Operar while the room account is loading renders without throwing', () => {
  const props = renderTradeForm({ ...baseWorkspace, activeRoomAccount: null });
  assert.equal(props.userBalance, 0);
  assert.equal(props.balanceStatus, 'loading');
});

test('a generic profile balance cannot stand in for an unresolved room account', () => {
  const props = renderTradeForm({ ...baseWorkspace, balance: 1250 });
  assert.equal(props.userBalance, 0);
  assert.equal(props.balanceStatus, 'loading');
});

test('the loaded room account takes precedence over the context fallback', () => {
  const props = renderTradeForm({
    ...baseWorkspace,
    balance: 1250,
    activeRoomAccount: { roomId: 'room-1', availableBalance: 875, currency: 'USD' },
  });
  assert.equal(props.userBalance, 875);
});

test('an exhausted account preserves zero instead of displaying initial funds', () => {
  const props = renderTradeForm({
    ...baseWorkspace,
    balance: 1250,
    activeRoomAccount: { roomId: 'room-1', availableBalance: 0 },
  });
  assert.equal(props.userBalance, 0);
});

test('an account snapshot from another room does not crash the new room form', () => {
  const props = renderTradeForm({
    ...baseWorkspace,
    activeRoomAccount: { roomId: 'room-2', availableBalance: 9000 },
  });
  assert.equal(props.userBalance, 0);
});
