import React, { useMemo, useState } from "react";
import { Bitcoin, Briefcase, Landmark, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { formatCurrency, formatPercentage } from "@/lib/market-data";
import OverlayPanel from "@/components/OverlayPanel";

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

const MarketSearchOverlay = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { symbols, selectedSymbol, setSelectedSymbol } = useTradingWorkspace();
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

      const matchesQuery = (
        symbol.id.toLowerCase().includes(normalizedQuery) ||
        symbol.name.toLowerCase().includes(normalizedQuery) ||
        (typeLabels[symbol.type] || symbol.type).toLowerCase().includes(normalizedQuery)
      );

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query, symbols, typeLabels]);

  const handleSelect = (symbolId) => {
    setSelectedSymbol(symbolId);
    onClose();
  };

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      className="mx-auto flex h-[min(84vh,760px)] w-full max-w-7xl flex-col overflow-hidden rounded-[24px] border border-border app-chrome-panel text-foreground shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="border-b app-chrome-divider px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t("marketSearch.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("marketSearch.description")}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

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
      </div>

      <div className="min-h-0 flex-1 px-6 py-4">
        <ScrollArea
          type="always"
          className="h-full min-h-0 w-full overflow-hidden rounded-[20px] border app-chrome-divider bg-background/30"
          scrollBarClassName="w-[12px] bg-[#050b18] px-[2px] py-[6px]"
          thumbClassName="rounded-full bg-[#182a52]"
        >
          <div className="min-w-0">
            {filteredSymbols.length > 0 ? (
              <Table>
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
                    <TableRow
                      key={symbol.id}
                      onClick={() => handleSelect(symbol.id)}
                      className={`cursor-pointer ${selectedSymbol === symbol.id ? "bg-accent/40" : ""}`}
                    >
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
        </ScrollArea>
      </div>
    </OverlayPanel>
  );
};

export default MarketSearchOverlay;
