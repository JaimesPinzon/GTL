export const DRAWING_CATEGORIES = [
  {
    id: "lines",
    labelKey: "priceChart.drawings.categories.lines",
    tools: [
      "trendline",
      "ray",
      "infiniteLine",
      "horizontalLine",
      "horizontalRay",
      "verticalLine",
      "arrow",
      "polyline",
      "parallelChannel",
    ],
  },
  {
    id: "shapes",
    labelKey: "priceChart.drawings.categories.shapes",
    tools: ["rectangle", "ellipse", "triangle", "zone"],
  },
  {
    id: "measurements",
    labelKey: "priceChart.drawings.categories.measurements",
    tools: ["priceMeasure", "timeMeasure", "rangeMeasure"],
  },
  {
    id: "fibonacci",
    labelKey: "priceChart.drawings.categories.fibonacci",
    tools: ["fibonacciRetracement"],
  },
];

export const DRAWING_REGISTRY = {
  trendline: { labelKey: "priceChart.drawings.tools.trendline", points: 2 },
  ray: { labelKey: "priceChart.drawings.tools.ray", points: 2 },
  infiniteLine: { labelKey: "priceChart.drawings.tools.infiniteLine", points: 2 },
  horizontalLine: { labelKey: "priceChart.drawings.tools.horizontalLine", points: 1 },
  horizontalRay: { labelKey: "priceChart.drawings.tools.horizontalRay", points: 1 },
  verticalLine: { labelKey: "priceChart.drawings.tools.verticalLine", points: 1 },
  arrow: { labelKey: "priceChart.drawings.tools.arrow", points: 2 },
  polyline: { labelKey: "priceChart.drawings.tools.polyline", points: Infinity, minimumPoints: 2 },
  parallelChannel: { labelKey: "priceChart.drawings.tools.parallelChannel", points: 3 },
  rectangle: { labelKey: "priceChart.drawings.tools.rectangle", points: 2 },
  ellipse: { labelKey: "priceChart.drawings.tools.ellipse", points: 2 },
  triangle: { labelKey: "priceChart.drawings.tools.triangle", points: 3 },
  zone: { labelKey: "priceChart.drawings.tools.zone", points: 2 },
  priceMeasure: { labelKey: "priceChart.drawings.tools.priceMeasure", points: 2 },
  timeMeasure: { labelKey: "priceChart.drawings.tools.timeMeasure", points: 2 },
  rangeMeasure: { labelKey: "priceChart.drawings.tools.rangeMeasure", points: 2 },
  fibonacciRetracement: { labelKey: "priceChart.drawings.tools.fibonacciRetracement", points: 2 },
};

export const getDrawingDefinition = (type) => DRAWING_REGISTRY[type] ?? null;

export const getDrawingLabelKey = (type) =>
  DRAWING_REGISTRY[type]?.labelKey ?? "priceChart.drawings.tools.unknown";

export const drawingIsVisibleInTimeframe = (drawing, timeframe) =>
  drawing?.timeframeScope?.mode !== "single" || drawing?.timeframeScope?.timeframe === timeframe;

