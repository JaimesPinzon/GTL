import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getMarketHistoryFromBackend, getQuotesFromBackend } from "@/lib/backend-market";
import { generateMarketData } from "@/lib/market-data";
import { CLASS_CONTEXT_PATHS } from "@/lib/routes";
import { useClassContext } from "@/features/classes/context/ClassContext";

const ClassMarketContext = createContext(null);

const SYMBOL_TEMPLATES = [
  { id: "AAPL", nameKey: "trading.assets.apple", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.018 },
  { id: "MSFT", nameKey: "trading.assets.microsoft", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.017 },
  { id: "AMZN", nameKey: "trading.assets.amazon", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.022 },
  { id: "GOOGL", nameKey: "trading.assets.alphabet", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.019 },
  { id: "NVDA", nameKey: "trading.assets.nvidia", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.03 },
  { id: "TSLA", nameKey: "trading.assets.tesla", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.032 },
  { id: "META", nameKey: "trading.assets.meta", currency: "USD", type: "stock", exchangeLabel: "NASDAQ", baseVolatility: 0.021 },
  { id: "BRK.B", nameKey: "trading.assets.berkshire", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.011 },
  { id: "JPM", nameKey: "trading.assets.jpmorgan", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.016 },
  { id: "JNJ", nameKey: "trading.assets.johnson", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.012 },
  { id: "QQQ", nameKey: "trading.assets.qqq", currency: "USD", type: "etf", exchangeLabel: "NASDAQ", baseVolatility: 0.014 },
  { id: "DIA", nameKey: "trading.assets.dia", currency: "USD", type: "etf", exchangeLabel: "NYSE Arca", baseVolatility: 0.011 },
  { id: "SPY", nameKey: "trading.assets.spy", currency: "USD", type: "etf", exchangeLabel: "NYSE Arca", baseVolatility: 0.012 },
  { id: "BTCUSD", nameKey: "trading.assets.bitcoin", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.03 },
  { id: "ETHUSD", nameKey: "trading.assets.ethereum", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.04 },
  { id: "NU", nameKey: "trading.assets.nuHoldings", currency: "USD", type: "stock", exchangeLabel: "NYSE", baseVolatility: 0.025 },
  { id: "XRPUSD", nameKey: "trading.assets.ripple", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.05 },
  { id: "ADAUSD", nameKey: "trading.assets.cardano", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.045 },
  { id: "SOLUSD", nameKey: "trading.assets.solana", currency: "USD", type: "crypto", exchangeLabel: "Mercado cripto global", baseVolatility: 0.055 },
];

const resolveQuoteTime = (quote) => {
  const candidate = quote?.timestamp ? new Date(quote.timestamp) : new Date();
  return Number.isFinite(candidate.getTime()) ? candidate : new Date();
};

const createQuoteSeries = (symbol, quote, historicalReferencePrice = null) => {
  const numericPrice = Number.parseFloat(quote?.close);
  const numericChange = Number.parseFloat(quote?.percent_change);
  const numericOpen = Number.parseFloat(quote?.open);

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    const fallbackSeries = generateMarketData(symbol.id, symbol.currency, symbol.baseVolatility, 2);
    const previousCandle = fallbackSeries[0];
    const currentCandle = fallbackSeries[1];
    const fallbackChange = previousCandle && currentCandle && previousCandle.close !== 0
      ? ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100
      : 0;

    if (previousCandle && currentCandle && Math.abs(fallbackChange) < 0.01) {
      currentCandle.close = previousCandle.close * (1 + Math.max(symbol.baseVolatility, 0.001));
      currentCandle.value = currentCandle.close;
      currentCandle.high = Math.max(currentCandle.open, currentCandle.close);
      currentCandle.low = Math.min(currentCandle.open, currentCandle.close);
    }

    return fallbackSeries;
  }

  const previousPrice = Number.isFinite(historicalReferencePrice) && historicalReferencePrice > 0
    ? historicalReferencePrice
    : Number.isFinite(numericChange) && Math.abs(numericChange) >= 0.01 && numericChange > -100
    ? numericPrice / (1 + numericChange / 100)
    : Number.isFinite(numericOpen) && numericOpen > 0 && numericOpen !== numericPrice
      ? numericOpen
    : numericPrice * (1 - Math.max(symbol.baseVolatility, 0.001));
  const quoteTime = resolveQuoteTime(quote);

  return [
    {
      time: new Date(quoteTime.getTime() - 60000),
      open: previousPrice,
      high: previousPrice,
      low: previousPrice,
      close: previousPrice,
      value: previousPrice,
      currency: quote.currency ?? symbol.currency,
    },
    {
      time: quoteTime,
      open: previousPrice,
      high: Math.max(previousPrice, numericPrice),
      low: Math.min(previousPrice, numericPrice),
      close: numericPrice,
      value: numericPrice,
      currency: quote.currency ?? symbol.currency,
      referencePrice24h: previousPrice,
    },
  ];
};

const find24HourReferencePrice = (historyEntry, currentTime) => {
  const candles = Array.isArray(historyEntry?.data) ? historyEntry.data : [];
  const targetTime = currentTime.getTime() - 24 * 60 * 60 * 1000;

  return candles.reduce((closestPrice, candle) => {
    const candleTime = new Date(candle.time ?? candle.timestamp ?? candle.date).getTime();
    const candlePrice = Number.parseFloat(candle.close ?? candle.value);

    if (!Number.isFinite(candleTime) || !Number.isFinite(candlePrice) || candlePrice <= 0) {
      return closestPrice;
    }

    if (!closestPrice || Math.abs(candleTime - targetTime) < closestPrice.distance) {
      return { distance: Math.abs(candleTime - targetTime), price: candlePrice };
    }

    return closestPrice;
  }, null)?.price ?? null;
};

const createFallbackMarketData = () =>
  Object.fromEntries(
    SYMBOL_TEMPLATES.map((symbol) => [
      symbol.id,
      createQuoteSeries(symbol, null),
    ])
  );

export const useClassMarketContext = () => useContext(ClassMarketContext);

export const ClassMarketContextProvider = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { activeClassId, hasActiveClass } = useClassContext() || {};
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSD");
  const [marketData, setMarketData] = useState({});
  const [isMarketLoading, setIsMarketLoading] = useState(false);

  const isOperationalRoute = useMemo(
    () =>
      Object.values(CLASS_CONTEXT_PATHS).some((path) =>
        location.pathname.endsWith(`/${path}`)
      ),
    [location.pathname]
  );

  const shouldLoadMarket = Boolean(activeClassId && hasActiveClass && isOperationalRoute);

  useEffect(() => {
    if (!shouldLoadMarket) {
      setMarketData({});
      setIsMarketLoading(false);
      return;
    }

    let isMounted = true;
    setIsMarketLoading(true);
    setMarketData(createFallbackMarketData());

    const loadMarketSnapshot = async () => {
      try {
        const latestQuotes = await getQuotesFromBackend(
          SYMBOL_TEMPLATES.map((symbol) => symbol.id)
        );

        if (!isMounted) {
          return;
        }

        const historicalResults = await getMarketHistoryFromBackend(
          SYMBOL_TEMPLATES.map((symbol) => symbol.id),
          48,
          "1H"
        ).catch((error) => {
          console.error("loadClassMarketHistory error", error);
          return [];
        });

        const historyBySymbol = new Map(
          historicalResults.map((entry) => [entry.localSymbol, entry])
        );
        const nextMarketData = createFallbackMarketData();

        latestQuotes.forEach((entry) => {
          if (!entry.ok || !entry.data) {
            return;
          }

          const symbolId = entry.localSymbol;
          const symbol = SYMBOL_TEMPLATES.find((item) => item.id === symbolId);
          if (symbol) {
            nextMarketData[symbolId] = createQuoteSeries(
              symbol,
              entry.data,
              find24HourReferencePrice(
                historyBySymbol.get(symbolId),
                resolveQuoteTime(entry.data)
              )
            );
          }
        });

        setMarketData(nextMarketData);
      } catch (error) {
        console.error("loadClassMarketSnapshot error", error);
        if (isMounted) {
          setMarketData(createFallbackMarketData());
        }
      } finally {
        if (isMounted) {
          setIsMarketLoading(false);
        }
      }
    };

    void loadMarketSnapshot();

    return () => {
      isMounted = false;
    };
  }, [activeClassId, shouldLoadMarket]);

  useEffect(() => {
    if (!shouldLoadMarket) {
      return undefined;
    }

    const refreshQuotes = async () => {
      let quoteEntries = [];

      try {
        quoteEntries = await getQuotesFromBackend(SYMBOL_TEMPLATES.map((symbol) => symbol.id));
      } catch (error) {
        console.error("refreshClassQuotes error", error);
        return;
      }

      setMarketData((currentData) => {
        const nextData = { ...currentData };

        quoteEntries.forEach((entry) => {
          const symbolId = entry.localSymbol;
          const quote = entry.ok ? entry.data : null;

          if (!quote) {
            return;
          }

          const numericPrice = Number.parseFloat(quote.close);

          if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
            return;
          }

          if (!nextData[symbolId] || nextData[symbolId].length === 0) {
            const symbol = SYMBOL_TEMPLATES.find((item) => item.id === symbolId);
            if (symbol) {
              nextData[symbolId] = createQuoteSeries(symbol, quote);
            }
            return;
          }

          const previousCandle = nextData[symbolId][nextData[symbolId].length - 1];

          nextData[symbolId] = [
            ...nextData[symbolId].slice(-1999),
            {
              ...previousCandle,
              time: resolveQuoteTime(quote),
              open: previousCandle.close,
              high: Math.max(previousCandle.close, numericPrice),
              low: Math.min(previousCandle.close, numericPrice),
              close: numericPrice,
              value: numericPrice,
            },
          ];
        });

        return nextData;
      });
    };

    void refreshQuotes();
    const interval = window.setInterval(refreshQuotes, 108000);

    return () => window.clearInterval(interval);
  }, [shouldLoadMarket]);

  const getCurrentPrice = (symbolId) => {
    if (!marketData[symbolId] || marketData[symbolId].length === 0) {
      return 0;
    }

    return marketData[symbolId].slice(-1)[0].close;
  };

  const calculateChange = (symbolId) => {
    if (!marketData[symbolId] || marketData[symbolId].length < 2) {
      return 0;
    }

    const currentCandle = marketData[symbolId].slice(-1)[0];
    const previousCandle = marketData[symbolId].slice(-2)[0];

    const referencePrice = currentCandle.referencePrice24h ?? previousCandle?.close;

    if (!currentCandle || !Number.isFinite(referencePrice) || referencePrice === 0) {
      return 0;
    }

    return ((currentCandle.close - referencePrice) / referencePrice) * 100;
  };

  const symbols = useMemo(
    () =>
      SYMBOL_TEMPLATES.map((symbol) => ({
        ...symbol,
        name: t(symbol.nameKey),
        price: getCurrentPrice(symbol.id),
        change: calculateChange(symbol.id),
      })),
    [marketData, t]
  );

  const value = useMemo(
    () => ({
      getCurrentPrice,
      initialSymbols: SYMBOL_TEMPLATES,
      isMarketLoading,
      marketData,
      selectedSymbol,
      setSelectedSymbol,
      symbols,
    }),
    [isMarketLoading, marketData, selectedSymbol, symbols]
  );

  return <ClassMarketContext.Provider value={value}>{children}</ClassMarketContext.Provider>;
};
