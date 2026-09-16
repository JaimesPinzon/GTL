import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrawings } from "./useDrawings";
import {
  applyDrawingConfigurationTemplate,
  createDrawing,
  cloneDrawing,
  drawingIsReadOnly,
} from "../drawings/drawingDefaults";
import { drawingIsVisibleInTimeframe, getDrawingDefinition } from "../drawings/drawingRegistry";
import {
  anchorToPoint,
  applyMagnetToAnchor,
  clientPointToChartPoint,
  pointToAnchor,
} from "../drawings/drawingCoordinates";

const isEditableTarget = (target) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const constrainPoint = (point, origin) => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const absoluteX = Math.abs(dx);
  const absoluteY = Math.abs(dy);
  if (absoluteX > absoluteY * 2) return { x: point.x, y: origin.y };
  if (absoluteY > absoluteX * 2) return { x: origin.x, y: point.y };
  const distance = Math.max(absoluteX, absoluteY);
  return { x: origin.x + Math.sign(dx || 1) * distance, y: origin.y + Math.sign(dy || 1) * distance };
};

export function useDrawingTools({
  activeTool,
  chartContainerRef,
  chartRef,
  classId,
  currentTimeframe,
  keepToolActive,
  magnetMode,
  ownerId,
  renderedDataRef,
  selectedSymbol,
  seriesRef,
  setActiveTool,
}) {
  const store = useDrawings({ selectedSymbol, currentTimeframe, ownerId, classId });
  const [tempDrawingPoints, setTempDrawingPoints] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [interactionMode, setInteractionMode] = useState("idle");
  const activeToolRef = useRef(activeTool);
  const tempPointsRef = useRef(tempDrawingPoints);
  const previewFrameRef = useRef(null);
  const latestPreviewParamRef = useRef(null);
  const dragRef = useRef(null);
  const storeRef = useRef(store);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (!activeTool) {
      setTempDrawingPoints([]);
      setPreviewPoint(null);
      setInteractionMode(store.selectedDrawingId ? "selected" : "idle");
    } else {
      setTempDrawingPoints([]);
      setPreviewPoint(null);
      setInteractionMode("armed");
      store.setSelectedDrawingId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    tempPointsRef.current = tempDrawingPoints;
  }, [tempDrawingPoints]);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const cancelCurrentDrawing = useCallback(({ deactivate = true } = {}) => {
    setTempDrawingPoints([]);
    setPreviewPoint(null);
    setInteractionMode(deactivate ? "idle" : "armed");
    if (deactivate) setActiveTool(null);
  }, [setActiveTool]);

  const completeDrawing = useCallback((type, anchors) => {
    if (!type || !anchors.length) return;
    const zIndex = Math.max(0, ...store.drawingObjects.map((drawing) => Number(drawing.zIndex) || 0)) + 1;
    const baseDrawing = createDrawing({
      type,
      anchors,
      symbol: selectedSymbol,
      timeframe: currentTimeframe,
      ownerId,
      zIndex,
    });
    const styleTemplate = store.drawingObjects
      .filter((drawing) => drawing.type === type)
      .sort((left, right) => {
        const leftUpdated = Date.parse(left.updatedAt || left.createdAt || "") || 0;
        const rightUpdated = Date.parse(right.updatedAt || right.createdAt || "") || 0;
        return rightUpdated - leftUpdated;
      })[0];
    const drawing = applyDrawingConfigurationTemplate(baseDrawing, styleTemplate);
    store.addDrawing(drawing);
    setTempDrawingPoints([]);
    setPreviewPoint(null);
    setInteractionMode("selected");
    if (!keepToolActive) setActiveTool(null);
    else setInteractionMode("armed");
  }, [currentTimeframe, keepToolActive, ownerId, selectedSymbol, setActiveTool, store]);

  const getAnchorFromParam = useCallback((param) => {
    if (!param?.point || !chartRef.current || !seriesRef.current) return null;
    let targetPoint = param.point;
    if (param?.sourceEvent?.shiftKey && tempPointsRef.current.length > 0) {
      const originPoint = anchorToPoint({
        anchor: tempPointsRef.current[0],
        chart: chartRef.current,
        series: seriesRef.current,
        data: renderedDataRef.current,
      });
      if (originPoint) targetPoint = constrainPoint(param.point, originPoint);
    }
    const rawAnchor = pointToAnchor({
      point: targetPoint,
      chart: chartRef.current,
      series: seriesRef.current,
      data: renderedDataRef.current,
      knownTime: targetPoint === param.point ? param.time : null,
      knownLogical: targetPoint === param.point ? param.logical : null,
    });
    return applyMagnetToAnchor({
      anchor: rawAnchor,
      point: targetPoint,
      data: renderedDataRef.current,
      series: seriesRef.current,
      mode: magnetMode,
      altKey: Boolean(param?.sourceEvent?.altKey),
    });
  }, [chartRef, magnetMode, renderedDataRef, seriesRef]);

  const handleChartClick = useCallback((param) => {
    const tool = activeToolRef.current;
    if (!tool) {
      storeRef.current.setSelectedDrawingId(null);
      setInteractionMode("idle");
      return;
    }

    const definition = getDrawingDefinition(tool);
    const anchor = getAnchorFromParam(param);
    if (!definition || !anchor) return;

    const updatedPoints = [...tempPointsRef.current, anchor];
    tempPointsRef.current = updatedPoints;
    setTempDrawingPoints(updatedPoints);
    setPreviewPoint(null);
    setInteractionMode("drawing");

    if (Number.isFinite(definition.points) && updatedPoints.length >= definition.points) {
      completeDrawing(tool, updatedPoints.slice(0, definition.points));
      tempPointsRef.current = [];
      return;
    }

    if (
      tool === "polyline" &&
      updatedPoints.length >= definition.minimumPoints &&
      Number(param?.sourceEvent?.detail) >= 2
    ) {
      const withoutDuplicateClick = updatedPoints.slice(0, -1);
      completeDrawing(tool, withoutDuplicateClick.length >= definition.minimumPoints ? withoutDuplicateClick : updatedPoints);
      tempPointsRef.current = [];
    }
  }, [completeDrawing, getAnchorFromParam]);

  const handleCrosshairMove = useCallback((param) => {
    if (!activeToolRef.current || tempPointsRef.current.length === 0 || !param?.point) return;
    latestPreviewParamRef.current = param;
    if (previewFrameRef.current !== null) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      const anchor = getAnchorFromParam(latestPreviewParamRef.current);
      if (anchor) {
        setPreviewPoint(anchor);
        setInteractionMode("previewing");
      }
    });
  }, [getAnchorFromParam]);

  const finishPolyline = useCallback(() => {
    if (activeToolRef.current !== "polyline" || tempPointsRef.current.length < 2) return;
    completeDrawing("polyline", tempPointsRef.current);
    tempPointsRef.current = [];
  }, [completeDrawing]);

  const selectDrawing = useCallback((drawingId) => {
    store.setSelectedDrawingId(drawingId);
    setInteractionMode(drawingId ? "selected" : "idle");
  }, [store]);

  const beginDrag = useCallback((event, drawingId, anchorIndex = null) => {
    const drawing = store.drawingObjects.find((item) => item.id === drawingId);
    if (!drawing || drawing.state?.locked || drawingIsReadOnly(drawing, ownerId)) return;
    const startPoint = clientPointToChartPoint(event, chartContainerRef.current);
    if (!startPoint) return;
    event.preventDefault();
    event.stopPropagation();
    store.setSelectedDrawingId(drawingId);
    store.beginTransaction();
    dragRef.current = {
      drawingId,
      anchorIndex,
      originalDrawing: cloneDrawing(drawing),
      startPoint,
    };
    setInteractionMode(anchorIndex === null ? "dragging-object" : "dragging-anchor");
    chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
  }, [chartContainerRef, chartRef, ownerId, store]);

  const handleDragMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || !chartRef.current || !seriesRef.current) return;
    const currentPoint = clientPointToChartPoint(event, chartContainerRef.current);
    if (!currentPoint) return;
    event.preventDefault();

    if (drag.anchorIndex !== null) {
      let targetPoint = currentPoint;
      if (event.shiftKey && drag.originalDrawing.anchors.length === 2) {
        const otherIndex = drag.anchorIndex === 0 ? 1 : 0;
        const otherPoint = anchorToPoint({
          anchor: drag.originalDrawing.anchors[otherIndex],
          chart: chartRef.current,
          series: seriesRef.current,
          data: renderedDataRef.current,
        });
        if (otherPoint) targetPoint = constrainPoint(currentPoint, otherPoint);
      }
      let nextAnchor = pointToAnchor({
        point: targetPoint,
        chart: chartRef.current,
        series: seriesRef.current,
        data: renderedDataRef.current,
      });
      nextAnchor = applyMagnetToAnchor({
        anchor: nextAnchor,
        point: targetPoint,
        data: renderedDataRef.current,
        series: seriesRef.current,
        mode: magnetMode,
        altKey: event.altKey,
      });
      if (!nextAnchor) return;
      if (drag.originalDrawing.type === "horizontalLine") {
        nextAnchor = {
          ...nextAnchor,
          time: drag.originalDrawing.anchors[drag.anchorIndex].time,
          logical: drag.originalDrawing.anchors[drag.anchorIndex].logical,
          candleIndex: drag.originalDrawing.anchors[drag.anchorIndex].candleIndex,
        };
      } else if (drag.originalDrawing.type === "verticalLine") {
        nextAnchor = {
          ...nextAnchor,
          price: drag.originalDrawing.anchors[drag.anchorIndex].price,
        };
      }
      store.updateDrawingTransient(drag.drawingId, (drawing) => ({
        ...drawing,
        anchors: drawing.anchors.map((anchor, index) => index === drag.anchorIndex ? nextAnchor : anchor),
      }));
      return;
    }

    const delta = {
      x: currentPoint.x - drag.startPoint.x,
      y: currentPoint.y - drag.startPoint.y,
    };
    const anchors = drag.originalDrawing.anchors.map((anchor) => {
      const originalPoint = anchorToPoint({
        anchor,
        chart: chartRef.current,
        series: seriesRef.current,
        data: renderedDataRef.current,
      });
      if (!originalPoint) return anchor;
      const nextAnchor = pointToAnchor({
        point: { x: originalPoint.x + delta.x, y: originalPoint.y + delta.y },
        chart: chartRef.current,
        series: seriesRef.current,
        data: renderedDataRef.current,
      }) || anchor;
      if (drag.originalDrawing.type === "horizontalLine") {
        return { ...nextAnchor, time: anchor.time, logical: anchor.logical, candleIndex: anchor.candleIndex };
      }
      if (drag.originalDrawing.type === "verticalLine") {
        return { ...nextAnchor, price: anchor.price };
      }
      return nextAnchor;
    });
    store.updateDrawingTransient(drag.drawingId, (drawing) => ({ ...drawing, anchors }));
  }, [chartContainerRef, chartRef, magnetMode, renderedDataRef, seriesRef, store]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    store.commitTransaction();
    setInteractionMode("selected");
    chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
  }, [chartRef, store]);

  useEffect(() => {
    window.addEventListener("pointermove", handleDragMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", endDrag);
    };
  }, [endDrag, handleDragMove]);

  useEffect(() => {
    const host = chartContainerRef.current;
    if (!host) return undefined;
    const handleContextMenu = (event) => {
      if (tempPointsRef.current.length === 0) return;
      event.preventDefault();
      cancelCurrentDrawing();
    };
    host.addEventListener("contextmenu", handleContextMenu);
    return () => host.removeEventListener("contextmenu", handleContextMenu);
  }, [cancelCurrentDrawing, chartContainerRef]);

  useEffect(() => {
    if (!chartRef.current || dragRef.current) return;
    chartRef.current.applyOptions({ handleScroll: tempDrawingPoints.length === 0 });
    return () => {
      if (!dragRef.current) chartRef.current?.applyOptions({ handleScroll: true });
    };
  }, [chartRef, tempDrawingPoints.length]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;
      const controlKey = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        if (dragRef.current) {
          dragRef.current = null;
          storeRef.current.cancelTransaction();
          chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
          setInteractionMode("selected");
        } else if (activeToolRef.current || tempPointsRef.current.length) {
          cancelCurrentDrawing();
        } else {
          storeRef.current.setSelectedDrawingId(null);
          setInteractionMode("idle");
        }
        return;
      }

      if (event.key === "Enter") {
        finishPolyline();
        return;
      }

      if (event.key === "Backspace" && activeToolRef.current === "polyline" && tempPointsRef.current.length) {
        event.preventDefault();
        setTempDrawingPoints((points) => points.slice(0, -1));
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && storeRef.current.selectedDrawingId) {
        event.preventDefault();
        storeRef.current.removeDrawing(storeRef.current.selectedDrawingId);
        return;
      }

      if (controlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) storeRef.current.redo();
        else storeRef.current.undo();
      } else if (controlKey && event.key.toLowerCase() === "c" && storeRef.current.selectedDrawingId) {
        event.preventDefault();
        storeRef.current.copyDrawingStyle(storeRef.current.selectedDrawingId);
      } else if (controlKey && event.key.toLowerCase() === "v" && storeRef.current.selectedDrawingId && storeRef.current.hasCopiedStyle) {
        event.preventDefault();
        storeRef.current.pasteDrawingStyle(storeRef.current.selectedDrawingId);
      } else if (controlKey && event.key.toLowerCase() === "d" && storeRef.current.selectedDrawingId) {
        event.preventDefault();
        storeRef.current.duplicateDrawing(storeRef.current.selectedDrawingId);
      } else if (controlKey && event.key.toLowerCase() === "l" && storeRef.current.selectedDrawing) {
        event.preventDefault();
        const selected = storeRef.current.selectedDrawing;
        storeRef.current.updateDrawing(selected.id, {
          state: { ...selected.state, locked: !selected.state.locked },
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelCurrentDrawing, chartRef, finishPolyline]);

  useEffect(() => {
    cancelCurrentDrawing();
  }, [currentTimeframe, selectedSymbol]);

  useEffect(() => {
    const selected = storeRef.current.selectedDrawing;
    if (selected && !drawingIsVisibleInTimeframe(selected, currentTimeframe)) {
      storeRef.current.setSelectedDrawingId(null);
    }
  }, [currentTimeframe]);

  useEffect(() => () => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
  }, []);

  const visibleDrawings = useMemo(
    () => store.drawingObjects
      .filter((drawing) => drawing.state?.hidden !== true && drawingIsVisibleInTimeframe(drawing, currentTimeframe))
      .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0)),
    [currentTimeframe, store.drawingObjects]
  );

  const previewDrawing = useMemo(() => {
    if (!activeTool || tempDrawingPoints.length === 0 || !previewPoint) return null;
    return createDrawing({
      type: activeTool,
      anchors: [...tempDrawingPoints, previewPoint],
      symbol: selectedSymbol,
      timeframe: currentTimeframe,
      ownerId,
    });
  }, [activeTool, currentTimeframe, ownerId, previewPoint, selectedSymbol, tempDrawingPoints]);

  return {
    ...store,
    beginDrag,
    cancelCurrentDrawing,
    clearDrawingObjects: store.clearDrawingObjects,
    finishPolyline,
    handleChartClick,
    handleCrosshairMove,
    hasDrawings: store.drawingObjects.length > 0 || tempDrawingPoints.length > 0,
    interactionMode,
    previewDrawing,
    selectDrawing,
    tempDrawingPoints,
    visibleDrawings,
  };
}
