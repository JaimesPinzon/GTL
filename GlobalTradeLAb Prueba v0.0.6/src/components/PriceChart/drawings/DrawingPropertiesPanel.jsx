import React from "react";
import { Copy, EyeOff, Lock, Tags, Trash2, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDrawingLabelKey } from "./drawingRegistry";

const DrawingPropertiesPanel = ({ drawing, currentTimeframe, onDuplicate, onRemove, onUpdate }) => {
  const { t } = useTranslation();
  if (!drawing) return null;

  const updateStyle = (patch) => onUpdate(drawing.id, {
    style: { ...drawing.style, ...patch },
  });
  const updateState = (patch) => onUpdate(drawing.id, {
    state: { ...drawing.state, ...patch },
  });

  return (
    <div className="app-chrome-strong pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[calc(100%-72px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-border/80 p-1.5 shadow-2xl">
      <span className="max-w-32 truncate px-2 text-xs font-semibold text-foreground">
        {drawing.name || t(getDrawingLabelKey(drawing.type))}
      </span>
      <input
        type="color"
        value={drawing.style.color}
        onChange={(event) => updateStyle({ color: event.target.value })}
        className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        title={t("priceChart.drawings.properties.color")}
      />
      <input
        type="color"
        value={drawing.style.fillColor}
        onChange={(event) => updateStyle({ fillColor: event.target.value })}
        className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        title={t("priceChart.drawings.properties.fillColor")}
      />
      <select
        value={drawing.style.width}
        onChange={(event) => updateStyle({ width: Number(event.target.value) })}
        className="h-8 rounded-md border border-border/70 bg-background px-1 text-xs text-foreground"
        title={t("priceChart.drawings.properties.width")}
      >
        {[1, 2, 3, 4].map((width) => <option key={width} value={width}>{width}px</option>)}
      </select>
      <select
        value={drawing.style.lineStyle}
        onChange={(event) => updateStyle({ lineStyle: event.target.value })}
        className="h-8 rounded-md border border-border/70 bg-background px-1 text-xs text-foreground"
        title={t("priceChart.drawings.properties.lineStyle")}
      >
        <option value="solid">{t("priceChart.drawings.properties.solid")}</option>
        <option value="dashed">{t("priceChart.drawings.properties.dashed")}</option>
        <option value="dotted">{t("priceChart.drawings.properties.dotted")}</option>
      </select>
      <select
        value={drawing.style.fillOpacity}
        onChange={(event) => updateStyle({ fillOpacity: Number(event.target.value) })}
        className="h-8 rounded-md border border-border/70 bg-background px-1 text-xs text-foreground"
        title={t("priceChart.drawings.properties.fillOpacity")}
      >
        {[0, 0.12, 0.25, 0.5, 0.75].map((opacity) => <option key={opacity} value={opacity}>{Math.round(opacity * 100)}%</option>)}
      </select>
      <select
        value={drawing.timeframeScope?.mode || "all"}
        onChange={(event) => onUpdate(drawing.id, {
          timeframeScope: {
            mode: event.target.value,
            timeframe: event.target.value === "single" ? currentTimeframe : null,
          },
        })}
        className="h-8 rounded-md border border-border/70 bg-background px-1 text-xs text-foreground"
        title={t("priceChart.drawings.properties.visibility")}
      >
        <option value="all">{t("priceChart.drawings.properties.allTimeframes")}</option>
        <option value="single">{t("priceChart.drawings.properties.thisTimeframe")}</option>
      </select>
      <button
        type="button"
        onClick={() => updateStyle({ showLabels: !drawing.style.showLabels })}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent ${drawing.style.showLabels ? "text-primary" : "text-muted-foreground"}`}
        title={t("priceChart.drawings.properties.labels")}
      >
        <Tags className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => updateState({ locked: !drawing.state.locked })}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        title={drawing.state.locked ? t("priceChart.drawings.actions.unlock") : t("priceChart.drawings.actions.lock")}
      >
        {drawing.state.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={() => onDuplicate(drawing.id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        title={t("priceChart.drawings.actions.duplicate")}
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => updateState({ hidden: true })}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        title={t("priceChart.drawings.actions.hide")}
      >
        <EyeOff className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(drawing.id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-400 hover:bg-rose-500/10"
        title={t("common.actions.delete")}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export default DrawingPropertiesPanel;
