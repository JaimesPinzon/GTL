import React from "react";
import { useTranslation } from "react-i18next";
import {
  Brush,
  CircleDot,
  PencilRuler,
  ScanSearch,
  SmilePlus,
  Spline,
  Trash2,
  Type,
  Waves,
} from "lucide-react";

const ChartToolSidebar = ({ activeTool, onSelectTool, onClear, isPinned = true, className = "" }) => {
  const { t } = useTranslation();
  const tools = [
    { id: "trendline", icon: Spline, label: t("priceChart.tools.trendline") },
    { id: "fibonacci", icon: Waves, label: t("priceChart.tools.fibonacci") },
    { id: "patterns", icon: ScanSearch, label: t("priceChart.tools.patterns") },
    { id: "brush", icon: Brush, label: t("priceChart.tools.brush") },
    { id: "text", icon: Type, label: t("priceChart.tools.text") },
    { id: "marker", icon: CircleDot, label: t("priceChart.tools.marker") },
    { id: "measure", icon: PencilRuler, label: t("priceChart.tools.measure") },
    { id: "emoji", icon: SmilePlus, label: t("priceChart.tools.emoji") },
  ];

  return (
    <div
      className={`app-chrome-strong app-chrome-divider hidden h-full w-12 border-r py-2 shadow-xl xl:flex xl:flex-col xl:items-center ${
        isPinned ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      } ${className}`}
    >
      <div className="flex flex-1 flex-col items-center gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              onClick={() => onSelectTool(isActive ? null : tool.id)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/75 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <div className="app-chrome-divider border-t pt-2">
        <button
          type="button"
          title={t("priceChart.tools.clear")}
          onClick={onClear}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent/75 hover:text-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ChartToolSidebar;
