import React, { useMemo, useState } from "react";
import { Bitcoin, Briefcase, Landmark, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercentage } from "@/lib/market-data";
import { motion } from "framer-motion";

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
  const { symbols } = useTradingWorkspace();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSymbols.map((symbol) => (
                    <TableRow key={symbol.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SymbolIcon type={symbol.type} />
                          <div>
                            <p className="font-medium">{symbol.name}</p>
                            <p className="text-xs text-muted-foreground">{symbol.id}</p>
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
