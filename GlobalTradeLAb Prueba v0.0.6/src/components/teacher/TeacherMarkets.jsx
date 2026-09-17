import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Bitcoin, Briefcase, Landmark, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLastCandleMarketFromBackend } from "@/lib/backend-market";
import { formatCurrency, formatPercentage } from "@/lib/market-data";
import { supabase } from "@/lib/supabase";
import {
  mapSnapshotRowsToSymbols,
  SNAPSHOT_REFRESH_INTERVAL_MS,
} from "@/lib/market-snapshot";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { useClassMarketContext } from "@/features/classes/context/ClassMarketContext";
import { CLASS_CONTEXT_PATHS, buildClassRoute } from "@/lib/routes";

const SymbolIcon = ({ type }) => {
  if (type === "stock") {
    return <Landmark className="h-5 w-5 text-blue-400" />;
  }

  if (type === "crypto") {
    return <Bitcoin className="h-5 w-5 text-yellow-400" />;
  }

  if (type === "index") {
    return <Briefcase className="h-5 w-5 text-green-400" />;
  }

  return <TrendingUp className="h-5 w-5 text-primary" />;
};

const TeacherMarkets = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeClassId } = useClassContext() || {};
  const { setSelectedSymbol } = useClassMarketContext() || {};
  const [symbols, setSymbols] = useState([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const requestedSymbol = String(searchParams.get("symbol") || "").trim().toUpperCase();
  const returnTo = searchParams.get("returnTo");
  const typeLabels = useMemo(
    () => ({
      crypto: t("marketSearch.typeLabels.crypto"),
      stock: t("marketSearch.typeLabels.stock"),
      etf: t("marketSearch.typeLabels.etf"),
      index: t("marketSearch.typeLabels.index"),
      forex: t("marketSearch.typeLabels.forex"),
      commodities: t("marketSearch.typeLabels.commodities"),
    }),
    [t]
  );
  const filterOptions = useMemo(
    () => [
      { id: "all", label: t("marketSearch.filters.all") },
      { id: "stock", label: t("marketSearch.filters.stock") },
      { id: "crypto", label: t("marketSearch.filters.crypto") },
      { id: "forex", label: t("marketSearch.filters.forex") },
      { id: "index", label: t("marketSearch.filters.index") },
      { id: "etf", label: t("marketSearch.filters.etf") },
      { id: "commodities", label: t("marketSearch.filters.commodities") },
    ],
    [t]
  );
  const getMarketStatusLabel = useCallback(
    (status) => {
      if (status === "open") {
        return t("marketSearch.marketStatus.open", { defaultValue: "Abierto" });
      }
      if (status === "closed") {
        return t("marketSearch.marketStatus.closed", { defaultValue: "Cerrado" });
      }

      return t("marketSearch.marketStatus.unknown", { defaultValue: "N/D" });
    },
    [t]
  );

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;

    const loadSnapshotRows = async () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      try {
        const rows = await getLastCandleMarketFromBackend({ limit: 500 });
        if (!isMounted) {
          return;
        }
        setSymbols(mapSnapshotRowsToSymbols(rows, t));
      } catch (error) {
        console.error("loadTeacherMarketsSnapshot error", error);
        if (isMounted) {
          setSymbols([]);
        }
      } finally {
        isRefreshing = false;
      }
    };

    void loadSnapshotRows();
    const interval = window.setInterval(loadSnapshotRows, SNAPSHOT_REFRESH_INTERVAL_MS);
    const channel = supabase
      .channel("teacher-markets-last-candle")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "last_candle_market",
        },
        () => {
          void loadSnapshotRows();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [t]);

  useEffect(() => {
    if (requestedSymbol) {
      setQuery(requestedSymbol);
      setActiveFilter("all");
    }
  }, [requestedSymbol]);

  const openChart = useCallback((symbolId) => {
    if (!activeClassId || !symbolId) return;
    setSelectedSymbol?.(symbolId);
    const query = new URLSearchParams({ symbol: symbolId });
    const newsId = searchParams.get("news");
    if (newsId) query.set("news", newsId);
    if (returnTo) query.set("returnTo", returnTo);
    navigate(`${buildClassRoute(activeClassId, CLASS_CONTEXT_PATHS.trading)}?${query.toString()}`);
  }, [activeClassId, navigate, returnTo, searchParams, setSelectedSymbol]);

  const filteredSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return symbols.filter((symbol) => {
      const matchesFilter = activeFilter === "all" ? true : symbol.type === activeFilter;

      if (!normalizedQuery) {
        return matchesFilter;
      }

      const matchesQuery =
        symbol.id.toLowerCase().includes(normalizedQuery) ||
        symbol.name.toLowerCase().includes(normalizedQuery) ||
        (typeLabels[symbol.type] || symbol.type).toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query, symbols, typeLabels]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto w-full max-w-7xl"
    >
      {requestedSymbol ? (
        <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              {t("news.symbol.eyebrow")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("news.symbol.marketContext", { symbol: requestedSymbol })}
            </p>
          </div>
          <div className="flex gap-2">
            {returnTo ? (
              <Button variant="ghost" className="gap-2" onClick={() => navigate(returnTo)}>
                <ArrowLeft className="h-4 w-4" />
                {t("news.article.back")}
              </Button>
            ) : null}
            <Button className="gap-2" onClick={() => openChart(requestedSymbol)}>
              <BarChart3 className="h-4 w-4" />
              {t("news.symbol.openChart")}
            </Button>
          </div>
        </div>
      ) : null}
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-2xl">{t("teacher.markets.title")}</CardTitle>

          <div className="mt-5 flex items-center rounded-[14px] border border-white/15 bg-white/[0.04] px-4 py-3">
            <Search className="mr-3 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("marketSearch.searchPlaceholder")}
              className="border-0 bg-transparent px-0 text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
            />
          </div>

          <div className="scrollbar-page mt-4 flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((filter) => {
              const isActive = activeFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className="shrink-0"
                >
                  <span
                    className={`block rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-white/12 text-white"
                        : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="overflow-hidden rounded-[20px] border app-chrome-divider bg-background/30">
            {filteredSymbols.length > 0 ? (
              <Table className="scrollbar-page">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("marketSearch.columns.asset")}</TableHead>
                    <TableHead className="text-right">{t("marketSearch.columns.currentPrice")}</TableHead>
                    <TableHead className="text-right">{t("marketSearch.columns.change24h")}</TableHead>
                    <TableHead>{t("marketSearch.columns.type")}</TableHead>
                    <TableHead>{t("marketSearch.columns.currency")}</TableHead>
                    <TableHead>{t("marketSearch.columns.marketStatus", { defaultValue: "Mercado" })}</TableHead>
                    <TableHead className="text-right">{t("news.actions.market")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSymbols.map((symbol) => (
                    <TableRow key={symbol.id} className={requestedSymbol === symbol.id ? "bg-primary/10 ring-1 ring-inset ring-primary/25" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SymbolIcon type={symbol.type} />
                          <div>
                            <p className="font-medium">{symbol.name}</p>
                            <p className="text-xs text-muted-foreground">{symbol.marketSymbol}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(symbol.price, symbol.currency)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${symbol.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                        <div className="flex items-center justify-end">
                          {symbol.change >= 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                          {formatPercentage(symbol.change)}
                        </div>
                      </TableCell>
                      <TableCell>{typeLabels[symbol.type] || symbol.type}</TableCell>
                      <TableCell>{symbol.currency}</TableCell>
                      <TableCell>{getMarketStatusLabel(symbol.marketStatus)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="gap-2" onClick={() => openChart(symbol.id)}>
                          <BarChart3 className="h-4 w-4" />
                          {t("news.symbol.openChart")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 py-16 text-center text-muted-foreground">
                {t("marketSearch.empty")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default TeacherMarkets;
