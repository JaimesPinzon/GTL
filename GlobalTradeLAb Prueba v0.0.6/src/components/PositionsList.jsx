import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/market-data";

const PositionsList = () => {
  const { t } = useTranslation();
  const { positions, closePosition, getCurrentPrice, symbols } = useTradingWorkspace();

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
      <div className="max-h-[400px] space-y-4 overflow-y-auto">
        {positions.map((position) => {
          const currentSymbolInfo = symbols.find((symbol) => symbol.id === position.symbol);
          const currency = position.currency || currentSymbolInfo?.currency || "USD";
          const currentPrice = getCurrentPrice(position.symbol);
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
              className="rounded-md border border-border p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium">{position.symbol}</span>
                    {position.type === "BUY" ? (
                      <ArrowUpRight className="ml-1 h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="ml-1 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("trading.positions.openedAt", {
                      side: t(position.type === "BUY" ? "trading.sides.buy" : "trading.sides.sell"),
                      date: formatDate(position.openDate),
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${isProfit ? "price-up" : "price-down"}`}>
                    {isProfit ? "+" : ""}
                    {formatCurrency(profit, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isProfit ? "+" : ""}
                    {formatPercentage(profitPercentage * 100)}
                  </p>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("common.labels.amount")}</p>
                  <p className="font-medium">{formatCurrency(position.amount, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.labels.entryPrice")}</p>
                  <p className="font-medium">{formatCurrency(position.entryPrice, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.labels.currentPrice")}</p>
                  <p className="font-medium">{formatCurrency(currentPrice, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.labels.currentValue")}</p>
                  <p className="font-medium">{formatCurrency(position.amount + profit, currency)}</p>
                </div>
              </div>

              {position.justification ? (
                <div className="mb-3 rounded-md bg-muted/50 p-2 text-sm">
                  <p className="text-xs text-muted-foreground">{t("common.labels.justification")}</p>
                  <p className="italic">{position.justification}</p>
                  {position.attachmentName ? (
                    <p className="mt-1 text-xs">
                      {t("trading.positions.attachmentLabel", { name: position.attachmentName })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Button variant="outline" className="w-full" onClick={() => closePosition(position.id, currentPrice)}>
                {t("trading.positions.closeAction")}
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PositionsList;
