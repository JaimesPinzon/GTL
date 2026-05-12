import React from "react";
import { ArrowUpRight, ArrowDownRight, FileText, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { formatCurrency, formatDate } from "@/lib/market-data";

const TransactionHistory = ({ limit }) => {
  const { t } = useTranslation();
  const { transactions, symbols } = useTradingContext();

  if (!transactions || transactions.length === 0) {
    return (
      <div className="glass-card h-full min-h-[240px] rounded-lg p-4">
        <h2 className="mb-4 text-xl font-bold">{t("trading.transactionHistory.title")}</h2>
        <div className="py-8 text-center text-muted-foreground">
          <p>{t("trading.transactionHistory.emptyTitle")}</p>
          <p className="mt-2 text-sm">{t("trading.transactionHistory.emptyDescription")}</p>
        </div>
      </div>
    );
  }

  const displayTransactions = limit
    ? transactions.slice().reverse().slice(0, limit)
    : transactions.slice().reverse();

  return (
    <div className="glass-card h-full min-h-[240px] rounded-lg p-4">
      <h2 className="mb-4 text-xl font-bold">
        {limit
          ? t("trading.transactionHistory.latestTitle", { count: limit })
          : t("trading.transactionHistory.title")}
      </h2>
      <div className="max-h-[400px] space-y-4 overflow-y-auto pr-2">
        {displayTransactions.map((transaction) => {
          const currentSymbolInfo = symbols.find((symbol) => symbol.id === transaction.symbol);
          const currency = currentSymbolInfo?.currency || "USD";
          const isBuy = transaction.type.includes("BUY");
          const isOpen = transaction.type.includes("OPEN");
          const isProfit = !isOpen && transaction.profitOrLoss >= 0;

          return (
            <div key={transaction.id} className="rounded-md border border-border p-3">
              <div className="mb-1.5 flex items-start justify-between">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium">{transaction.symbol}</span>
                    {isBuy ? (
                      <ArrowUpRight className="ml-1 h-4 w-4 text-success" />
                    ) : (
                      <ArrowDownRight className="ml-1 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("trading.transactionHistory.subtitle", {
                      event: t(
                        isOpen
                          ? "trading.transactionHistory.openLabel"
                          : "trading.transactionHistory.closeLabel"
                      ),
                      side: t(isBuy ? "trading.sides.buy" : "trading.sides.sell"),
                      date: formatDate(transaction.date),
                    })}
                  </p>
                </div>
                <div className="text-right">
                  {isOpen ? (
                    <p className="font-medium">{formatCurrency(transaction.amount, currency)}</p>
                  ) : (
                    <p className={`font-medium ${isProfit ? "price-up" : "price-down"}`}>
                      {isProfit ? "+" : ""}
                      {formatCurrency(transaction.profitOrLoss, currency)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {isOpen
                      ? t("trading.transactionHistory.priceLabel", {
                          price: formatCurrency(transaction.price, currency),
                        })
                      : t("trading.transactionHistory.priceRangeLabel", {
                          entryPrice: formatCurrency(transaction.entryPrice, currency),
                          closePrice: formatCurrency(transaction.closePrice, currency),
                        })}
                  </p>
                </div>
              </div>

              {transaction.justification ? (
                <div className="mt-2 border-t border-border/60 pt-2 text-xs">
                  <p className="mb-0.5 flex items-center text-muted-foreground">
                    <FileText className="mr-1 h-3 w-3" />
                    {t("trading.transactionHistory.justificationLabel")}
                  </p>
                  <p className="pl-1 italic">{transaction.justification}</p>
                  {transaction.attachmentName ? (
                    <p className="mt-1 flex items-center pl-1 text-xs">
                      <ImageIcon className="mr-1 h-3 w-3" />
                      {t("trading.transactionHistory.attachmentLabel", {
                        name: transaction.attachmentName,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionHistory;
