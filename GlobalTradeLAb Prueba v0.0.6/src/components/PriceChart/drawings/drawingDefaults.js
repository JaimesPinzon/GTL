const DEFAULT_FIBONACCI_LEVELS = [
  { value: 0, visible: true, color: "#787b86" },
  { value: 0.236, visible: true, color: "#ab47bc" },
  { value: 0.382, visible: true, color: "#ff9800" },
  { value: 0.5, visible: true, color: "#2196f3" },
  { value: 0.618, visible: true, color: "#4caf50" },
  { value: 0.786, visible: true, color: "#ef5350" },
  { value: 1, visible: true, color: "#787b86" },
];

const DEFAULT_FIBONACCI_EXTENSION_LEVELS = [
  { value: 0, visible: true, color: "#787b86" },
  { value: 0.618, visible: true, color: "#ab47bc" },
  { value: 1, visible: true, color: "#2196f3" },
  { value: 1.272, visible: true, color: "#ff9800" },
  { value: 1.618, visible: true, color: "#4caf50" },
  { value: 2, visible: true, color: "#ef5350" },
  { value: 2.618, visible: true, color: "#787b86" },
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

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value == null ? fallback : Boolean(value);
};

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
      ["fibonacciRetracement", "fibonacciExtension"].includes(type)
        ? {
            reverse: false,
            extendLeft: false,
            extendRight: false,
            extensionConfigured: true,
            labelMode: "ratio-and-price",
            levels: (type === "fibonacciExtension"
              ? DEFAULT_FIBONACCI_EXTENSION_LEVELS
              : DEFAULT_FIBONACCI_LEVELS
            ).map((level) => ({ ...level })),
          }
        : null,

    position: ["longPosition", "shortPosition"].includes(type)
      ? { capital: 10000, accountRiskPercent: 1 }
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
    education: {
      explanation: "",
      showExplanation: true,
      activityId: null,
      historicalEventId: null,
      isTemplate: false,
      readOnly: false,
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
      ["fibonacciRetracement", "fibonacciExtension"].includes(normalizedType)
        ? {
            ...base.fibonacci,
            ...(drawing?.fibonacci || {}),
            extendLeft: drawing?.fibonacci?.extensionConfigured
              ? toBoolean(drawing.fibonacci.extendLeft)
              : false,
            extendRight: drawing?.fibonacci?.extensionConfigured
              ? toBoolean(drawing.fibonacci.extendRight)
              : false,
            extensionConfigured: true,
            levels: Array.isArray(drawing?.fibonacci?.levels)
              ? drawing.fibonacci.levels.map((level) => ({ ...level }))
              : base.fibonacci.levels,
          }
        : drawing?.fibonacci ?? null,
    position: ["longPosition", "shortPosition"].includes(normalizedType)
      ? { ...base.position, ...(drawing?.position || {}) }
      : drawing?.position ?? null,
    state: {
      ...base.state,
      ...(drawing?.state || {}),
      locked: toBoolean(drawing?.state?.locked ?? drawing?.is_locked, false),
      hidden: toBoolean(drawing?.state?.hidden ?? drawing?.is_hidden, false),
      selected: false,
    },
    ownership: {
      ...base.ownership,
      ...(drawing?.ownership || {}),
    },
    education: {
      ...base.education,
      ...(drawing?.education || {}),
      explanation: typeof drawing?.education?.explanation === "string"
        ? drawing.education.explanation.slice(0, 2000)
        : "",
      showExplanation: toBoolean(drawing?.education?.showExplanation, true),
      isTemplate: toBoolean(drawing?.education?.isTemplate, false),
      readOnly: toBoolean(drawing?.education?.readOnly, false),
    },
    version: Number.isFinite(Number(drawing?.version)) ? Number(drawing.version) : 1,
  };
};

export const cloneDrawing = (drawing) => JSON.parse(JSON.stringify(drawing));

export const cloneDrawings = (drawings) => drawings.map(cloneDrawing);

export const drawingIsReadOnly = (drawing, ownerId = null) => Boolean(
  drawing?.education?.readOnly || (
    drawing?.ownership?.ownerId && ownerId && drawing.ownership.ownerId !== ownerId
  )
);

export const applyDrawingConfigurationTemplate = (drawing, template) => {
  if (!drawing || !template || drawing.type !== template.type) return drawing;
  return {
    ...drawing,
    style: { ...drawing.style, ...cloneDrawing(template.style || {}) },
    fibonacci: drawing.fibonacci && template.fibonacci
      ? {
          ...drawing.fibonacci,
          ...cloneDrawing(template.fibonacci),
          extensionConfigured: true,
        }
      : drawing.fibonacci,
    position: drawing.position && template.position
      ? { ...drawing.position, ...cloneDrawing(template.position) }
      : drawing.position,
  };
};
