export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const pointAt = (start, direction, factor) => ({
  x: start.x + direction.x * factor,
  y: start.y + direction.y * factor,
});

const boundaryFactors = (start, direction, width, height) => {
  const factors = [];
  if (direction.x !== 0) {
    factors.push((0 - start.x) / direction.x, (width - start.x) / direction.x);
  }
  if (direction.y !== 0) {
    factors.push((0 - start.y) / direction.y, (height - start.y) / direction.y);
  }

  return factors.filter((factor) => {
    const point = pointAt(start, direction, factor);
    return point.x >= -0.5 && point.x <= width + 0.5 && point.y >= -0.5 && point.y <= height + 0.5;
  });
};

export const extendLineToViewport = (start, end, width, height, mode = "infinite") => {
  const direction = { x: end.x - start.x, y: end.y - start.y };
  if (Math.abs(direction.x) < 0.001 && Math.abs(direction.y) < 0.001) return [start, end];
  const factors = boundaryFactors(start, direction, width, height).sort((left, right) => left - right);
  if (factors.length < 2) return [start, end];

  if (mode === "ray") {
    const forward = factors.filter((factor) => factor >= 0);
    return [start, pointAt(start, direction, forward[forward.length - 1] ?? 1)];
  }

  return [pointAt(start, direction, factors[0]), pointAt(start, direction, factors[factors.length - 1])];
};

export const getParallelChannelPoints = ([start, end, widthPoint]) => {
  if (!start || !end || !widthPoint) return null;
  const direction = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = direction.x ** 2 + direction.y ** 2;
  if (lengthSquared < 0.001) return null;
  const relative = { x: widthPoint.x - start.x, y: widthPoint.y - start.y };
  const projection = (relative.x * direction.x + relative.y * direction.y) / lengthSquared;
  const projected = pointAt(start, direction, projection);
  const offset = { x: widthPoint.x - projected.x, y: widthPoint.y - projected.y };
  return [
    start,
    end,
    { x: end.x + offset.x, y: end.y + offset.y },
    { x: start.x + offset.x, y: start.y + offset.y },
  ];
};

export const getDashArray = (lineStyle) => {
  if (lineStyle === "dashed") return "8 6";
  if (lineStyle === "dotted") return "2 5";
  return undefined;
};

export const pointsToPath = (points, close = false) => {
  if (!points?.length) return "";
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return close ? `${path} Z` : path;
};

export const calculateMeasurement = (drawing, data = []) => {
  const [start, end] = drawing?.anchors || [];
  if (!start || !end) return null;
  const priceDifference = Number(end.price) - Number(start.price);
  const percentage = Number(start.price) !== 0 ? (priceDifference / Number(start.price)) * 100 : 0;
  const startTime = Number(start.time);
  const endTime = Number(end.time);
  const from = Math.min(startTime, endTime);
  const to = Math.max(startTime, endTime);
  const candles = data.filter((candle) => Number(candle.time) >= from && Number(candle.time) <= to);

  return {
    priceDifference,
    percentage,
    elapsedSeconds: Math.abs(endTime - startTime),
    candleCount: candles.length,
    high: candles.length ? Math.max(...candles.map((candle) => Number(candle.high))) : null,
    low: candles.length ? Math.min(...candles.map((candle) => Number(candle.low))) : null,
    volume: candles.some((candle) => Number.isFinite(Number(candle.volume)))
      ? candles.reduce((total, candle) => total + (Number(candle.volume) || 0), 0)
      : null,
  };
};

