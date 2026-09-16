import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { anchorToPoint } from "./drawingCoordinates";
import {
  calculateMeasurement,
  extendLineToViewport,
  getDashArray,
  getParallelChannelPoints,
  pointsToPath,
} from "./drawingGeometry";
import { getDrawingLabelKey } from "./drawingRegistry";
import { drawingIsReadOnly } from "./drawingDefaults";
import DrawingPropertiesPanel from "./DrawingPropertiesPanel";

const formatElapsed = (seconds) => {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)} d`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds)} s`;
};

const formatPrice = (value, currency) => {
  const maximumFractionDigits = Math.abs(Number(value)) < 10 ? 4 : 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits,
  }).format(Number(value) || 0);
};

const DrawingLayer = ({
  chartContainerRef,
  chartRef,
  chartRevision,
  currency,
  currentTimeframe,
  activeClassId,
  canManageEducationalDrawings,
  currentUserId,
  activeTool,
  drawings,
  hasCopiedStyle,
  onBeginDrag,
  onCopyStyle,
  onDuplicate,
  onPasteStyle,
  onRemove,
  onReorder,
  onSelect,
  onSetHidden,
  onSetExplanationVisible,
  onUpdate,
  previewDrawing,
  renderedDataRef,
  selectedDrawing,
  selectedDrawingId,
  seriesRef,
}) => {
  const { t } = useTranslation();
  const [viewport, setViewport] = useState({ width: 0, height: 0, revision: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const host = chartContainerRef.current;
    const chart = chartRef.current;
    if (!host || !chart) return undefined;

    const requestRender = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setViewport((current) => ({
          width: host.clientWidth,
          height: host.clientHeight,
          revision: current.revision + 1,
        }));
      });
    };

    const observer = new ResizeObserver(requestRender);
    observer.observe(host);
    chart.timeScale().subscribeVisibleLogicalRangeChange(requestRender);
    chart.timeScale().subscribeVisibleTimeRangeChange(requestRender);
    host.addEventListener("wheel", requestRender, { passive: true });
    host.addEventListener("pointermove", requestRender, { passive: true });
    requestRender();

    return () => {
      observer.disconnect();
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(requestRender); } catch {}
      try { chart.timeScale().unsubscribeVisibleTimeRangeChange(requestRender); } catch {}
      host.removeEventListener("wheel", requestRender);
      host.removeEventListener("pointermove", requestRender);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [chartContainerRef, chartRef, chartRevision]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  const projected = useMemo(() => {
    if (!chartRef.current || !seriesRef.current) return [];
    const source = previewDrawing ? [...drawings, { ...previewDrawing, id: "__preview" }] : drawings;
    return source.map((drawing) => ({
      drawing,
      points: drawing.anchors.map((anchor) => anchorToPoint({
        anchor,
        chart: chartRef.current,
        series: seriesRef.current,
        data: renderedDataRef.current,
      })),
    })).filter((entry) => entry.points.some(Boolean));
  }, [chartRef, drawings, previewDrawing, renderedDataRef, seriesRef, viewport.revision]);

  const showContextMenu = (event, drawing) => {
    if (drawing.id === "__preview") return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(drawing.id);
    const bounds = chartContainerRef.current?.getBoundingClientRect();
    setContextMenu({
      drawing,
      x: event.clientX - (bounds?.left || 0),
      y: event.clientY - (bounds?.top || 0),
    });
  };

  const renderHandles = (drawing, points) => {
    if (drawing.id !== selectedDrawingId || drawing.id === "__preview") return null;
    return points.map((point, index) => point ? (
      <circle
        key={`${drawing.id}-handle-${index}`}
        cx={point.x}
        cy={point.y}
        r={5}
        fill={drawing.state?.locked ? "#f59e0b" : "#ffffff"}
        stroke={drawing.style.color}
        strokeWidth={2}
        className={drawing.state?.locked ? "cursor-not-allowed" : "cursor-grab"}
        style={{ pointerEvents: "all" }}
        onPointerDown={(event) => {
          onSelect(drawing.id);
          onBeginDrag(event, drawing.id, index);
        }}
      />
    ) : null);
  };

  const renderEntry = ({ drawing, points }) => {
    const isPreview = drawing.id === "__preview";
    const isSelected = drawing.id === selectedDrawingId;
    const isReadOnly = drawingIsReadOnly(drawing, currentUserId);
    const style = drawing.style || {};
    const stroke = style.color || "#2962ff";
    const strokeWidth = Number(style.width) || 2;
    const dash = isPreview ? "6 5" : getDashArray(style.lineStyle);
    const opacity = isPreview ? 0.65 : Number(style.opacity ?? 1);
    const fill = style.fillColor || stroke;
    const fillOpacity = Number(style.fillOpacity ?? 0.12);
    const common = { stroke, strokeWidth, strokeDasharray: dash, opacity, fill: "none" };

    const isInteractive = !isPreview && !activeTool;
    const bodyEvents = !isInteractive ? {} : {
      onPointerDown: (event) => {
        onSelect(drawing.id);
        onBeginDrag(event, drawing.id, null);
      },
      onContextMenu: (event) => showContextMenu(event, drawing),
    };

    const InteractivePath = ({ d, shapeFill = "none", shapeFillOpacity = 0, markerEnd }) => (
      <>
        <path d={d} {...common} fill={shapeFill} fillOpacity={shapeFillOpacity} markerEnd={markerEnd} />
        {isInteractive ? (
          <path
            d={d}
            fill={shapeFill === "none" ? "none" : "transparent"}
            stroke="transparent"
            strokeWidth={Math.max(10, strokeWidth + 8)}
            style={{ pointerEvents: shapeFill === "none" ? "stroke" : "all", cursor: drawing.state?.locked || isReadOnly ? "pointer" : "move" }}
            {...bodyEvents}
          />
        ) : null}
      </>
    );

    let content = null;
    const validPoints = points.filter(Boolean);

    if (["trendline", "arrow", "ray", "infiniteLine"].includes(drawing.type) && points[0] && points[1]) {
      let [start, end] = [points[0], points[1]];
      if (drawing.type === "ray") [start, end] = extendLineToViewport(start, end, viewport.width, viewport.height, "ray");
      if (drawing.type === "infiniteLine") [start, end] = extendLineToViewport(start, end, viewport.width, viewport.height);
      content = <InteractivePath d={pointsToPath([start, end])} markerEnd={drawing.type === "arrow" ? "url(#drawing-arrow)" : undefined} />;
    } else if (drawing.type === "horizontalLine" && points[0]) {
      content = <InteractivePath d={pointsToPath([{ x: 0, y: points[0].y }, { x: viewport.width, y: points[0].y }])} />;
    } else if (drawing.type === "horizontalRay" && points[0]) {
      content = <InteractivePath d={pointsToPath([points[0], { x: viewport.width, y: points[0].y }])} />;
    } else if (drawing.type === "verticalLine" && points[0]) {
      content = <InteractivePath d={pointsToPath([{ x: points[0].x, y: 0 }, { x: points[0].x, y: viewport.height }])} />;
    } else if (drawing.type === "polyline" && validPoints.length >= 2) {
      content = <InteractivePath d={pointsToPath(validPoints)} />;
    } else if (drawing.type === "parallelChannel" && points[0] && points[1] && points[2]) {
      const channel = getParallelChannelPoints(points);
      if (channel) content = <InteractivePath d={pointsToPath(channel, true)} shapeFill={fill} shapeFillOpacity={fillOpacity} />;
    } else if (["rectangle", "zone", "rangeMeasure"].includes(drawing.type) && points[0] && points[1]) {
      const x = Math.min(points[0].x, points[1].x);
      const y = Math.min(points[0].y, points[1].y);
      const width = Math.abs(points[1].x - points[0].x);
      const height = Math.abs(points[1].y - points[0].y);
      const path = pointsToPath([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], true);
      content = <InteractivePath d={path} shapeFill={fill} shapeFillOpacity={fillOpacity} />;
    } else if (drawing.type === "ellipse" && points[0] && points[1]) {
      const cx = (points[0].x + points[1].x) / 2;
      const cy = (points[0].y + points[1].y) / 2;
      const rx = Math.abs(points[1].x - points[0].x) / 2;
      const ry = Math.abs(points[1].y - points[0].y) / 2;
      content = (
        <>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} fill={fill} fillOpacity={fillOpacity} />
          {isInteractive ? <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="transparent" stroke="transparent" strokeWidth={10} style={{ pointerEvents: "all", cursor: drawing.state?.locked ? "pointer" : "move" }} {...bodyEvents} /> : null}
        </>
      );
    } else if (drawing.type === "triangle" && validPoints.length >= 3) {
      content = <InteractivePath d={pointsToPath(validPoints.slice(0, 3), true)} shapeFill={fill} shapeFillOpacity={fillOpacity} />;
    } else if (drawing.type === "priceMeasure" && points[0] && points[1]) {
      const x = points[0].x;
      content = <InteractivePath d={pointsToPath([{ x, y: points[0].y }, { x, y: points[1].y }])} />;
    } else if (drawing.type === "timeMeasure" && points[0] && points[1]) {
      const y = points[0].y;
      content = <InteractivePath d={pointsToPath([{ x: points[0].x, y }, { x: points[1].x, y }])} />;
    } else if (["longPosition", "shortPosition"].includes(drawing.type) && points[0] && points[1]) {
      const positionPoints = points.slice(0, 3).filter(Boolean);
      const entryPrice = Number(drawing.anchors[0].price);
      const stopPrice = Number(drawing.anchors[1].price);
      const targetPrice = Number(drawing.anchors[2]?.price ?? drawing.anchors[0].price);
      const x1 = Math.min(...positionPoints.map((point) => point.x));
      const rawX2 = Math.max(...positionPoints.map((point) => point.x));
      const x2 = Math.min(viewport.width, Math.max(rawX2, x1 + 80));
      const entryY = points[0].y;
      const stopY = points[1].y;
      const targetY = points[2]?.y ?? entryY;
      const riskPerUnit = Math.abs(entryPrice - stopPrice);
      const rewardPerUnit = Math.abs(targetPrice - entryPrice);
      const riskReward = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
      const riskPercent = entryPrice !== 0 ? (riskPerUnit / Math.abs(entryPrice)) * 100 : 0;
      const rewardPercent = entryPrice !== 0 ? (rewardPerUnit / Math.abs(entryPrice)) * 100 : 0;
      const capital = Math.max(0, Number(drawing.position?.capital) || 0);
      const accountRiskPercent = Math.max(0, Number(drawing.position?.accountRiskPercent) || 0);
      const riskAmount = capital * accountRiskPercent / 100;
      const units = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
      const outerTop = Math.min(entryY, stopY, targetY);
      const outerBottom = Math.max(entryY, stopY, targetY);
      const outerPath = pointsToPath([
        { x: x1, y: outerTop },
        { x: x2, y: outerTop },
        { x: x2, y: outerBottom },
        { x: x1, y: outerBottom },
      ], true);
      content = (
        <>
          <rect x={x1} y={Math.min(entryY, targetY)} width={Math.max(1, x2 - x1)} height={Math.max(1, Math.abs(targetY - entryY))} fill="#22c55e" fillOpacity={0.18} stroke="#22c55e" strokeWidth={1} />
          <rect x={x1} y={Math.min(entryY, stopY)} width={Math.max(1, x2 - x1)} height={Math.max(1, Math.abs(stopY - entryY))} fill="#ef4444" fillOpacity={0.18} stroke="#ef4444" strokeWidth={1} />
          <line x1={x1} x2={x2} y1={entryY} y2={entryY} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
          <InteractivePath d={outerPath} />
          {style.showLabels ? (
            <g>
              <text x={x1 + 6} y={entryY - 5} fill="hsl(var(--foreground))" fontSize="10" fontWeight="700">ENTRY {formatPrice(entryPrice, currency)}</text>
              <text x={x1 + 6} y={stopY + (stopY < entryY ? -5 : 14)} fill="#ef4444" fontSize="10" fontWeight="700">SL {formatPrice(stopPrice, currency)} · {riskPercent.toFixed(2)}%</text>
              <text x={x1 + 6} y={targetY + (targetY < entryY ? -5 : 14)} fill="#22c55e" fontSize="10" fontWeight="700">TP {formatPrice(targetPrice, currency)} · {rewardPercent.toFixed(2)}%</text>
              <g transform={`translate(${x1 + 6} ${outerTop + 6})`}>
                <rect width={Math.min(238, Math.max(170, x2 - x1 - 12))} height={22} rx={5} fill="hsl(var(--background))" opacity={0.9} />
                <text x={7} y={15} fill="hsl(var(--foreground))" fontSize="10" fontWeight="600">R:R {riskReward.toFixed(2)} · {units.toFixed(4)} u · {formatPrice(riskAmount, currency)}</text>
              </g>
            </g>
          ) : null}
        </>
      );
    } else if (["fibonacciRetracement", "fibonacciExtension"].includes(drawing.type) && points[0] && points[1] && (drawing.type !== "fibonacciExtension" || points[2])) {
      const fibonacciPoints = drawing.type === "fibonacciExtension" ? points.slice(0, 3) : points.slice(0, 2);
      const minimumX = Math.min(...fibonacciPoints.map((point) => point.x));
      const maximumX = Math.max(...fibonacciPoints.map((point) => point.x));
      const x1 = drawing.fibonacci?.extendLeft ? 0 : minimumX;
      const x2 = drawing.fibonacci?.extendRight ? viewport.width : maximumX;
      const priceStart = Number(drawing.anchors[0].price);
      const priceEnd = Number(drawing.anchors[1].price);
      const extensionBase = drawing.type === "fibonacciExtension"
        ? Number(drawing.anchors[2].price)
        : priceStart;
      content = (
        <g {...bodyEvents} style={{ pointerEvents: isInteractive ? "all" : "none", cursor: drawing.state?.locked ? "pointer" : "move" }}>
          {(drawing.fibonacci?.levels || []).filter((level) => level.visible !== false).map((level) => {
            const levelPrice = extensionBase + (priceEnd - priceStart) * Number(level.value);
            const y = seriesRef.current?.priceToCoordinate(levelPrice);
            if (!Number.isFinite(y)) return null;
            return (
              <g key={`${drawing.id}-${level.value}`}>
                <line x1={x1} x2={x2} y1={y} y2={y} stroke={level.color || stroke} strokeWidth={strokeWidth} strokeDasharray={dash} opacity={opacity} />
                {isInteractive ? <line x1={x1} x2={x2} y1={y} y2={y} stroke="transparent" strokeWidth={Math.max(10, strokeWidth + 8)} /> : null}
                {style.showLabels ? <text x={Math.min(x2 - 6, x1 + 6)} y={y - 4} fill={level.color || stroke} fontSize="11">{level.value} · {formatPrice(levelPrice, currency)}</text> : null}
              </g>
            );
          })}
        </g>
      );
    }

    if (!content) return null;
    const measurement = ["priceMeasure", "timeMeasure", "rangeMeasure"].includes(drawing.type)
      ? calculateMeasurement(drawing, renderedDataRef.current)
      : null;
    const labelPoint = points[1] || points[0];
    const measurementLabel = measurement
      ? drawing.type === "priceMeasure"
        ? `${measurement.priceDifference >= 0 ? "+" : ""}${formatPrice(measurement.priceDifference, currency)} · ${measurement.percentage.toFixed(2)}%`
        : drawing.type === "timeMeasure"
          ? `${formatElapsed(measurement.elapsedSeconds)} · ${measurement.candleCount} ${t("priceChart.drawings.measurement.candles")}`
          : `${measurement.percentage.toFixed(2)}% · ${measurement.candleCount} ${t("priceChart.drawings.measurement.candles")} · ${formatElapsed(measurement.elapsedSeconds)}`
      : null;

    return (
      <g key={drawing.id} opacity={drawing.state?.hidden ? 0 : 1}>
        {content}
        {measurementLabel && labelPoint ? (
          <g transform={`translate(${labelPoint.x + 8} ${labelPoint.y - 24})`}>
            <rect x={0} y={0} width={Math.max(120, measurementLabel.length * 6.5)} height={22} rx={6} fill="hsl(var(--background))" stroke={stroke} opacity={0.94} />
            <text x={8} y={15} fill="hsl(var(--foreground))" fontSize="11" fontWeight="600">{measurementLabel}</text>
          </g>
        ) : null}
        {["horizontalLine", "horizontalRay"].includes(drawing.type) && points[0] && style.showLabels ? (
          <g transform={`translate(${Math.max(0, viewport.width - 92)} ${points[0].y - 10})`}>
            <rect width={88} height={20} rx={4} fill={stroke} opacity={0.92} />
            <text x={44} y={14} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="700">
              {formatPrice(drawing.anchors[0].price, currency)}
            </text>
          </g>
        ) : null}
        {isSelected && !isPreview && !isReadOnly ? renderHandles(drawing, points) : null}
        {!isPreview && drawing.education?.showExplanation && drawing.education?.explanation && points[0] ? (
          <g transform={`translate(${Math.min(viewport.width - 236, Math.max(8, points[0].x + 12))} ${Math.min(viewport.height - 42, Math.max(8, points[0].y + 12))})`}>
            <rect width={228} height={34} rx={8} fill="hsl(var(--background))" fillOpacity={0.94} stroke={stroke} strokeOpacity={0.55} />
            <text x={10} y={21} fill="hsl(var(--foreground))" fontSize="10" fontWeight="600">
              {drawing.education.explanation.length > 38
                ? `${drawing.education.explanation.slice(0, 38)}…`
                : drawing.education.explanation}
            </text>
          </g>
        ) : null}
      </g>
    );
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <svg width={viewport.width} height={viewport.height} className="absolute inset-0 overflow-visible">
        <defs>
          <marker id="drawing-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 8 4 L 0 8 Z" fill="context-stroke" />
          </marker>
        </defs>
        {projected.map(renderEntry)}
      </svg>

      <DrawingPropertiesPanel
        drawing={selectedDrawing}
        currentTimeframe={currentTimeframe}
        activeClassId={activeClassId}
        canManageEducationalDrawings={canManageEducationalDrawings}
        currentUserId={currentUserId}
        hasCopiedStyle={hasCopiedStyle}
        onCopyStyle={onCopyStyle}
        onDuplicate={onDuplicate}
        onPasteStyle={onPasteStyle}
        onRemove={onRemove}
        onSetHidden={onSetHidden}
        onSetExplanationVisible={onSetExplanationVisible}
        onUpdate={onUpdate}
      />

      {contextMenu ? (
        <div
          className="app-chrome-strong pointer-events-auto absolute z-40 w-52 overflow-hidden rounded-xl border border-border/80 py-1 text-sm text-foreground shadow-2xl"
          style={{ left: Math.max(8, Math.min(contextMenu.x, viewport.width - 220)), top: Math.max(8, Math.min(contextMenu.y, viewport.height - 330)) }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="truncate border-b border-border/70 px-3 py-2 text-xs font-semibold">
            {contextMenu.drawing.name || t(getDrawingLabelKey(contextMenu.drawing.type))}
          </div>
          {[
            [t("priceChart.drawings.actions.duplicate"), () => onDuplicate(contextMenu.drawing.id)],
            [t("priceChart.drawings.actions.copyStyle"), () => onCopyStyle(contextMenu.drawing.id)],
            ...(hasCopiedStyle && !drawingIsReadOnly(contextMenu.drawing, currentUserId)
              ? [[t("priceChart.drawings.actions.pasteStyle"), () => onPasteStyle(contextMenu.drawing.id)]]
              : []),
            ...(!drawingIsReadOnly(contextMenu.drawing, currentUserId) ? [
              [contextMenu.drawing.state?.locked ? t("priceChart.drawings.actions.unlock") : t("priceChart.drawings.actions.lock"), () => onUpdate(contextMenu.drawing.id, { state: { ...contextMenu.drawing.state, locked: !contextMenu.drawing.state?.locked } })],
              [t("priceChart.drawings.actions.front"), () => onReorder(contextMenu.drawing.id, "front")],
              [t("priceChart.drawings.actions.back"), () => onReorder(contextMenu.drawing.id, "back")],
              [t("priceChart.drawings.actions.onlyTimeframe"), () => onUpdate(contextMenu.drawing.id, { timeframeScope: { mode: "single", timeframe: currentTimeframe } })],
              [t("priceChart.drawings.actions.allTimeframes"), () => onUpdate(contextMenu.drawing.id, { timeframeScope: { mode: "all", timeframe: null } })],
            ] : []),
            [t("priceChart.drawings.actions.hide"), () => onSetHidden(contextMenu.drawing.id, true)],
          ].map(([label, action]) => (
            <button key={label} type="button" onClick={() => { action(); setContextMenu(null); }} className="block w-full px-3 py-2 text-left text-xs hover:bg-accent">{label}</button>
          ))}
          {!drawingIsReadOnly(contextMenu.drawing, currentUserId) ? (
            <button type="button" onClick={() => { onRemove(contextMenu.drawing.id); setContextMenu(null); }} className="block w-full border-t border-border/70 px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10">{t("common.actions.delete")}</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DrawingLayer;
