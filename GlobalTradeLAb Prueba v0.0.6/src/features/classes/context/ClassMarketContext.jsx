import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getMarketHistoryFromBackend, getQuotesFromBackend } from "@/lib/backend-market";
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
    setMarketData({});

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

        const nextMarketData = Object.fromEntries(
          historicalResults.map((entry) => [
            entry.localSymbol,
            Array.isArray(entry.data) ? entry.data : [],
          ])
        );

        setMarketData(nextMarketData);
      } catch (error) {
        console.error("loadClassMarketSnapshot error", error);
        if (isMounted) {
          setMarketData({});
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
            return;
          }

          const lastCandleIndex = nextData[symbolId].length - 1;
          nextData[symbolId] = nextData[symbolId].map((candle, index) => {
            if (index !== lastCandleIndex) {
              return candle;
            }

            return {
              ...candle,
              high: Math.max(candle.high, numericPrice),
              low: Math.min(candle.low, numericPrice),
              close: numericPrice,
              value: numericPrice,
            };
          });
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
