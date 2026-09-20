import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_INDICATOR_PANE_HEIGHT = 132;
export const MIN_INDICATOR_PANE_HEIGHT = 96;
export const MAX_INDICATOR_PANE_HEIGHT = 360;

const MIN_MAIN_CHART_HEIGHT = 160;
const RESIZE_STEP = 12;

export function clampIndicatorPaneHeight(height, containerHeight = Number.POSITIVE_INFINITY) {
  const numericHeight = Number(height);
  const safeHeight = Number.isFinite(numericHeight) ? numericHeight : DEFAULT_INDICATOR_PANE_HEIGHT;
  const availableHeight = Number.isFinite(containerHeight)
    ? Math.max(MIN_INDICATOR_PANE_HEIGHT, containerHeight - MIN_MAIN_CHART_HEIGHT)
    : MAX_INDICATOR_PANE_HEIGHT;
  const maximumHeight = Math.min(MAX_INDICATOR_PANE_HEIGHT, availableHeight);

  return Math.round(Math.min(maximumHeight, Math.max(MIN_INDICATOR_PANE_HEIGHT, safeHeight)));
}

export function useResizableIndicatorPane({ containerRef, storageKey }) {
  const [height, setHeight] = useState(DEFAULT_INDICATOR_PANE_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const dragStateRef = useRef(null);
  const heightRef = useRef(DEFAULT_INDICATOR_PANE_HEIGHT);
  const previousBodyStylesRef = useRef(null);

  const applyHeight = useCallback((nextHeight) => {
    const containerHeight = containerRef.current?.clientHeight;
    const clampedHeight = clampIndicatorPaneHeight(nextHeight, containerHeight);
    heightRef.current = clampedHeight;
    setHeight(clampedHeight);
    return clampedHeight;
  }, [containerRef]);

  const persistHeight = useCallback((nextHeight) => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(storageKey, String(nextHeight));
    } catch {
      // The resize remains functional when browser storage is unavailable.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const storedHeight = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(storedHeight) && storedHeight > 0) applyHeight(storedHeight);
    } catch {
      // Use the default height when browser storage is unavailable.
    }
  }, [applyHeight, storageKey]);

  const restoreDocumentInteraction = useCallback(() => {
    if (!previousBodyStylesRef.current || typeof document === "undefined") return;

    document.body.style.cursor = previousBodyStylesRef.current.cursor;
    document.body.style.userSelect = previousBodyStylesRef.current.userSelect;
    previousBodyStylesRef.current = null;
  }, []);

  useEffect(() => () => restoreDocumentInteraction(), [restoreDocumentInteraction]);

  const finishResize = useCallback((event) => {
    const dragState = dragStateRef.current;
    if (!dragState || (event?.pointerId != null && dragState.pointerId !== event.pointerId)) return;

    dragStateRef.current = null;
    setIsResizing(false);
    restoreDocumentInteraction();
    persistHeight(heightRef.current);
  }, [persistHeight, restoreDocumentInteraction]);

  const handlePointerDown = useCallback((event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startHeight: heightRef.current,
      startY: event.clientY,
    };
    setIsResizing(true);

    if (typeof document !== "undefined") {
      previousBodyStylesRef.current = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }
  }, []);

  const handlePointerMove = useCallback((event) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    applyHeight(dragState.startHeight + dragState.startY - event.clientY);
  }, [applyHeight]);

  const resetHeight = useCallback(() => {
    const nextHeight = applyHeight(DEFAULT_INDICATOR_PANE_HEIGHT);
    persistHeight(nextHeight);
  }, [applyHeight, persistHeight]);

  const handleKeyDown = useCallback((event) => {
    let nextHeight = heightRef.current;

    if (event.key === "ArrowUp") nextHeight += RESIZE_STEP;
    else if (event.key === "ArrowDown") nextHeight -= RESIZE_STEP;
    else if (event.key === "Home") nextHeight = MIN_INDICATOR_PANE_HEIGHT;
    else if (event.key === "End") nextHeight = MAX_INDICATOR_PANE_HEIGHT;
    else return;

    event.preventDefault();
    const clampedHeight = applyHeight(nextHeight);
    persistHeight(clampedHeight);
  }, [applyHeight, persistHeight]);

  return {
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: finishResize,
    handlePointerCancel: finishResize,
    height,
    isResizing,
    resetHeight,
  };
}
