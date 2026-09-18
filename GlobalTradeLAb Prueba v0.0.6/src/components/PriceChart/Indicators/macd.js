import { calculateEMA } from "./ema.js";

export function calculateMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(data) || data.length < longPeriod) {
    return { macdLine: [], signalLine: [], histogram: [] };
  }

  const emaShort = calculateEMA(data, shortPeriod);
  const emaLong = calculateEMA(data, longPeriod);
  const offset = longPeriod - shortPeriod;

  const macdLine = emaLong.map((longValue, index) => {
    const shortValue = emaShort[index + offset];
    return shortValue - longValue;
  });

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = signalLine.map((signalValue, index) => macdLine[index + signalPeriod - 1] - signalValue);

  return { macdLine, signalLine, histogram };
}

export function buildMacdSeriesData(processedData, shortPeriod = 12, longPeriod = 26, signalPeriod = 9, style = {}) {
  if (!Array.isArray(processedData) || processedData.length < longPeriod) {
    return null;
  }

  const macdResult = calculateMACD(processedData.map((item) => item.close), shortPeriod, longPeriod, signalPeriod);

  return {
    macdLine: macdResult.macdLine.map((value, index) => ({
      time: processedData[index + longPeriod - 1].time,
      value,
    })),
    signalLine: macdResult.signalLine.map((value, index) => ({
      time: processedData[index + longPeriod + signalPeriod - 2].time,
      value,
    })),
    histogramData: macdResult.histogram.map((value, index) => ({
      time: processedData[index + longPeriod + signalPeriod - 2].time,
      value,
      color: value >= 0 ? (style.positiveColor ?? "rgba(0, 150, 136, 0.5)") : (style.negativeColor ?? "rgba(255, 82, 82, 0.5)"),
    })),
  };
}

export function getMacdLineSeriesOptions(style = {}) {
  return {
    color: style.macdColor ?? "#2962ff",
    lineWidth: style.lineWidth ?? 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };
}

export function getMacdSignalSeriesOptions(style = {}) {
  return {
    color: style.signalColor ?? "#f59e0b",
    lineWidth: style.lineWidth ?? 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };
}

export function getMacdHistogramSeriesOptions() {
  return {
    priceLineVisible: false,
    lastValueVisible: false,
  };
}
