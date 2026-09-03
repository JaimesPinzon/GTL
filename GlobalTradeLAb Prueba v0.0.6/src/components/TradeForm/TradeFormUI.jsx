import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/market-data";

const TradeFormUI = ({
  selectedSymbol,
  currentPrice,
  assetCurrency,
  userCurrency,
  tradeMode,
  setTradeMode,
  amount,
  setAmount,
  quantity,
  setQuantity,
  setTradeType,
  justification,
  setJustification,
  attachmentName,
  handleFileChange,
  handleSubmit,
  totalCostUSD,
  userBalance,
  isStock,
}) => {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(false);

  const renderFormContent = (type) => (
    <form onSubmit={handleSubmit}>
      <div className="space-y-3">
        {isStock ? (
          <div className="mb-3 flex items-center space-x-2">
            <Label
              htmlFor={`trade-mode-${type}`}
              className={tradeMode === "amount" ? "font-semibold" : "text-muted-foreground"}
            >
              {t("common.labels.amount")}
            </Label>
            <Switch
              id={`trade-mode-${type}`}
              checked={tradeMode === "quantity"}
              onCheckedChange={(checked) => setTradeMode(checked ? "quantity" : "amount")}
            />
            <Label
              htmlFor={`trade-mode-${type}`}
              className={tradeMode === "quantity" ? "font-semibold" : "text-muted-foreground"}
            >
              {t("common.labels.quantity")}
            </Label>
          </div>
        ) : null}

        {tradeMode === "amount" ? (
          <div className="space-y-1">
            <Label htmlFor={`${type}-amount`}>
              {t("common.labels.amount")} ({userCurrency})
            </Label>
            <Input
              id={`${type}-amount`}
              type="number"
              placeholder={t("trading.form.amountPlaceholder", { currency: userCurrency })}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0.01"
              step="any"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`${type}-quantity`}>{t("common.labels.quantity")}</Label>
            <Input
              id={`${type}-quantity`}
              type="number"
              placeholder={t("trading.form.quantityPlaceholder")}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              min="0.000001"
              step="any"
            />
          </div>
        )}

        {tradeMode === "quantity" && Number.parseFloat(quantity) > 0 && currentPrice > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("trading.form.totalEstimateLabel")}: {formatCurrency(totalCostUSD, userCurrency)}
          </p>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor={`${type}-justification`}>{t("common.labels.justification")}</Label>
          <Textarea
            id={`${type}-justification`}
            placeholder={t("common.labels.justification")}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${type}-attachment`}>
            {t("common.labels.attachment")} ({t("trading.form.fileHelp")})
          </Label>
          <Input
            id={`${type}-attachment`}
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            onChange={handleFileChange}
            className="text-xs file:text-foreground"
          />
          {attachmentName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("trading.positions.attachmentLabel", { name: attachmentName })}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label>{t("common.labels.balance")}</Label>
          <p className="text-sm font-medium">{formatCurrency(userBalance, userCurrency)}</p>
        </div>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            className={`w-full ${
              type === "BUY"
                ? "bg-green-500 text-white hover:bg-green-500/90"
                : "bg-red-500 text-white hover:bg-red-500/90"
            }`}
            disabled={
              !userBalance ||
              userBalance <= 0 ||
              totalCostUSD > userBalance ||
              !justification.trim() ||
              totalCostUSD <= 0
            }
          >
            {t("trading.form.submit", {
              side: t(type === "BUY" ? "trading.sides.buy" : "trading.sides.sell"),
              symbol: selectedSymbol,
            })}
          </Button>
        </motion.div>
      </div>
    </form>
  );

  return (
    <div className="glass-card rounded-lg p-4">
      <Tabs defaultValue="BUY" onValueChange={setTradeType}>
        <TabsList className="mb-3 grid grid-cols-2">
          <TabsTrigger value="BUY">{t("trading.sides.buy")}</TabsTrigger>
          <TabsTrigger value="SELL">{t("trading.sides.sell")}</TabsTrigger>
        </TabsList>

        <TabsContent value="BUY">{renderFormContent("BUY")}</TabsContent>
        <TabsContent value="SELL">{renderFormContent("SELL")}</TabsContent>
      </Tabs>

      <div className="mt-4 rounded-xl border border-border bg-secondary/20">
        <button
          type="button"
          onClick={() => setShowInfo((previous) => !previous)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-muted-foreground"
        >
          <span className="flex items-center">
            <Info className="mr-2 h-3.5 w-3.5 text-primary" />
            {t("trading.form.importantInfoTitle")}
          </span>
          {showInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showInfo ? (
          <div className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>{t("trading.form.simulationNotice", { currency: userCurrency })}</li>
              <li>{t("trading.form.priceUpdateNotice")}</li>
              <li>{t("trading.form.closePositionNotice")}</li>
              <li>{t("trading.form.justificationRequiredNotice")}</li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TradeFormUI;
