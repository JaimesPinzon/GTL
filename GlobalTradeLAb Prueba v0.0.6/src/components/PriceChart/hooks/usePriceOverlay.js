import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

const PRICE_MARKER_BUTTON_HALF_HEIGHT = 12;
const PRICE_ACTION_MENU_RIGHT_OFFSET = 44;
const PRICE_OVERLAY_CLOSE_DELAY_MS = 140;

const initialOverlayState = {
  mode: "idle",
  hoveredCandle: null,
  hoveredPriceMarker: null,
  lockedPriceMarker: null,
  priceMenuHeight: 320,
};

function overlayReducer(state, action) {
  switch (action.type) {
    case "CHART_HOVER":
      return {
        ...state,
        mode: state.mode === "menu-open" ? state.mode : "hovering-chart",
        hoveredCandle: action.hoveredCandle,
        hoveredPriceMarker: action.hoveredPriceMarker,
        lockedPriceMarker:
          state.mode === "hovering-trigger" || state.mode === "menu-open" || state.mode === "closing-delay"
            ? action.hoveredPriceMarker
            : state.lockedPriceMarker,
      };
    case "ENTER_TRIGGER":
      return {
        ...state,
        mode: state.mode === "menu-open" ? "menu-open" : "hovering-trigger",
        lockedPriceMarker: state.lockedPriceMarker ?? action.marker ?? null,
      };
    case "OPEN_MENU":
      return {
        ...state,
        mode: "menu-open",
        lockedPriceMarker: action.marker ?? state.lockedPriceMarker ?? null,
      };
    case "CLOSE_MENU":
      return {
        ...state,
        mode: "idle",
        lockedPriceMarker: null,
      };
    case "START_CLOSING_DELAY":
      return {
        ...state,
        mode: "closing-delay",
      };
    case "FINISH_CLOSING_DELAY":
      return {
        ...state,
        mode: state.hoveredPriceMarker ? "hovering-chart" : "idle",
        lockedPriceMarker: null,
      };
    case "CLEAR_OVERLAY":
      return {
        ...state,
        mode: "idle",
        hoveredCandle: null,
        hoveredPriceMarker: null,
        lockedPriceMarker: null,
      };
    case "SET_MENU_HEIGHT":
      if (!action.height || action.height === state.priceMenuHeight) {
        return state;
      }
      return {
        ...state,
        priceMenuHeight: action.height,
      };
    default:
      return state;
  }
}

export function usePriceOverlay({
  chartContainerRef,
  renderedDataRef,
  seriesRef,
}) {
  const crosshairRafRef = useRef(null);
  const priceMenuCloseTimeoutRef = useRef(null);
  const priceTriggerRef = useRef(null);
  const priceMenuRef = useRef(null);
  const lastPriceMarkerRef = useRef(null);
  const overlayStateRef = useRef(initialOverlayState);
  const [state, dispatch] = useReducer(overlayReducer, initialOverlayState);

  useEffect(() => {
    overlayStateRef.current = state;
    if (state.hoveredPriceMarker) {
      lastPriceMarkerRef.current = state.hoveredPriceMarker;
    }
  }, [state]);

  const clearCloseTimeout = useCallback(() => {
    if (priceMenuCloseTimeoutRef.current) {
      clearTimeout(priceMenuCloseTimeoutRef.current);
      priceMenuCloseTimeoutRef.current = null;
    }
  }, []);

  const clearPriceOverlay = useCallback(() => {
    clearCloseTimeout();
    dispatch({ type: "CLEAR_OVERLAY" });
  }, [clearCloseTimeout]);

  const buildHoveredCandle = useCallback((logicalIndex) => {
    const renderedData = renderedDataRef.current;
    const nearestPoint =
      logicalIndex !== null && logicalIndex >= 0 && logicalIndex < renderedData.length
        ? renderedData[logicalIndex]
        : renderedData[renderedData.length - 1] ?? null;
    const previousPoint =
      logicalIndex !== null && logicalIndex > 0 && logicalIndex - 1 < renderedData.length
        ? renderedData[logicalIndex - 1]
        : null;

    if (!nearestPoint) {
      return null;
    }

    return {
      open: nearestPoint.open ?? nearestPoint.value ?? 0,
      high: nearestPoint.high ?? nearestPoint.value ?? 0,
      low: nearestPoint.low ?? nearestPoint.value ?? 0,
      close: nearestPoint.close ?? nearestPoint.value ?? 0,
      prevClose:
        previousPoint?.close ??
        previousPoint?.value ??
        nearestPoint.open ??
        nearestPoint.value ??
        0,
    };
  }, [renderedDataRef]);

  const updatePriceMarker = useCallback(({ x, y, logicalIndex = null }) => {
    if (!seriesRef.current) {
      return;
    }

    const price = seriesRef.current.coordinateToPrice(y);
    if (price == null) {
      return;
    }

    const nextMarker = { x, y, price };
    lastPriceMarkerRef.current = nextMarker;

    dispatch({
      type: "CHART_HOVER",
      hoveredPriceMarker: nextMarker,
      hoveredCandle: buildHoveredCandle(logicalIndex),
    });
  }, [buildHoveredCandle, seriesRef]);

  const handlePriceOverlayEnter = useCallback(() => {
    clearCloseTimeout();
    const marker =
      overlayStateRef.current.hoveredPriceMarker ??
      overlayStateRef.current.lockedPriceMarker ??
      lastPriceMarkerRef.current ??
      null;

    if (marker) {
      lastPriceMarkerRef.current = marker;
    }

    dispatch({ type: "ENTER_TRIGGER", marker });
  }, [clearCloseTimeout]);

  const handlePriceOverlayLeave = useCallback(() => {
    clearCloseTimeout();
    dispatch({ type: "START_CLOSING_DELAY" });

    priceMenuCloseTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "FINISH_CLOSING_DELAY" });
      priceMenuCloseTimeoutRef.current = null;
    }, PRICE_OVERLAY_CLOSE_DELAY_MS);
  }, [clearCloseTimeout]);

  const handlePriceMenuToggle = useCallback(() => {
    clearCloseTimeout();
    const currentState = overlayStateRef.current;

    if (currentState.mode === "menu-open") {
      dispatch({ type: "CLOSE_MENU" });
      return;
    }

    dispatch({
      type: "OPEN_MENU",
      marker: currentState.hoveredPriceMarker ?? lastPriceMarkerRef.current ?? null,
    });
  }, [clearCloseTimeout]);

  const handlePointerMoveOverChartArea = useCallback((event) => {
    const currentMode = overlayStateRef.current.mode;

    if (
      currentMode !== "hovering-trigger" &&
      currentMode !== "menu-open" &&
      currentMode !== "closing-delay"
    ) {
      return;
    }

    if (!chartContainerRef.current || !seriesRef.current) {
      return;
    }

    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return;
    }

    const logicalIndex =
      renderedDataRef.current.length > 0
        ? Math.max(0, Math.min(renderedDataRef.current.length - 1, Math.round(x)))
        : null;

    updatePriceMarker({ x, y, logicalIndex });
  }, [chartContainerRef, renderedDataRef, updatePriceMarker]);

  const handleCrosshairMove = useCallback((param) => {
    if (crosshairRafRef.current) {
      cancelAnimationFrame(crosshairRafRef.current);
    }

    crosshairRafRef.current = requestAnimationFrame(() => {
      crosshairRafRef.current = null;
      const currentState = overlayStateRef.current;

      if (currentState.mode === "hovering-trigger" || currentState.mode === "menu-open" || currentState.mode === "closing-delay") {
        return;
      }

      if (!param?.point || !chartContainerRef.current || !seriesRef.current) {
        clearPriceOverlay();
        return;
      }

      const { x, y } = param.point;
      const containerWidth = chartContainerRef.current.clientWidth;
      const containerHeight = chartContainerRef.current.clientHeight;

      if (x < 0 || y < 0 || x > containerWidth || y > containerHeight) {
        clearPriceOverlay();
        return;
      }

      const logicalIndex = typeof param.logical === "number" ? Math.round(param.logical) : null;
      updatePriceMarker({ x, y, logicalIndex });
    });
  }, [chartContainerRef, clearPriceOverlay, seriesRef, updatePriceMarker]);

  useEffect(() => () => {
    if (crosshairRafRef.current) {
      cancelAnimationFrame(crosshairRafRef.current);
      crosshairRafRef.current = null;
    }

    if (priceMenuCloseTimeoutRef.current) {
      clearTimeout(priceMenuCloseTimeoutRef.current);
      priceMenuCloseTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (state.mode !== "menu-open") {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;

      if (priceMenuRef.current?.contains(target) || priceTriggerRef.current?.contains(target)) {
        return;
      }

      dispatch({ type: "CLOSE_MENU" });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [state.mode]);

  useEffect(() => {
    if (state.mode !== "menu-open" || !priceMenuRef.current) {
      return;
    }

    const nextHeight = priceMenuRef.current.offsetHeight;
    dispatch({ type: "SET_MENU_HEIGHT", height: nextHeight });
  }, [state.mode, state.priceMenuHeight]);

  const displayPriceMarker = useMemo(() => {
    if (state.hoveredPriceMarker) {
      return state.hoveredPriceMarker;
    }

    if (state.mode === "hovering-trigger" || state.mode === "menu-open" || state.mode === "closing-delay") {
      return state.lockedPriceMarker ?? lastPriceMarkerRef.current ?? null;
    }

    return null;
  }, [state.hoveredPriceMarker, state.lockedPriceMarker, state.mode]);

  const priceMenuTop = useMemo(() => {
    if (!displayPriceMarker) {
      return 8;
    }

    const anchorY = displayPriceMarker.y + PRICE_MARKER_BUTTON_HALF_HEIGHT;
    const preferredTop = anchorY - state.priceMenuHeight / 2;
    const containerHeight = chartContainerRef.current?.clientHeight ?? 0;

    if (containerHeight <= 0) {
      return Math.max(8, preferredTop);
    }

    const minTop = 8;
    const maxTop = Math.max(minTop, containerHeight - state.priceMenuHeight - 8);

    if (preferredTop + state.priceMenuHeight > containerHeight - 8) {
      return Math.max(minTop, anchorY - state.priceMenuHeight);
    }

    return Math.min(Math.max(minTop, preferredTop), maxTop);
  }, [chartContainerRef, displayPriceMarker, state.priceMenuHeight]);

  const isOverPriceUI =
    state.mode === "hovering-trigger" ||
    state.mode === "menu-open" ||
    state.mode === "closing-delay";

  const isPriceMenuOpen = state.mode === "menu-open";

  return {
    clearPriceOverlay,
    displayPriceMarker,
    handleCrosshairMove,
    handlePointerMoveOverChartArea,
    handlePriceMenuToggle,
    handlePriceOverlayEnter,
    handlePriceOverlayLeave,
    hoveredCandle: state.hoveredCandle,
    isOverPriceUI,
    isPriceMenuOpen,
    priceMenuRef,
    priceMenuTop,
    priceTriggerRef,
    priceActionMenuRightOffset: PRICE_ACTION_MENU_RIGHT_OFFSET,
    setIsOverPriceUI: () => {},
    setIsPriceMenuOpen: (isOpen) => dispatch({ type: isOpen ? "OPEN_MENU" : "CLOSE_MENU", marker: lastPriceMarkerRef.current }),
    setLockedPriceMarker: (marker) => dispatch({ type: "ENTER_TRIGGER", marker }),
  };
}
