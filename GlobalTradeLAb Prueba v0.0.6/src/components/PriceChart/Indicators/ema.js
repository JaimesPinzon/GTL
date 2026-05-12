export function calculateEMA(data, period) {
  if (!Array.isArray(data) || data.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const emaValues = [];

  let ema = data.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  emaValues.push(ema);

  for (let index = period; index < data.length; index += 1) {
    ema = (data[index] - ema) * multiplier + ema;
    emaValues.push(ema);
  }

  return emaValues;
}

export function buildEmaSeriesData({ emaPeriod, processedData }) {
  if (!Array.isArray(processedData) || processedData.length < emaPeriod) {
    return [];
  }

  return calculateEMA(
    processedData.map((item) => item.close),
    emaPeriod
  ).map((value, index) => ({
    time: processedData[index + emaPeriod - 1].time,
    value,
  }));
}

export function getEmaSeriesOptions(lineColor) {
  return {
    color: lineColor ?? "rgba(255, 165, 0, 0.8)",
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };
}
