import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/market-data";

const PositionsList = () => {
  const { t } = useTranslation();
  const { positions, closePosition, getCurrentPrice, symbols } = useTradingWorkspace();
  const [expandedPositionId, setExpandedPositionId] = useState(null);

  if (!positions || positions.length === 0) {
    return (
      <div className="glass-card h-full min-h-[240px] rounded-lg p-4">
        <h2 className="mb-4 text-xl font-bold">{t("trading.positions.title")}</h2>
        <div className="py-8 text-center text-muted-foreground">
          <p>{t("trading.positions.emptyTitle")}</p>
          <p className="mt-2 text-sm">{t("trading.positions.emptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card h-full min-h-[240px] rounded-lg p-4">
      <h2 className="mb-4 text-xl font-bold">{t("trading.positions.title")}</h2>
      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {positions.map((position) => {
          const currentSymbolInfo = symbols.find((symbol) => symbol.id === position.symbol);
          const currency = position.currency || currentSymbolInfo?.currency || "USD";
          const currentPrice = getCurrentPrice(position.symbol);
          const isExpanded = expandedPositionId === position.id;
          const priceDiff =
            position.type === "BUY"
              ? currentPrice - position.entryPrice
              : position.entryPrice - currentPrice;

          const profitPercentage = position.entryPrice !== 0 ? priceDiff / position.entryPrice : 0;
          const profit = position.amount * profitPercentage;
          const isProfit = profit >= 0;

          return (
            <motion.div
              key={position.id}
              className="overflow-hidden rounded-md border border-border bg-background/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <button
                type="button"
                className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/35 sm:grid-cols-[minmax(0,1.15fr)_minmax(100px,0.75fr)_minmax(145px,0.8fr)_auto]"
                onClick={() => setExpandedPositionId((currentId) => currentId === position.id ? null : position.id)}
                aria-expanded={isExpanded}
                aria-controls={`position-details-${position.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center truncate">
                    <span className="font-medium">{position.symbol}</span>
                    {position.type === "BUY" ? (
                      <ArrowUpRight className="ml-1 h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="ml-1 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t(position.type === "BUY" ? "trading.sides.buy" : "trading.sides.sell")}
                    <span className="sm:hidden"> · {formatCurrency(position.amount, currency)}</span>
                  </p>
                </div>

                <div className="hidden min-w-0 sm:block">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t("common.labels.amount")}
                  </p>
                  <p className="truncate text-sm font-medium">{formatCurrency(position.amount, currency)}</p>
                </div>

                <div className="text-right">
                  <p className={`font-medium ${isProfit ? "price-up" : "price-down"}`}>
                    {isProfit ? "+" : ""}
                    {formatCurrency(profit, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isProfit ? "+" : ""}
                    {formatPercentage(profitPercentage * 100)}
                  </p>
                </div>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded ? (
                <div id={`position-details-${position.id}`} className="border-t border-border/70 px-3 pb-3 pt-2.5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t("trading.positions.openedAt", {
                      side: t(position.type === "BUY" ? "trading.sides.buy" : "trading.sides.sell"),
                      date: formatDate(position.openDate),
                    })}
                  </p>

                  <div className="mb-2.5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("common.labels.entryPrice")}</p>
                      <p className="font-medium">{formatCurrency(position.entryPrice, currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("common.labels.currentPrice")}</p>
                      <p className="font-medium">{formatCurrency(currentPrice, currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("common.labels.currentValue")}</p>
                      <p className="font-medium">{formatCurrency(position.amount + profit, currency)}</p>
                    </div>
                  </div>

                  {position.justification ? (
                    <div className="mb-2.5 rounded-md bg-muted/50 p-2 text-sm">
                      <p className="text-xs text-muted-foreground">{t("common.labels.justification")}</p>
                      <p className="italic">{position.justification}</p>
                      {position.attachmentName ? (
                        <p className="mt-1 text-xs">
                          {t("trading.positions.attachmentLabel", { name: position.attachmentName })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full"
                    onClick={() => closePosition(position.id, currentPrice)}
                  >
                    {t("trading.positions.closeAction")}
                  </Button>
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PositionsList;
