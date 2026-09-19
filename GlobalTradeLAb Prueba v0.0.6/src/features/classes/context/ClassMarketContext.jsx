import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  getQuotesFromBackend,
  MARKET_QUOTES_REFRESH_INTERVAL_MS,
} from "@/lib/backend-market";
import { resolveMarketSnapshot } from "@/lib/market-price";
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
  const [quoteData, setQuoteData] = useState({});
  const [chartSnapshots, setChartSnapshots] = useState({});
  const [isMarketLoading, setIsMarketLoading] = useState(false);

  const isOperationalRoute = useMemo(
    () =>
      [CLASS_CONTEXT_PATHS.dashboard, CLASS_CONTEXT_PATHS.markets, CLASS_CONTEXT_PATHS.trading].some((path) =>
        location.pathname.endsWith(`/${path}`)
      ),
    [location.pathname]
  );

  const shouldLoadMarket = Boolean(activeClassId && hasActiveClass && isOperationalRoute);

  useEffect(() => {
    if (!isOperationalRoute) return;
    const requestedSymbol = new URLSearchParams(location.search).get("symbol")?.trim().toUpperCase();
    if (requestedSymbol && SYMBOL_TEMPLATES.some((symbol) => symbol.id === requestedSymbol)) {
      setSelectedSymbol(requestedSymbol);
    }
  }, [isOperationalRoute, location.search]);

  useEffect(() => {
    if (!shouldLoadMarket) {
      setQuoteData({});
      setChartSnapshots({});
      setIsMarketLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsMarketLoading(true);
    setQuoteData({});
    setChartSnapshots({});

    let refreshInFlight = false;

    const refreshQuotes = async ({ initial = false, force = false } = {}) => {
      if (refreshInFlight) {
        return;
      }

      refreshInFlight = true;
      try {
        const latestQuotes = await getQuotesFromBackend(
          SYMBOL_TEMPLATES.map((symbol) => symbol.id),
          { force }
        );

        if (!isMounted) {
          return;
        }

        const validQuotes = Object.fromEntries(
          latestQuotes
            .filter((entry) => {
              const numericPrice = Number.parseFloat(entry.data?.close);
              return entry.ok && entry.data && Number.isFinite(numericPrice) && numericPrice > 0;
            })
            .map((entry) => [entry.localSymbol, entry.data])
        );

        setQuoteData((currentQuotes) =>
          initial ? validQuotes : { ...currentQuotes, ...validQuotes }
        );
      } catch (error) {
        console.error("refreshClassQuotes error", error);
      } finally {
        refreshInFlight = false;
        if (isMounted && initial) {
          setIsMarketLoading(false);
        }
      }
    };

    void refreshQuotes({ initial: true });
    const interval = window.setInterval(
      () => void refreshQuotes({ force: true }),
      MARKET_QUOTES_REFRESH_INTERVAL_MS
    );

    return () => {
      isMounted = false;
      window.clearInterval(interval);
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

  const getCurrentPrice = (symbolId) => {
    const chartSnapshot = chartSnapshots[symbolId];
    if (Number.isFinite(chartSnapshot?.price) && chartSnapshot.price > 0) {
      return chartSnapshot.price;
    }

    const snapshot = resolveMarketSnapshot({
      quote: quoteData[symbolId],
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
    [chartSnapshots, quoteData, t]
  );

  const value = useMemo(
    () => ({
      getCurrentPrice,
      initialSymbols: SYMBOL_TEMPLATES,
      isMarketLoading,
      quoteData,
      reportChartSnapshot,
      selectedSymbol,
      setSelectedSymbol,
      symbols,
    }),
    [isMarketLoading, quoteData, reportChartSnapshot, selectedSymbol, symbols]
  );

  return <ClassMarketContext.Provider value={value}>{children}</ClassMarketContext.Provider>;
};
