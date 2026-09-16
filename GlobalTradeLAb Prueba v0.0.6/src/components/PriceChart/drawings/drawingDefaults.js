const DEFAULT_FIBONACCI_LEVELS = [
  { value: 0, visible: true, color: "#787b86" },
  { value: 0.236, visible: true, color: "#ab47bc" },
  { value: 0.382, visible: true, color: "#ff9800" },
  { value: 0.5, visible: true, color: "#2196f3" },
  { value: 0.618, visible: true, color: "#4caf50" },
  { value: 0.786, visible: true, color: "#ef5350" },
  { value: 1, visible: true, color: "#787b86" },
];

export const DEFAULT_DRAWING_STYLE = Object.freeze({
  color: "#2962ff",
  width: 2,
  lineStyle: "solid",
  opacity: 1,
  fillColor: "#2962ff",
  fillOpacity: 0.12,
  showLabels: true,
});

const toFiniteNumber = (value) =>
  value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))
    ? Number(value)
    : null;

export const createDrawingId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `drawing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeAnchor = (anchor = {}) => ({
  time: toFiniteNumber(anchor.time),
  price: toFiniteNumber(anchor.price),
  logical: toFiniteNumber(anchor.logical ?? anchor.candleIndex),
  candleIndex: toFiniteNumber(anchor.candleIndex ?? anchor.logical),
  snapSource: anchor.snapSource ?? null,
});

export const createDrawing = ({
  type,
  anchors,
  symbol,
  timeframe,
  ownerId = null,
  zIndex = 1,
  name = "",
}) => {
  const now = new Date().toISOString();

  return {
    id: createDrawingId(),
    type,
    name,
    symbol,
    marketId: symbol,
    timeframeScope: {
      mode: "all",
      timeframe: timeframe ?? null,
    },
    anchors: anchors.map(normalizeAnchor),
    style: { ...DEFAULT_DRAWING_STYLE },
    fibonacci:
      type === "fibonacciRetracement"
        ? {
            reverse: false,
            extendLeft: false,
            extendRight: true,
            labelMode: "ratio-and-price",
            levels: DEFAULT_FIBONACCI_LEVELS.map((level) => ({ ...level })),
          }
        : null,
    state: {
      locked: false,
      hidden: false,
      selected: false,
    },
    ownership: {
      ownerId,
      visibility: "private",
      classId: null,
    },
    zIndex,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
};

export const normalizeDrawing = (drawing, fallback = {}) => {
  const legacyAnchors = Array.isArray(drawing?.points) ? drawing.points : [];
  const anchors = Array.isArray(drawing?.anchors) ? drawing.anchors : legacyAnchors;
  const normalizedType = drawing?.type === "fibonacci" ? "fibonacciRetracement" : drawing?.type;
  const base = createDrawing({
    type: normalizedType || "trendline",
    anchors,
    symbol: drawing?.symbol || fallback.symbol || "",
    timeframe: drawing?.timeframeScope?.timeframe || fallback.timeframe || null,
    ownerId: drawing?.ownership?.ownerId || fallback.ownerId || null,
    zIndex: Number.isFinite(Number(drawing?.zIndex)) ? Number(drawing.zIndex) : 1,
    name: drawing?.name || "",
  });

  return {
    ...base,
    ...drawing,
    id: drawing?.id || base.id,
    type: normalizedType || base.type,
    name: drawing?.name || "",
    symbol: drawing?.symbol || fallback.symbol || "",
    marketId: drawing?.marketId || drawing?.symbol || fallback.symbol || "",
    timeframeScope: {
      ...base.timeframeScope,
      ...(drawing?.timeframeScope || {}),
    },
    anchors: anchors.map(normalizeAnchor).filter(
      (anchor) => Number.isFinite(anchor.price) && (Number.isFinite(anchor.time) || Number.isFinite(anchor.logical))
    ),
    style: {
      ...DEFAULT_DRAWING_STYLE,
      ...(drawing?.style || drawing?.properties?.style || {}),
    },
    fibonacci:
      normalizedType === "fibonacciRetracement"
        ? {
            ...base.fibonacci,
            ...(drawing?.fibonacci || {}),
            levels: Array.isArray(drawing?.fibonacci?.levels)
              ? drawing.fibonacci.levels.map((level) => ({ ...level }))
              : base.fibonacci.levels,
          }
        : drawing?.fibonacci ?? null,
    state: {
      ...base.state,
      ...(drawing?.state || {}),
      selected: false,
    },
    ownership: {
      ...base.ownership,
      ...(drawing?.ownership || {}),
    },
    version: Number.isFinite(Number(drawing?.version)) ? Number(drawing.version) : 1,
  };
};

export const cloneDrawing = (drawing) => JSON.parse(JSON.stringify(drawing));

export const cloneDrawings = (drawings) => drawings.map(cloneDrawing);
