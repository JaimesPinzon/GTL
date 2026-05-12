import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import OverlayPanel from "@/components/OverlayPanel";
import { CandlestickChart, LayoutGrid, LineChart, X } from "lucide-react";

const ChartTypeOverlay = ({ open, onClose, chartType, setChartType }) => {
  const { t } = useTranslation();
  const options = [
    { id: "candlestick", icon: CandlestickChart, title: t("priceChart.type.candlestick") },
    { id: "line", icon: LineChart, title: t("priceChart.type.line") },
    { id: "heikinashi", icon: LayoutGrid, title: t("priceChart.type.heikinAshi") },
  ];

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      className="mx-auto mt-20 w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#161819] text-white shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("priceChart.type.title")}</h2>
          <Button variant="ghost" size="icon" className="text-zinc-300 hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="flex items-center justify-center gap-3">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = chartType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                title={option.title}
                onClick={() => {
                  setChartType(option.id);
                  onClose();
                }}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
                  isActive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </div>
    </OverlayPanel>
  );
};

export default ChartTypeOverlay;
