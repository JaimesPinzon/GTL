export const ENABLED_MARKET_ASSETS = Object.freeze([
  { id: "BTCUSD", backendSymbol: "BTC/USD", nameKey: "trading.assets.bitcoin", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.03 },
  { id: "ETHUSD", backendSymbol: "ETH/USD", nameKey: "trading.assets.ethereum", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.04 },
  { id: "QQQ", backendSymbol: "QQQ", nameKey: "trading.assets.qqq", currency: "USD", type: "etf", exchangeLabel: "NASDAQ", baseVolatility: 0.014 },
  { id: "DIA", backendSymbol: "DIA", nameKey: "trading.assets.dia", currency: "USD", type: "etf", exchangeLabel: "NYSE Arca", baseVolatility: 0.011 },
  { id: "SPY", backendSymbol: "SPY", nameKey: "trading.assets.spy", currency: "USD", type: "etf", exchangeLabel: "NYSE Arca", baseVolatility: 0.012 },
  { id: "NU", backendSymbol: "NU", nameKey: "trading.assets.nuHoldings", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.025 },
  { id: "NVDA", backendSymbol: "NVDA", nameKey: "trading.assets.nvidia", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.03 },
]);

