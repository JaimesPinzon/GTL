const getAnchorTime = (anchor) => {
  const numericTime = Number(anchor?.time);
  return Number.isFinite(numericTime) ? numericTime : null;
};

const findLogicalForTime = (data, time) => {
  if (!Array.isArray(data) || data.length === 0 || !Number.isFinite(time)) {
    return null;
  }

  if (data.length === 1) {
    return 0;
  }

  let low = 0;
  let high = data.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const middleTime = Number(data[middle]?.time);
    if (middleTime === time) return middle;
    if (middleTime < time) low = middle + 1;
    else high = middle - 1;
  }

  const rightIndex = Math.min(data.length - 1, Math.max(1, low));
  const leftIndex = rightIndex - 1;
  const leftTime = Number(data[leftIndex]?.time);
  const rightTime = Number(data[rightIndex]?.time);
  const interval = rightTime - leftTime;

  if (!Number.isFinite(interval) || interval === 0) {
    return Math.abs(time - leftTime) <= Math.abs(time - rightTime) ? leftIndex : rightIndex;
  }

  if (time < Number(data[0]?.time)) {
    const firstInterval = Number(data[1]?.time) - Number(data[0]?.time);
    return firstInterval > 0 ? (time - Number(data[0]?.time)) / firstInterval : 0;
  }

  if (time > Number(data[data.length - 1]?.time)) {
    const lastInterval = Number(data[data.length - 1]?.time) - Number(data[data.length - 2]?.time);
    return lastInterval > 0
      ? data.length - 1 + (time - Number(data[data.length - 1]?.time)) / lastInterval
      : data.length - 1;
  }

  return leftIndex + (time - leftTime) / interval;
};

const timeForLogical = (data, logical) => {
  if (!Array.isArray(data) || data.length === 0 || !Number.isFinite(logical)) {
    return null;
  }

  if (data.length === 1) return Number(data[0]?.time) || null;
  const leftIndex = Math.floor(logical);
  const rightIndex = Math.ceil(logical);

  if (leftIndex >= 0 && rightIndex < data.length) {
    const leftTime = Number(data[leftIndex]?.time);
    const rightTime = Number(data[rightIndex]?.time);
    return Math.round(leftTime + (rightTime - leftTime) * (logical - leftIndex));
  }

  if (logical < 0) {
    const interval = Number(data[1]?.time) - Number(data[0]?.time);
    return Math.round(Number(data[0]?.time) + logical * interval);
  }

  const lastIndex = data.length - 1;
  const interval = Number(data[lastIndex]?.time) - Number(data[lastIndex - 1]?.time);
  return Math.round(Number(data[lastIndex]?.time) + (logical - lastIndex) * interval);
};

export const anchorToPoint = ({ anchor, chart, series, data }) => {
  if (!anchor || !chart || !series) return null;

  const time = getAnchorTime(anchor);
  let x = time !== null ? chart.timeScale().timeToCoordinate(time) : null;

  if (x === null) {
    const logicalFromTime = findLogicalForTime(data, time);
    const logical = Number.isFinite(logicalFromTime) ? logicalFromTime : Number(anchor.logical);
    x = Number.isFinite(logical) ? chart.timeScale().logicalToCoordinate(logical) : null;
  }

  const y = series.priceToCoordinate(Number(anchor.price));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Number(x), y: Number(y) };
};

export const pointToAnchor = ({ point, chart, series, data, knownTime = null, knownLogical = null }) => {
  if (!point || !chart || !series) return null;
  const price = Number(series.coordinateToPrice(point.y));
  const hasKnownLogical = knownLogical !== null && knownLogical !== undefined && knownLogical !== "";
  const logicalValue = hasKnownLogical && Number.isFinite(Number(knownLogical))
    ? Number(knownLogical)
    : Number(chart.timeScale().coordinateToLogical(point.x));
  const coordinateTime = knownTime ?? chart.timeScale().coordinateToTime(point.x);
  const numericCoordinateTime = Number(coordinateTime);
  const time = Number.isFinite(numericCoordinateTime)
    ? numericCoordinateTime
    : timeForLogical(data, logicalValue);

  if (!Number.isFinite(price) || !Number.isFinite(time)) return null;

  return {
    time,
    price,
    logical: Number.isFinite(logicalValue) ? logicalValue : findLogicalForTime(data, time),
    candleIndex: Number.isFinite(logicalValue) ? Math.round(logicalValue) : null,
    snapSource: null,
  };
};

const OHLC_SOURCES = ["open", "high", "low", "close"];

export const applyMagnetToAnchor = ({ anchor, point, data, series, mode = "off", altKey = false }) => {
  if (!anchor || altKey || mode === "off" || !Array.isArray(data) || data.length === 0) {
    return anchor;
  }

  const logical = Number.isFinite(anchor.logical) ? anchor.logical : findLogicalForTime(data, anchor.time);
  const index = Math.min(data.length - 1, Math.max(0, Math.round(logical)));
  const candle = data[index];
  if (!candle) return anchor;

  let closest = null;
  OHLC_SOURCES.forEach((source) => {
    const price = Number(candle[source]);
    const y = Number(series.priceToCoordinate(price));
    if (!Number.isFinite(price) || !Number.isFinite(y)) return;
    const distance = Math.abs(y - point.y);
    if (!closest || distance < closest.distance) closest = { source, price, distance };
  });

  if (!closest || (mode === "weak" && closest.distance > 10)) return anchor;

  return {
    ...anchor,
    time: Number(candle.time),
    price: closest.price,
    logical: index,
    candleIndex: index,
    snapSource: closest.source,
  };
};

export const clientPointToChartPoint = (event, container) => {
  const bounds = container?.getBoundingClientRect?.();
  if (!bounds) return null;
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
};
