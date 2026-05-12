import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import OverlayPanel from "@/components/OverlayPanel";
import { HelpCircle, Star, X } from "lucide-react";

const IndicatorsOverlay = ({
  open,
  onClose,
  showEMA,
  setShowEMA,
  showMACD,
  setShowMACD,
}) => {
  const { t } = useTranslation();
  const indicators = [
    { id: "ema", label: t("priceChart.indicators.ema"), enabled: true, activeKey: "ema" },
    { id: "macd", label: t("priceChart.indicators.macd"), enabled: true, activeKey: "macd" },
    { id: "bollinger", label: t("priceChart.indicators.bollinger"), enabled: false },
    { id: "rsi", label: t("priceChart.indicators.rsi"), enabled: false },
    { id: "volume", label: t("priceChart.indicators.volume"), enabled: false },
  ];

  const handleToggle = (indicator) => {
    if (!indicator.enabled) {
      return;
    }

    if (indicator.activeKey === "ema") {
      setShowEMA((previous) => !previous);
    }

    if (indicator.activeKey === "macd") {
      setShowMACD((previous) => !previous);
    }
  };

  const isActive = (indicator) => {
    if (indicator.activeKey === "ema") return showEMA;
    if (indicator.activeKey === "macd") return showMACD;
    return false;
  };

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      className="mx-auto mt-16 w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#161819] text-white shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{t("priceChart.indicators.title")}</h2>
            <p className="mt-1 text-sm text-zinc-400">{t("priceChart.indicators.description")}</p>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-300 hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="py-3">
        {indicators.map((indicator) => {
          const active = isActive(indicator);
          return (
            <button
              key={indicator.id}
              type="button"
              onClick={() => handleToggle(indicator)}
              className={`flex w-full items-center justify-between px-6 py-4 text-left transition ${
                indicator.enabled ? "hover:bg-white/6" : "cursor-default"
              } ${active ? "bg-white/10" : ""}`}
            >
              <div className="flex items-center gap-3">
                <Star className={`h-4 w-4 ${active ? "fill-primary text-primary" : "text-zinc-500"}`} />
                <span className={`text-lg ${indicator.enabled ? "text-white" : "text-zinc-500"}`}>{indicator.label}</span>
              </div>

              <div className="flex items-center gap-3">
                {indicator.enabled ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      active ? "bg-primary/15 text-primary" : "bg-white/8 text-zinc-300"
                    }`}
                  >
                    {active ? t("priceChart.indicators.active") : t("priceChart.indicators.inactive")}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
                    {t("priceChart.indicators.comingSoon")}
                  </span>
                )}
                <HelpCircle className="h-4 w-4 text-zinc-500" />
              </div>
            </button>
          );
        })}
      </div>
    </OverlayPanel>
  );
};

export default IndicatorsOverlay;
