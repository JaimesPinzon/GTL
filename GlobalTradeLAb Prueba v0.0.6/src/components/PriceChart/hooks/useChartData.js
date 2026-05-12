import { useMemo } from "react";
import {
  aggregateDataForTimeframe,
  formatPriceDataForChart,
  normalizeDataForTimeframe,
  repairMalformedMinuteCandles,
} from "../utils";
import { useOhlcHistory } from "./useOhlcHistory";

export function useChartData({
  cacheScopeKey,
  chartType,
  currentTimeframe,
  preferredTimezone,
  selectedMarketData,
  selectedSymbol,
}) {
  const {
    chartHistory,
    hasReachedOldestHistory,
    historyLimit,
    isLoadingOlderHistory,
    loadOlderHistory,
    progressiveHistoryEnabled,
  } = useOhlcHistory({
    cacheScopeKey,
    selectedSymbol,
    timeframe: currentTimeframe,
  });

  const liveSnapshotData = useMemo(
    () => normalizeDataForTimeframe(selectedMarketData, currentTimeframe, preferredTimezone),
    [currentTimeframe, preferredTimezone, selectedMarketData]
  );

  const rawData = useMemo(() => {
    if (chartHistory.length === 0) {
      return liveSnapshotData;
    }

    if (liveSnapshotData.length === 0) {
      return chartHistory;
    }

    // Merge the historical OHLC series with the rolling live quote series.
    // We intentionally merge by timestamp instead of only by the last historical bar,
    // because live quote timestamps may arrive slightly behind or overlap the latest OHLC bar.
    const mergedByTime = new Map();

    chartHistory.forEach((candle) => {
      if (!Number.isFinite(candle?.time)) {
        return;
      }

      mergedByTime.set(candle.time, candle);
    });

    liveSnapshotData.forEach((liveCandle) => {
      if (!Number.isFinite(liveCandle?.time)) {
        return;
      }

      const existingCandle = mergedByTime.get(liveCandle.time);

      if (!existingCandle) {
        mergedByTime.set(liveCandle.time, liveCandle);
        return;
      }

      mergedByTime.set(liveCandle.time, {
        ...existingCandle,
        open: existingCandle.open,
        high: Math.max(existingCandle.high, liveCandle.high),
        low: Math.min(existingCandle.low, liveCandle.low),
        close: liveCandle.close,
        value: liveCandle.close,
        currency: liveCandle.currency ?? existingCandle.currency,
        exchange: liveCandle.exchange ?? existingCandle.exchange,
      });
    });

    return Array.from(mergedByTime.values()).sort((left, right) => left.time - right.time);
  }, [chartHistory, liveSnapshotData]);

  const normalizedData = useMemo(() => {
    if (rawData.length === 0) {
      return [];
    }

    return aggregateDataForTimeframe(rawData, currentTimeframe, preferredTimezone);
  }, [currentTimeframe, preferredTimezone, rawData]);

  const repairedData = useMemo(() => {
    return repairMalformedMinuteCandles(normalizedData, currentTimeframe);
  }, [currentTimeframe, normalizedData]);

  const renderedData = useMemo(() => repairedData, [repairedData]);

  const formattedSeriesData = useMemo(
    () => formatPriceDataForChart(renderedData, chartType),
    [chartType, renderedData]
  );
  const visibleOhlcData = renderedData;

  return {
    chartHistory,
    formattedSeriesData,
    hasReachedOldestHistory,
    historyLimit,
    isLoadingOlderHistory,
    loadOlderHistory,
    normalizedData,
    progressiveHistoryEnabled,
    rawData,
    renderedData,
    repairedData,
    visibleOhlcData,
    processedData: renderedData,
  };
}
