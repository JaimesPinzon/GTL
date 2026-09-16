import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  GripHorizontal,
  Lock,
  PaintBucket,
  Tags,
  Trash2,
  Unlock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { drawingIsReadOnly } from "./drawingDefaults";
import { getDrawingLabelKey } from "./drawingRegistry";

const BASIC_COLORS = [
  "#2962ff", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444",
  "#a855f7", "#ec4899", "#f8fafc", "#94a3b8", "#334155", "#111827",
];

const ColorPicker = ({ label, value, onChange, open, onToggle, fill = false }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const applyDraft = () => {
    if (/^#[0-9a-f]{6}$/i.test(draft)) onChange(draft.toLowerCase());
    else setDraft(value);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-8 items-center gap-1 rounded-md border px-1.5 transition ${
          open ? "border-primary/60 bg-primary/10" : "border-border/70 bg-background/70 hover:border-primary/40"
        }`}
        title={label}
        aria-expanded={open}
      >
        <span className="h-4 w-4 rounded-sm border border-white/25 shadow-inner" style={{ backgroundColor: value }} />
        {fill ? <PaintBucket className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open ? (
        <div
          className="app-chrome-strong absolute left-0 top-full z-50 mt-2 w-52 rounded-xl border border-primary/20 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <div className="grid grid-cols-6 gap-2">
            {BASIC_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                className={`h-5 w-5 rounded-[5px] border transition hover:scale-110 ${
                  value.toLowerCase() === color ? "border-primary ring-2 ring-primary/30" : "border-white/20"
                }`}
                style={{ backgroundColor: color }}
                title={color}
                aria-label={color}
              />
            ))}
          </div>
          <div className="mt-3 border-t border-border/70 pt-3">
            <p className="mb-2 text-[10px] font-medium text-muted-foreground">
              {t("priceChart.drawings.properties.customColor")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-8 w-9 cursor-pointer rounded-md border border-border/70 bg-transparent p-0.5"
                aria-label={label}
              />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={applyDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyDraft();
                    event.currentTarget.blur();
                  }
                }}
                className="h-8 min-w-0 flex-1 rounded-md border border-border/70 bg-background/80 px-2 font-mono text-xs uppercase text-foreground outline-none focus:border-primary/60"
                aria-label={t("priceChart.drawings.properties.hexColor")}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DrawingPropertiesPanel = ({
  drawing,
  currentTimeframe,
  activeClassId,
  canManageEducationalDrawings,
  currentUserId,
  hasCopiedStyle,
  onCopyStyle,
  onDuplicate,
  onPasteStyle,
  onRemove,
  onSetHidden,
  onSetExplanationVisible,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState({ x: 8, y: 8 });
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const [educationOpen, setEducationOpen] = useState(false);

  useEffect(() => {
    setOpenColorPicker(null);
    setEducationOpen(false);
  }, [drawing?.id]);

  if (!drawing) return null;

  const updateStyle = (patch) => onUpdate(drawing.id, { style: { ...drawing.style, ...patch } });
  const updateState = (patch) => onUpdate(drawing.id, { state: { ...drawing.state, ...patch } });
  const updateFibonacci = (patch) => onUpdate(drawing.id, {
    fibonacci: { ...drawing.fibonacci, ...patch, extensionConfigured: true },
  });
  const updatePosition = (patch) => onUpdate(drawing.id, { position: { ...drawing.position, ...patch } });
  const updateEducation = (patch) => onUpdate(drawing.id, {
    education: { ...drawing.education, ...patch },
  });
  const isReadOnly = drawingIsReadOnly(drawing, currentUserId);
  const isSharedWithClass = drawing.ownership?.visibility === "class";

  const setSharedWithClass = (shared) => onUpdate(drawing.id, {
    ownership: {
      ...drawing.ownership,
      visibility: shared ? "class" : "private",
      classId: shared ? activeClassId : null,
    },
  });

  const beginPanelDrag = (event) => {
    if (event.button !== 0 || !panelRef.current?.parentElement) return;
    event.preventDefault();
    event.stopPropagation();
    const panelRect = panelRef.current.getBoundingClientRect();
    const parentRect = panelRef.current.parentElement.getBoundingClientRect();
    setPosition({ x: panelRect.left - parentRect.left, y: panelRect.top - parentRect.top });
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const movePanel = (event) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!drag || drag.pointerId !== event.pointerId || !panel || !parent) return;
    event.preventDefault();
    event.stopPropagation();
    const parentRect = parent.getBoundingClientRect();
    const maxX = Math.max(8, parentRect.width - 96);
    const maxY = Math.max(8, parentRect.height - panel.offsetHeight - 8);
    setPosition({
      x: Math.min(maxX, Math.max(8, event.clientX - parentRect.left - drag.offsetX)),
      y: Math.min(maxY, Math.max(8, event.clientY - parentRect.top - drag.offsetY)),
    });
  };

  const endPanelDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {}
    dragRef.current = null;
  };

  const panelStyle = { left: position.x, top: position.y };

  return (
    <div
      ref={panelRef}
      className="app-chrome-strong pointer-events-auto absolute z-30 flex max-w-[calc(100%_-_16px)] flex-nowrap items-center gap-1 rounded-xl border border-primary/20 bg-background/95 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.48)] backdrop-blur-xl"
      style={panelStyle}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onPointerDown={beginPanelDrag}
        onPointerMove={movePanel}
        onPointerUp={endPanelDrag}
        onPointerCancel={endPanelDrag}
        onDoubleClick={() => setPosition({ x: 8, y: 8 })}
        className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
        title={t("priceChart.drawings.properties.moveToolbar")}
      >
        <GripHorizontal className="h-4 w-4" />
      </button>

      <span className="max-w-32 truncate border-r border-border/70 px-2 text-xs font-semibold text-foreground">
        {drawing.name || t(getDrawingLabelKey(drawing.type))}
      </span>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setEducationOpen((open) => !open)}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
            educationOpen || isSharedWithClass
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          title={t("priceChart.drawings.education.title")}
        >
          <GraduationCap className="h-4 w-4" />
        </button>

        {educationOpen ? (
          <div
            className="app-chrome-strong absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-primary/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">{t("priceChart.drawings.education.title")}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {isReadOnly
                    ? t("priceChart.drawings.education.teacherDrawing")
                    : t("priceChart.drawings.education.description")}
                </p>
              </div>
              {isReadOnly ? <Lock className="h-4 w-4 text-amber-300" /> : null}
            </div>

            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("priceChart.drawings.education.explanation")}
              <textarea
                value={drawing.education?.explanation || ""}
                disabled={isReadOnly}
                maxLength={2000}
                onChange={(event) => updateEducation({ explanation: event.target.value })}
                className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-border/70 bg-background/80 p-2 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder={t("priceChart.drawings.education.explanationPlaceholder")}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                const visible = !drawing.education?.showExplanation;
                if (isReadOnly) onSetExplanationVisible(drawing.id, visible);
                else updateEducation({ showExplanation: visible });
              }}
              className={`mt-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${
                drawing.education?.showExplanation
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-accent"
              }`}
            >
              <span>{t("priceChart.drawings.education.showExplanation")}</span>
              {drawing.education?.showExplanation ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>

            {!isReadOnly ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("priceChart.drawings.education.activity")}
                    <input
                      value={drawing.education?.activityId || ""}
                      onChange={(event) => updateEducation({ activityId: event.target.value || null })}
                      className="mt-1.5 h-8 w-full rounded-lg border border-border/70 bg-background/80 px-2 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary/60"
                    />
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("priceChart.drawings.education.historicalEvent")}
                    <input
                      value={drawing.education?.historicalEventId || ""}
                      onChange={(event) => updateEducation({ historicalEventId: event.target.value || null })}
                      className="mt-1.5 h-8 w-full rounded-lg border border-border/70 bg-background/80 px-2 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary/60"
                    />
                  </label>
                </div>
                <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                  <label className="flex items-center justify-between gap-3 text-xs text-foreground">
                    <span>{t("priceChart.drawings.education.template")}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(drawing.education?.isTemplate)}
                      onChange={(event) => updateEducation({ isTemplate: event.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                  {canManageEducationalDrawings && activeClassId ? (
                    <label className="flex items-center justify-between gap-3 text-xs text-foreground">
                      <span>{t("priceChart.drawings.education.shareWithClass")}</span>
                      <input
                        type="checkbox"
                        checked={isSharedWithClass}
                        onChange={(event) => setSharedWithClass(event.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <ColorPicker
        label={t("priceChart.drawings.properties.color")}
        value={drawing.style.color}
        onChange={(color) => updateStyle({ color })}
        open={openColorPicker === "stroke"}
        onToggle={() => setOpenColorPicker((current) => current === "stroke" ? null : "stroke")}
      />
      <ColorPicker
        label={t("priceChart.drawings.properties.fillColor")}
        value={drawing.style.fillColor}
        onChange={(fillColor) => updateStyle({ fillColor })}
        open={openColorPicker === "fill"}
        onToggle={() => setOpenColorPicker((current) => current === "fill" ? null : "fill")}
        fill
      />

      <select
        value={drawing.style.width}
        onChange={(event) => updateStyle({ width: Number(event.target.value) })}
        className="h-8 rounded-md border border-border/70 bg-background/80 px-1 text-xs text-foreground"
        title={t("priceChart.drawings.properties.width")}
      >
        {[1, 2, 3, 4].map((width) => <option key={width} value={width}>{width}px</option>)}
      </select>

      {drawing.fibonacci ? (
        <>
          <button type="button" onClick={() => updateFibonacci({ extendLeft: !drawing.fibonacci.extendLeft })} className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${drawing.fibonacci.extendLeft ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} title={t("priceChart.drawings.properties.extendLeft")}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => updateFibonacci({ extendRight: !drawing.fibonacci.extendRight })} className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${drawing.fibonacci.extendRight ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} title={t("priceChart.drawings.properties.extendRight")}>
            <ArrowRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      {drawing.position ? (
        <>
          <input type="number" min="0" step="100" value={drawing.position.capital} onChange={(event) => updatePosition({ capital: Math.max(0, Number(event.target.value) || 0) })} className="h-8 w-24 rounded-md border border-border/70 bg-background/80 px-2 text-xs text-foreground" title={t("priceChart.drawings.properties.capital")} />
          <input type="number" min="0.1" max="100" step="0.1" value={drawing.position.accountRiskPercent} onChange={(event) => updatePosition({ accountRiskPercent: Math.max(0.1, Number(event.target.value) || 1) })} className="h-8 w-16 rounded-md border border-border/70 bg-background/80 px-2 text-xs text-foreground" title={t("priceChart.drawings.properties.accountRisk")} />
        </>
      ) : null}

      <select value={drawing.style.lineStyle} onChange={(event) => updateStyle({ lineStyle: event.target.value })} className="h-8 rounded-md border border-border/70 bg-background/80 px-1 text-xs text-foreground" title={t("priceChart.drawings.properties.lineStyle")}>
        <option value="solid">{t("priceChart.drawings.properties.solid")}</option>
        <option value="dashed">{t("priceChart.drawings.properties.dashed")}</option>
        <option value="dotted">{t("priceChart.drawings.properties.dotted")}</option>
      </select>
      <select value={drawing.style.fillOpacity} onChange={(event) => updateStyle({ fillOpacity: Number(event.target.value) })} className="h-8 rounded-md border border-border/70 bg-background/80 px-1 text-xs text-foreground" title={t("priceChart.drawings.properties.fillOpacity")}>
        {[0, 0.12, 0.25, 0.5, 0.75].map((opacity) => <option key={opacity} value={opacity}>{Math.round(opacity * 100)}%</option>)}
      </select>
      <select
        value={drawing.timeframeScope?.mode || "all"}
        onChange={(event) => onUpdate(drawing.id, { timeframeScope: { mode: event.target.value, timeframe: event.target.value === "single" ? currentTimeframe : null } })}
        className="h-8 rounded-md border border-border/70 bg-background/80 px-1 text-xs text-foreground"
        title={t("priceChart.drawings.properties.visibility")}
      >
        <option value="all">{t("priceChart.drawings.properties.allTimeframes")}</option>
        <option value="single">{t("priceChart.drawings.properties.thisTimeframe")}</option>
      </select>

      <button type="button" onClick={() => updateStyle({ showLabels: !drawing.style.showLabels })} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent ${drawing.style.showLabels ? "text-primary" : "text-muted-foreground"}`} title={t("priceChart.drawings.properties.labels")}>
        <Tags className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => updateState({ locked: !drawing.state.locked })} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title={drawing.state.locked ? t("priceChart.drawings.actions.unlock") : t("priceChart.drawings.actions.lock")}>
        {drawing.state.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => onCopyStyle(drawing.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title={t("priceChart.drawings.actions.copyStyle")}>
        <ClipboardCopy className="h-4 w-4" />
      </button>
      <button type="button" disabled={!hasCopiedStyle} onClick={() => onPasteStyle(drawing.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" title={t("priceChart.drawings.actions.pasteStyle")}>
        <ClipboardPaste className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onDuplicate(drawing.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title={t("priceChart.drawings.actions.duplicate")}>
        <Copy className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onSetHidden(drawing.id, !drawing.state?.hidden)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent ${drawing.state?.hidden ? "bg-amber-500/10 text-amber-300" : "text-muted-foreground hover:text-foreground"}`} title={drawing.state?.hidden ? t("priceChart.drawings.actions.show") : t("priceChart.drawings.actions.hide")}>
        {drawing.state?.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      {!isReadOnly ? (
        <button type="button" onClick={() => onRemove(drawing.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rose-400 hover:bg-rose-500/10" title={t("common.actions.delete")}>
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default DrawingPropertiesPanel;
