import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getMarketHistoryFromBackend, getQuotesFromBackend } from "@/lib/backend-market";
import { mergeMarketSnapshot, resolveMarketSnapshot } from "@/lib/market-price";
import { CLASS_CONTEXT_PATHS } from "@/lib/routes";
import { ENABLED_MARKET_ASSETS } from "@/lib/market-assets";
import { useClassContext } from "@/features/classes/context/ClassContext";

const ClassMarketContext = createContext(null);

const SYMBOL_TEMPLATES = ENABLED_MARKET_ASSETS;

export const useClassMarketContext = () => useContext(ClassMarketContext);

export const ClassMarketContextProvider = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { activeClassId, hasActiveClass } = useClassContext() || {};
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSD");
  const [marketData, setMarketData] = useState({});
  const [quoteData, setQuoteData] = useState({});
  const [chartSnapshots, setChartSnapshots] = useState({});
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
      setQuoteData({});
      setChartSnapshots({});
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

        setQuoteData(
          Object.fromEntries(
            latestQuotes
              .filter((entry) => entry.ok && entry.data)
              .map((entry) => [entry.localSymbol, entry.data])
          )
        );

        const historicalResults = await getMarketHistoryFromBackend(
          SYMBOL_TEMPLATES.map((symbol) => symbol.id),
          48,
          "1H"
        ).catch((error) => {
          console.error("loadClassMarketHistory error", error);
          return [];
        });

        const quoteBySymbol = Object.fromEntries(
          latestQuotes
            .filter((entry) => entry.ok && entry.data)
            .map((entry) => [entry.localSymbol, entry.data])
        );

        const nextMarketData = Object.fromEntries(
          historicalResults.map((entry) => [
            entry.localSymbol,
            (() => {
              const candles = Array.isArray(entry.data) ? entry.data : [];
              const snapshot = resolveMarketSnapshot({
                quote: quoteBySymbol[entry.localSymbol],
                candles,
              });
              return mergeMarketSnapshot(candles, snapshot, "1m");
            })(),
          ])
        );

        setQuoteData((currentQuotes) => {
          const nextQuotes = { ...currentQuotes };

          historicalResults.forEach((entry) => {
            const lastCandle = Array.isArray(entry.data) ? entry.data.at(-1) : null;
            const close = Number.parseFloat(lastCandle?.close ?? lastCandle?.value);

            if (!Number.isFinite(close) || close <= 0 || nextQuotes[entry.localSymbol]) {
              return;
            }

            nextQuotes[entry.localSymbol] = {
              close: String(close),
              percent_change: "0",
              timestamp: lastCandle.time,
            };
          });

          return nextQuotes;
        });

        setMarketData(nextMarketData);
      } catch (error) {
        console.error("loadClassMarketSnapshot error", error);
        if (isMounted) {
          setMarketData({});
          setQuoteData({});
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

  const reportChartSnapshot = useCallback((symbolId, snapshot) => {
    if (!symbolId || !snapshot) {
      return;
    }

    const price = Number(snapshot.price ?? snapshot.close ?? snapshot.value);
    const time = Number(snapshot.time);

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(time)) {
      return;
    }

    const nextSnapshot = {
      time,
      price,
      change: Number.isFinite(snapshot.change) ? snapshot.change : null,
      currency: snapshot.currency,
      source: "chart",
    };

    setChartSnapshots((currentSnapshots) => {
      const currentSnapshot = currentSnapshots[symbolId];
      if (
        currentSnapshot?.time === nextSnapshot.time &&
        currentSnapshot?.price === nextSnapshot.price &&
        currentSnapshot?.change === nextSnapshot.change
      ) {
        return currentSnapshots;
      }

      return { ...currentSnapshots, [symbolId]: nextSnapshot };
    });
  }, []);

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

      const validQuotes = quoteEntries.filter((entry) => {
        const numericPrice = Number.parseFloat(entry.data?.close);
        return entry.ok && entry.data && Number.isFinite(numericPrice) && numericPrice > 0;
      });

      setQuoteData((currentQuotes) => ({
        ...currentQuotes,
        ...Object.fromEntries(validQuotes.map((entry) => [entry.localSymbol, entry.data])),
      }));

      setMarketData((currentData) => {
        const nextData = { ...currentData };

        quoteEntries.forEach((entry) => {
          const symbolId = entry.localSymbol;
          const quote = entry.ok ? entry.data : null;

          if (!quote) {
            return;
          }

          const candles = nextData[symbolId] || [];
          const snapshot = resolveMarketSnapshot({ quote, candles });
          nextData[symbolId] = mergeMarketSnapshot(candles, snapshot, "1m");
        });

        return nextData;
      });
    };

    void refreshQuotes();
    const interval = window.setInterval(refreshQuotes, 30000);

    return () => window.clearInterval(interval);
  }, [shouldLoadMarket]);

  const getCurrentPrice = (symbolId) => {
    const chartSnapshot = chartSnapshots[symbolId];
    if (Number.isFinite(chartSnapshot?.price) && chartSnapshot.price > 0) {
      return chartSnapshot.price;
    }

    const snapshot = resolveMarketSnapshot({
      quote: quoteData[symbolId],
      candles: marketData[symbolId] || [],
    });

    if (!snapshot) {
      return 0;
    }

    return snapshot.price;
  };

  const calculateChange = (symbolId) => {
    const chartSnapshot = chartSnapshots[symbolId];
    if (Number.isFinite(chartSnapshot?.change)) {
      return chartSnapshot.change;
    }

    const snapshot = resolveMarketSnapshot({
      quote: quoteData[symbolId],
      candles: marketData[symbolId] || [],
    });

    return Number.isFinite(snapshot?.change) ? snapshot.change : 0;
  };

  const symbols = useMemo(
    () =>
      SYMBOL_TEMPLATES.map((symbol) => ({
        ...symbol,
        name: t(symbol.nameKey),
        price: getCurrentPrice(symbol.id),
        change: calculateChange(symbol.id),
      })),
    [chartSnapshots, marketData, quoteData, t]
  );

  const value = useMemo(
    () => ({
      getCurrentPrice,
      initialSymbols: SYMBOL_TEMPLATES,
      isMarketLoading,
      marketData,
      quoteData,
      reportChartSnapshot,
      selectedSymbol,
      setSelectedSymbol,
      symbols,
    }),
    [isMarketLoading, marketData, quoteData, reportChartSnapshot, selectedSymbol, symbols]
  );

  return <ClassMarketContext.Provider value={value}>{children}</ClassMarketContext.Provider>;
};
