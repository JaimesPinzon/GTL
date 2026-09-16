import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Magnet,
  MousePointer2,
  PencilRuler,
  Pin,
  Shapes,
  Spline,
  Trash2,
  Waves,
} from "lucide-react";
import {
  DRAWING_CATEGORIES,
  DRAWING_REGISTRY,
} from "./PriceChart/drawings/drawingRegistry";

const CATEGORY_ICONS = {
  lines: Spline,
  shapes: Shapes,
  measurements: PencilRuler,
  fibonacci: Waves,
};

const MAGNET_MODES = ["off", "weak", "strong"];

const ChartToolSidebar = ({
  activeTool,
  keepToolActive,
  magnetMode,
  onClear,
  onSelectTool,
  onSetKeepToolActive,
  onSetMagnetMode,
  isPinned = true,
  className = "",
}) => {
  const { t } = useTranslation();
  const [openCategory, setOpenCategory] = useState(null);
  const activeCategory = useMemo(
    () => DRAWING_CATEGORIES.find((category) => category.tools.includes(activeTool))?.id ?? null,
    [activeTool]
  );

  const cycleMagnet = () => {
    const currentIndex = MAGNET_MODES.indexOf(magnetMode);
    onSetMagnetMode(MAGNET_MODES[(currentIndex + 1) % MAGNET_MODES.length]);
  };

  return (
    <div
      className={`app-chrome-strong app-chrome-divider hidden h-full w-12 border-r py-2 shadow-xl xl:flex xl:flex-col xl:items-center ${
        isPinned ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      } ${className}`}
      onPointerLeave={() => setOpenCategory(null)}
    >
      <div className="flex flex-1 flex-col items-center gap-2">
        <button
          type="button"
          title={t("priceChart.drawings.cursor")}
          onClick={() => onSelectTool(null)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            !activeTool ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/75 hover:text-foreground"
          }`}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>

        {DRAWING_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id];
          const isOpen = openCategory === category.id;
          const isActive = activeCategory === category.id;
          return (
            <div key={category.id} className="relative">
              <button
                type="button"
                title={t(category.labelKey)}
                onPointerEnter={() => setOpenCategory(category.id)}
                onClick={() => setOpenCategory(isOpen ? null : category.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                  isActive || isOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/75 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>

              {isOpen ? (
                <div className="app-chrome-strong absolute left-full top-0 z-50 ml-2 w-60 overflow-hidden rounded-xl border border-border/80 py-1 shadow-2xl">
                  <div className="border-b border-border/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(category.labelKey)}
                  </div>
                  {category.tools.map((toolId) => {
                    const tool = DRAWING_REGISTRY[toolId];
                    const selected = activeTool === toolId;
                    return (
                      <button
                        key={toolId}
                        type="button"
                        onClick={() => {
                          onSelectTool(selected ? null : toolId);
                          setOpenCategory(null);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                          selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/70"
                        }`}
                      >
                        <span>{t(tool.labelKey)}</span>
                        <ChevronRight className={`h-3.5 w-3.5 ${selected ? "opacity-100" : "opacity-0"}`} />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="app-chrome-divider flex flex-col items-center gap-1 border-t pt-2">
        <button
          type="button"
          title={t(`priceChart.drawings.magnet.${magnetMode}`)}
          onClick={cycleMagnet}
          className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
            magnetMode === "off" ? "text-muted-foreground hover:bg-accent/75" : "bg-primary/10 text-primary"
          }`}
        >
          <Magnet className="h-4 w-4" />
          {magnetMode !== "off" ? <span className="absolute bottom-0.5 right-1 text-[8px] font-bold">{magnetMode === "strong" ? "2" : "1"}</span> : null}
        </button>
        <button
          type="button"
          title={t("priceChart.drawings.keepTool")}
          onClick={() => onSetKeepToolActive(!keepToolActive)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            keepToolActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/75"
          }`}
        >
          <Pin className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("priceChart.tools.clear")}
          onClick={() => {
            if (window.confirm(t("priceChart.drawings.clearConfirm"))) onClear();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ChartToolSidebar;
