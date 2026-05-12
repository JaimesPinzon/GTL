import { LineStyle } from 'lightweight-charts';
import { MINUTE_TIMEFRAMES } from "@/lib/market-timeframes";
import { parseTimezoneOffsetMinutes } from "@/lib/timezones";

const defaultAppearance = {
  backgroundColor: 'transparent',
  textColorDark: '#d1d5db',
  textColorLight: '#1f2937',
  gridColorDark: 'rgba(42, 46, 57, 0.6)',
  gridColorLight: 'rgba(229, 231, 235, 0.6)',
  borderColorDark: 'rgba(75, 85, 99, 0.7)',
  borderColorLight: 'rgba(209, 213, 219, 0.7)',
  crosshairDark: '#9ca3af',
  crosshairLight: '#4b5563',
  crosshairLabelDark: '#374151',
  crosshairLabelLight: '#e5e7eb',
};

const getDisplayDateForTimezone = (utcSeconds, timezone) => {
  const normalizedTimezone = typeof timezone === "string" ? timezone.trim() : "";
  const ianaTimeZone =
    normalizedTimezone && normalizedTimezone !== "UTC" && normalizedTimezone.includes("/")
      ? normalizedTimezone
      : null;
  const offsetMinutes = parseTimezoneOffsetMinutes(timezone);

  if (normalizedTimezone === "UTC") {
    return {
      date: new Date(utcSeconds * 1000),
      formatOptions: { timeZone: "UTC" },
    };
  }

  if (ianaTimeZone) {
    return {
      date: new Date(utcSeconds * 1000),
      formatOptions: { timeZone: ianaTimeZone },
    };
  }

  if (offsetMinutes !== null) {
    return {
      date: new Date((utcSeconds + offsetMinutes * 60) * 1000),
      formatOptions: { timeZone: "UTC" },
    };
  }

  return {
    date: new Date(utcSeconds * 1000),
    formatOptions: {},
  };
};

const getTickFormatterOptions = (tickMarkType) => {
  switch (tickMarkType) {
    case "Year":
      return { year: "numeric" };
    case "Month":
      return { month: "short", year: "2-digit" };
    case "DayOfMonth":
      return { day: "2-digit", month: "short" };
    case "TimeWithSeconds":
      return { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
    case "Time":
    default:
      return { hour: "2-digit", minute: "2-digit", hour12: false };
  }
};

const capitalizeToken = (value) =>
  typeof value === "string" && value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;

const formatCrosshairTimeLabel = (utcSeconds, locale, timezone) => {
  const { date, formatOptions } = getDisplayDateForTimezone(utcSeconds, timezone);
  const weekday = new Intl.DateTimeFormat(locale, {
    ...formatOptions,
    weekday: "short",
  }).format(date);

  const day = new Intl.DateTimeFormat(locale, {
    ...formatOptions,
    day: "2-digit",
  }).format(date);

  const month = new Intl.DateTimeFormat(locale, {
    ...formatOptions,
    month: "short",
  }).format(date);

  const year = new Intl.DateTimeFormat(locale, {
    ...formatOptions,
    year: "2-digit",
  }).format(date);

  const time = new Intl.DateTimeFormat(locale, {
    ...formatOptions,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${weekday} ${day} ${capitalizeToken(month)} '${year} ${time}`;
};

export const getChartOptions = (
  theme,
  isFullScreen,
  chartContainerRef,
  isMainChartWithPane = false,
  appearance = {},
  locale = "es-CO",
  timezone = null
) => ({
  layout: {
    background: { color: appearance.backgroundColor ?? defaultAppearance.backgroundColor },
    textColor: appearance.textColor ?? (theme === 'dark' ? defaultAppearance.textColorDark : defaultAppearance.textColorLight),
    attributionLogo: false,
  },
  localization: {
    locale,
    timeFormatter: (time) => {
      const utcSeconds = typeof time === "number" ? time : null;
      if (!Number.isFinite(utcSeconds)) {
        return "";
      }

      return formatCrosshairTimeLabel(utcSeconds, locale, timezone);
    },
  },
  grid: {
    vertLines: { color: appearance.gridColor ?? (theme === 'dark' ? defaultAppearance.gridColorDark : defaultAppearance.gridColorLight) },
    horzLines: { color: appearance.gridColor ?? (theme === 'dark' ? defaultAppearance.gridColorDark : defaultAppearance.gridColorLight) },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 12,
    barSpacing: 8,
    minBarSpacing: 3,
    tickMarkFormatter: (time, tickMarkType) => {
      const utcSeconds = typeof time === "number" ? time : null;
      if (!Number.isFinite(utcSeconds)) {
        return "";
      }

      const { date, formatOptions } = getDisplayDateForTimezone(utcSeconds, timezone);
      return new Intl.DateTimeFormat(locale, {
        ...formatOptions,
        ...getTickFormatterOptions(tickMarkType),
      }).format(date);
    },
    borderColor: theme === 'dark' ? defaultAppearance.borderColorDark : defaultAppearance.borderColorLight,
  },
  rightPriceScale: {
    borderColor: theme === 'dark' ? defaultAppearance.borderColorDark : defaultAppearance.borderColorLight,
  },
  crosshair: {
    mode: 0,
    vertLine: {
        style: LineStyle.Dotted,
        color: theme === 'dark' ? defaultAppearance.crosshairDark : defaultAppearance.crosshairLight,
        labelBackgroundColor: theme === 'dark' ? defaultAppearance.crosshairLabelDark : defaultAppearance.crosshairLabelLight,
    },
    horzLine: {
        style: LineStyle.Dotted,
        color: theme === 'dark' ? defaultAppearance.crosshairDark : defaultAppearance.crosshairLight,
        labelBackgroundColor: theme === 'dark' ? defaultAppearance.crosshairLabelDark : defaultAppearance.crosshairLabelLight,
    },
  },
  width: chartContainerRef.current?.clientWidth || 0,
  height: chartContainerRef.current?.clientHeight || (isFullScreen 
    ? window.innerHeight - (isMainChartWithPane ? 200 : 100) 
    : (isMainChartWithPane ? 300 : 400)),
  handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
  },
  handleScale: {
      axisPressedMouseMove: {
          time: true,
          price: true,
      },
      mouseWheel: true,
      pinch: true,
  },
});

export const focusLatestBars = (chart, dataLength, visibleBars = 120) => {
  if (!chart?.timeScale || dataLength <= 0) {
    return;
  }

  const targetVisibleBars = Math.max(visibleBars, 500);
  const minVisibleBars = Math.min(120, Math.max(40, Math.round(targetVisibleBars * 0.25)));
  const barsToShow = Math.max(minVisibleBars, Math.min(targetVisibleBars, dataLength + 8));
  const rightPadding = Math.max(3, Math.round(barsToShow * 0.08));
  const lastLogicalIndex = dataLength - 1;
  const from = lastLogicalIndex - barsToShow + 1;
  const to = lastLogicalIndex + rightPadding;

  chart.timeScale().setVisibleLogicalRange({ from, to });
};

export const getSeriesOptions = (type, appearance = {}) => {
  const upColor = appearance.bodyEnabled === false ? "transparent" : appearance.upColor ?? "#22c55e";
  const downColor = appearance.bodyEnabled === false ? "transparent" : appearance.downColor ?? "#ef4444";
  const upBorder = appearance.borderEnabled === false ? "transparent" : appearance.upColor ?? "#22c55e";
  const downBorder = appearance.borderEnabled === false ? "transparent" : appearance.downColor ?? "#ef4444";
  const upWick = appearance.wickEnabled === false ? "transparent" : appearance.upColor ?? "#22c55e";
  const downWick = appearance.wickEnabled === false ? "transparent" : appearance.downColor ?? "#ef4444";

  switch (type) {
    case 'line':
      return {
        color: appearance.lineColor ?? '#2962FF',
        lineWidth: 2,
      };
    case 'heikinashi':
      return {
        upColor,
        downColor,
        borderVisible: true,
        wickVisible: true,
        borderDownColor: downBorder,
        borderUpColor: upBorder,
        wickDownColor: downWick,
        wickUpColor: upWick,
      };
    case 'candlestick':
    default:
      return {
        upColor,
        downColor,
        borderDownColor: downBorder,
        borderUpColor: upBorder,
        wickDownColor: downWick,
        wickUpColor: upWick,
      };
  }
};

export const convertToHeikinAshi = (data) => {
  if (!data || data.length === 0) return [];
  const heikinAshiData = [];
  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    let prevOpen, prevClose;
    if (i > 0) {
        prevOpen = heikinAshiData[i-1].open;
        prevClose = heikinAshiData[i-1].close;
    } else {
        prevOpen = current.open;
        prevClose = current.close;
    }
    
    const haClose = (current.open + current.high + current.low + current.close) / 4;
    const haOpen = (prevOpen + prevClose) / 2;
    const haHigh = Math.max(current.high, haOpen, haClose);
    const haLow = Math.min(current.low, haOpen, haClose);

    heikinAshiData.push({
      time: current.time, 
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });
  }
  return heikinAshiData;
};

export const formatPriceDataForChart = (marketSymbolData, chartType) => {
  if (!marketSymbolData || marketSymbolData.length === 0) return [];
  let dataToSet = marketSymbolData.map(item => ({
    time: item.time,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    value: item.close, 
  }));

  if (chartType === 'heikinashi') {
    dataToSet = convertToHeikinAshi(dataToSet);
  } else if (chartType === 'line') {
    dataToSet = dataToSet.map(d => ({ time: d.time, value: d.close }));
  }
  return dataToSet;
};

export const normalizeTimestampToUnixSeconds = (timeValue) => {
  if (timeValue == null) {
    return null;
  }

  if (typeof timeValue === "number" && Number.isFinite(timeValue)) {
    return timeValue > 1e12 ? Math.floor(timeValue / 1000) : Math.floor(timeValue);
  }

  if (typeof timeValue === "string") {
    const trimmedValue = timeValue.trim();
    const numericValue = Number(trimmedValue);

    if (Number.isFinite(numericValue) && trimmedValue !== "") {
      return numericValue > 1e12 ? Math.floor(numericValue / 1000) : Math.floor(numericValue);
    }

    const normalizedValue = trimmedValue.replace(" ", "T");
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedValue);
    const timestamp = new Date(
      hasExplicitTimezone ? normalizedValue : `${normalizedValue}Z`
    ).getTime();

    return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
  }

  const date = timeValue instanceof Date ? timeValue : new Date(timeValue);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
};

const normalizeTimeToSeconds = (timeValue) =>
  normalizeTimestampToUnixSeconds(timeValue);

const getTimeBucketStart = (timeValue, timeframe, timezone = null) => {
  const normalizedSeconds = normalizeTimestampToUnixSeconds(timeValue);
  if (!Number.isFinite(normalizedSeconds)) {
    return null;
  }

  const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(timezone) ?? 0;
  const shiftedSeconds = normalizedSeconds + timezoneOffsetMinutes * 60;
  const bucketDate = new Date(shiftedSeconds * 1000);

  const toUtcBucketSeconds = () =>
    Math.floor(bucketDate.getTime() / 1000) - timezoneOffsetMinutes * 60;

  switch (timeframe) {
    case "1m":
      bucketDate.setUTCSeconds(0, 0);
      return toUtcBucketSeconds();
    case "2m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 2) * 2);
      return toUtcBucketSeconds();
    case "3m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 3) * 3);
      return toUtcBucketSeconds();
    case "4m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 4) * 4);
      return toUtcBucketSeconds();
    case "5m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 5) * 5);
      return toUtcBucketSeconds();
    case "10m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 10) * 10);
      return toUtcBucketSeconds();
    case "15m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 15) * 15);
      return toUtcBucketSeconds();
    case "30m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 30) * 30);
      return toUtcBucketSeconds();
    case "45m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 45) * 45);
      return toUtcBucketSeconds();
    case "1H":
      bucketDate.setUTCMinutes(0, 0, 0);
      return toUtcBucketSeconds();
    case "2H":
      bucketDate.setUTCMinutes(0, 0, 0);
      bucketDate.setUTCHours(Math.floor(bucketDate.getUTCHours() / 2) * 2);
      return toUtcBucketSeconds();
    case "3H":
      bucketDate.setUTCMinutes(0, 0, 0);
      bucketDate.setUTCHours(Math.floor(bucketDate.getUTCHours() / 3) * 3);
      return toUtcBucketSeconds();
    case "4H":
      bucketDate.setUTCMinutes(0, 0, 0);
      bucketDate.setUTCHours(Math.floor(bucketDate.getUTCHours() / 4) * 4);
      return toUtcBucketSeconds();
    case "1D":
      bucketDate.setUTCHours(0, 0, 0, 0);
      return toUtcBucketSeconds();
    case "1W": {
      bucketDate.setUTCHours(0, 0, 0, 0);
      const day = bucketDate.getUTCDay();
      const diff = (day + 6) % 7;
      bucketDate.setUTCDate(bucketDate.getUTCDate() - diff);
      return toUtcBucketSeconds();
    }
    case "1M":
      return Math.floor(Date.UTC(bucketDate.getUTCFullYear(), bucketDate.getUTCMonth(), 1) / 1000) - timezoneOffsetMinutes * 60;
    case "3M":
      return Math.floor(Date.UTC(
        bucketDate.getUTCFullYear(),
        Math.floor(bucketDate.getUTCMonth() / 3) * 3,
        1
      ) / 1000) - timezoneOffsetMinutes * 60;
    case "6M":
      return Math.floor(Date.UTC(
        bucketDate.getUTCFullYear(),
        Math.floor(bucketDate.getUTCMonth() / 6) * 6,
        1
      ) / 1000) - timezoneOffsetMinutes * 60;
    case "1Y":
      return Math.floor(Date.UTC(bucketDate.getUTCFullYear(), 0, 1) / 1000) - timezoneOffsetMinutes * 60;
    case "3Y":
      return Math.floor(Date.UTC(Math.floor(bucketDate.getUTCFullYear() / 3) * 3, 0, 1) / 1000) - timezoneOffsetMinutes * 60;
    case "5Y":
      return Math.floor(Date.UTC(Math.floor(bucketDate.getUTCFullYear() / 5) * 5, 0, 1) / 1000) - timezoneOffsetMinutes * 60;
    default:
      return normalizedSeconds;
  }
};

export const normalizeDataForTimeframe = (data, timeframe, timezone = null) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const normalizedRows = data
    .map((point) => {
      const time = normalizeTimeToSeconds(point?.time);

      if (!Number.isFinite(time)) {
        return null;
      }

      const open = Number(point?.open);
      const high = Number(point?.high);
      const low = Number(point?.low);
      const close = Number(point?.close);

      if (![open, high, low, close].every(Number.isFinite)) {
        return null;
      }

      return {
        ...point,
        time,
        open,
        high,
        low,
        close,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.time - right.time);

  if (normalizedRows.length === 0) {
    return [];
  }

  const buckets = new Map();

  normalizedRows.forEach((point) => {
    const bucketStart = getTimeBucketStart(point.time, timeframe, timezone);
    if (!Number.isFinite(bucketStart)) {
      return;
    }
    const existing = buckets.get(bucketStart);

    if (!existing) {
      buckets.set(bucketStart, {
        ...point,
        time: bucketStart,
      });
      return;
    }

    existing.high = Math.max(existing.high, point.high);
    existing.low = Math.min(existing.low, point.low);
    existing.close = point.close;
    existing.value = point.close;
    existing.currency = point.currency ?? existing.currency;
    existing.exchange = point.exchange ?? existing.exchange;
  });

  return Array.from(buckets.values()).sort(
    (left, right) => left.time - right.time
  );
};

const isFlatCandle = (candle) =>
  candle &&
  candle.open === candle.high &&
  candle.high === candle.low &&
  candle.low === candle.close;

export const repairMalformedMinuteCandles = (data, timeframe) => {
  if (timeframe !== "1m" || !Array.isArray(data) || data.length < 2) {
    return data;
  }

  const flatCandles = data.filter(isFlatCandle).length;
  const flatRatio = flatCandles / data.length;

  if (flatRatio < 0.35) {
    return data;
  }

  return data.map((candle, index, candles) => {
    if (index === 0 || !isFlatCandle(candle)) {
      return candle;
    }

    const previousClose = candles[index - 1]?.close;
    if (!Number.isFinite(previousClose)) {
      return candle;
    }

    const open = previousClose;
    const close = candle.close;
    const high = Math.max(candle.high, open, close);
    const low = Math.min(candle.low, open, close);

    return {
      ...candle,
      open,
      high,
      low,
      close,
      value: close,
    };
  });
};

export const getPriceFormat = (lastPrice, currency) => {
  let precision = 2;
  let minMove = 0.01;

  if (currency === 'COP') {
    precision = 0;
    minMove = 1;
  } else if (lastPrice < 1 && lastPrice !== 0) {
    precision = 4;
    minMove = 0.0001;
  } else if (lastPrice < 10 && lastPrice !== 0) {
    precision = 3;
    minMove = 0.001;
  }
  return { type: 'price', precision, minMove };
};


export const calculateEMA = (data, period) => {
  if (!data || data.length < period) return [];
  const k = 2 / (period + 1);
  const emaArray = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  emaArray.push(sum / period);
  for (let i = period; i < data.length; i++) {
    const ema = (data[i] * k) + (emaArray[emaArray.length - 1] * (1 - k));
    emaArray.push(ema);
  }
  return emaArray;
};

export const calculateMACD = (data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) => {
  if (!data || data.length < longPeriod + signalPeriod -1) return { macdLine: [], signalLine: [], histogram: [] };
  
  const emaShort = calculateEMA(data, shortPeriod);
  const emaLong = calculateEMA(data, longPeriod);

  const macdLine = [];
  
  const shortEmaAligned = emaShort.slice(longPeriod - shortPeriod);
  if (shortEmaAligned.length !== emaLong.length) {
    const diff = emaLong.length - shortEmaAligned.length;
     for (let i = 0; i < emaLong.length; i++) {
        if (i >= diff) {
            macdLine.push(shortEmaAligned[i-diff] - emaLong[i]);
        }
    }
  } else {
    for (let i = 0; i < emaLong.length; i++) {
        macdLine.push(shortEmaAligned[i] - emaLong[i]);
    }
  }
  
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  const histogram = [];
  const macdLineAligned = macdLine.slice(signalPeriod - 1);

  if (macdLineAligned.length !== signalLine.length) {
    const diff = signalLine.length - macdLineAligned.length;
    for (let i = 0; i < signalLine.length; i++) {
        if (i >= diff) {
          histogram.push(macdLineAligned[i-diff] - signalLine[i]);
        }
    }
  } else {
      for (let i = 0; i < signalLine.length; i++) {
        histogram.push(macdLineAligned[i] - signalLine[i]);
      }
  }
  
  return { macdLine, signalLine, histogram };
};

export const applyDrawingToChart = (chart, drawingObject, currency) => {
  if (!chart || !drawingObject || !drawingObject.points || drawingObject.points.length < 2) {
    return null;
  }

  const [startPoint, endPoint] = drawingObject.points;
  const lineData = [
    { time: startPoint.time, value: startPoint.price },
    { time: endPoint.time, value: endPoint.price }
  ];

  const priceFormat = getPriceFormat(startPoint.price, currency);

  if (drawingObject.type === 'trendline') {
    const lineSeries = chart.addLineSeries({
      color: 'rgba(255, 255, 0, 0.7)', 
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: priceFormat,
      lineStyle: LineStyle.Solid, 
      crosshairMarkerVisible: false,
    });
    lineSeries.setData(lineData);
    return lineSeries;
  }
  return null; 
};

export const aggregateDataForTimeframe = (data, timeframe, timezone = null) => {
  if (!data || data.length === 0) return [];
  if (MINUTE_TIMEFRAMES.has(timeframe)) return normalizeDataForTimeframe(data, timeframe, timezone);

  const timeframeMinutes = {
    "5m": 5, "15m": 15, "30m": 30,
    "1H": 60, "2H": 120, "4H": 240,
    "1D": 1440, 
  }[timeframe];

  if (!timeframeMinutes) return normalizeDataForTimeframe(data, timeframe, timezone); 

  const normalizedData = normalizeDataForTimeframe(data, "1m", timezone);
  const aggregated = [];
  let currentBucket = [];
  let bucketStartTime = null;

  for (const point of normalizedData) {
    const pointTime = point.time;
    if (!bucketStartTime) {
      bucketStartTime = Math.floor(pointTime / (timeframeMinutes * 60)) * (timeframeMinutes * 60);
    }

    if (pointTime < bucketStartTime + timeframeMinutes * 60) {
      currentBucket.push(point);
    } else {
      if (currentBucket.length > 0) {
        const open = currentBucket[0].open;
        const close = currentBucket[currentBucket.length - 1].close;
        const high = Math.max(...currentBucket.map(p => p.high));
        const low = Math.min(...currentBucket.map(p => p.low));
        aggregated.push({
          time: bucketStartTime,
          open, high, low, close,
          value: close, // For line charts
          currency: currentBucket[0].currency
        });
      }
      currentBucket = [point];
      bucketStartTime = Math.floor(pointTime / (timeframeMinutes * 60)) * (timeframeMinutes * 60);
    }
  }

  if (currentBucket.length > 0) {
     const open = currentBucket[0].open;
     const close = currentBucket[currentBucket.length - 1].close;
     const high = Math.max(...currentBucket.map(p => p.high));
     const low = Math.min(...currentBucket.map(p => p.low));
     aggregated.push({
       time: bucketStartTime,
       open, high, low, close,
       value: close,
       currency: currentBucket[0].currency
     });
  }
  return aggregated;
};

