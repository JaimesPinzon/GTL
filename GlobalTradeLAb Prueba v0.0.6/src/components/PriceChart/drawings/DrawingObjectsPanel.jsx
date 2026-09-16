import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDrawingLabelKey } from "./drawingRegistry";
import { drawingIsReadOnly } from "./drawingDefaults";

const STATUS_COLORS = {
  saved: "text-emerald-400",
  saving: "text-amber-400",
  loading: "text-sky-400",
  error: "text-rose-400",
  unavailable: "text-muted-foreground",
};

const DrawingObjectsPanel = ({ workspace }) => {
  const { t } = useTranslation();
  const drawings = workspace?.drawings || [];
  const actions = workspace?.actions || {};
  const persistenceState = workspace?.persistenceState || "loading";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/35 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{workspace?.symbol || "—"}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("priceChart.drawings.layers.objectCount", { count: drawings.length })}
          </p>
        </div>
        <span className={`text-[11px] font-semibold ${STATUS_COLORS[persistenceState] || STATUS_COLORS.unavailable}`}>
          {t(`priceChart.drawings.persistence.${persistenceState}`)}
        </span>
      </div>

      {persistenceState === "error" ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {t("priceChart.drawings.persistence.errorDescription")}
        </div>
      ) : null}

      {drawings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-5 text-center text-sm text-muted-foreground">
          {t("priceChart.drawings.layers.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {[...drawings].sort((left, right) => (right.zIndex || 0) - (left.zIndex || 0)).map((drawing) => {
            const isSelected = workspace.selectedDrawingId === drawing.id;
            const isReadOnly = drawingIsReadOnly(drawing, workspace.currentUserId);
            return (
              <div
                key={drawing.id}
                className={`rounded-xl border p-2 transition ${
                  isSelected ? "border-primary/60 bg-primary/10" : "border-border/70 bg-secondary/30 hover:bg-secondary/55"
                }`}
                onClick={() => actions.select?.(drawing.id)}
              >
                <input
                  value={drawing.name || ""}
                  disabled={isReadOnly}
                  onChange={(event) => actions.update?.(drawing.id, { name: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  placeholder={t(getDrawingLabelKey(drawing.type))}
                  className="w-full truncate border-0 bg-transparent px-1 py-1 text-sm font-medium text-foreground outline-none placeholder:text-foreground disabled:cursor-default"
                  aria-label={t("priceChart.drawings.layers.rename")}
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {isReadOnly ? <GraduationCap className="mr-1 inline h-3 w-3 text-primary" /> : null}
                    {drawing.timeframeScope?.mode === "single"
                      ? drawing.timeframeScope.timeframe
                      : t("priceChart.drawings.properties.allTimeframes")}
                  </span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); actions.setHidden?.(drawing.id, drawing.state?.hidden !== true); }}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={drawing.state?.hidden ? t("priceChart.drawings.actions.show") : t("priceChart.drawings.actions.hide")}
                    >
                      {drawing.state?.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {!isReadOnly ? <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); actions.update?.(drawing.id, { state: { ...drawing.state, locked: !drawing.state?.locked } }); }}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={drawing.state?.locked ? t("priceChart.drawings.actions.unlock") : t("priceChart.drawings.actions.lock")}
                    >
                      {drawing.state?.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </button> : null}
                    {!isReadOnly ? <button type="button" onClick={(event) => { event.stopPropagation(); actions.reorder?.(drawing.id, "front"); }} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title={t("priceChart.drawings.actions.front")}><ArrowUp className="h-3.5 w-3.5" /></button> : null}
                    {!isReadOnly ? <button type="button" onClick={(event) => { event.stopPropagation(); actions.reorder?.(drawing.id, "back"); }} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" title={t("priceChart.drawings.actions.back")}><ArrowDown className="h-3.5 w-3.5" /></button> : null}
                    {!isReadOnly ? <button type="button" onClick={(event) => { event.stopPropagation(); actions.remove?.(drawing.id); }} className="flex h-7 w-7 items-center justify-center rounded text-rose-400 hover:bg-rose-500/10" title={t("common.actions.delete")}><Trash2 className="h-3.5 w-3.5" /></button> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DrawingObjectsPanel;
