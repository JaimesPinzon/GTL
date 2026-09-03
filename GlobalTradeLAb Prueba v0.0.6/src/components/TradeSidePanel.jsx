import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, BadgeDollarSign, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { formatCurrency, formatPercentage } from "@/lib/market-data";
import TradeForm from "@/components/TradeForm";

const TradeSidePanel = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { selectedSymbol, symbols, getCurrentPrice } = useTradingWorkspace();

  const selectedMarket = symbols.find((symbol) => symbol.id === selectedSymbol);
  const liveSelectedPrice = Number(getCurrentPrice(selectedSymbol));
  const hasLivePrice = Number.isFinite(liveSelectedPrice) && liveSelectedPrice > 0;
  const selectedMarketCurrency = selectedMarket?.currency || "USD";
  const selectedMarketChange = Number(selectedMarket?.change || 0);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 48 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute inset-y-0 right-0 z-20 w-full border-l border-border bg-background/98 shadow-2xl backdrop-blur xl:w-[460px]"
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{t("trading.tradePanel.title")}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-secondary/35 px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {t("trading.tradePanel.selectedAssetLabel")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-xl font-semibold leading-none">
                        {selectedMarket?.id || t("trading.tradePanel.noSelection")}
                      </p>
                      {selectedMarket?.currency ? (
                        <span className="rounded-full border border-border bg-background/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {selectedMarket.currency}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedMarket?.name || t("trading.tradePanel.selectAssetPrompt")}
                    </p>
                  </div>
                  <BadgeDollarSign className="h-5 w-5 text-primary" />
                </div>

                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className="font-medium">
                    {selectedMarket
                      ? hasLivePrice
                        ? formatCurrency(liveSelectedPrice, selectedMarketCurrency)
                        : t("trading.tradePanel.unavailableQuote")
                      : "--"}
                  </span>
                  {selectedMarket ? (
                    <span
                      className={`font-medium ${
                        selectedMarketChange >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {formatPercentage(selectedMarketChange)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <TradeForm />
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
};

export default TradeSidePanel;
