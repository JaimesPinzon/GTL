import { useEffect, useMemo } from "react";
import {
  aggregateDataForTimeframe,
  formatPriceDataForChart,
  repairMalformedMinuteCandles,
} from "../utils";
import { mergeMarketSnapshot } from "@/lib/market-price";
import { useOhlcHistory } from "./useOhlcHistory";

export function useChartData({
  cacheScopeKey,
  chartType,
  currentTimeframe,
  preferredTimezone,
  marketSnapshot,
  reportChartHistory,
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

  useEffect(() => {
    reportChartHistory?.(selectedSymbol, chartHistory);
  }, [chartHistory, reportChartHistory, selectedSymbol]);

  // The chart owns the OHLC history. Class-level market data may be a quote-only
  // snapshot, so use it only as a fallback when the chart has not loaded history.
  const rawData = chartHistory.length > 1
    ? chartHistory
    : selectedMarketData?.length > 1
      ? selectedMarketData
      : chartHistory;

  const normalizedData = useMemo(() => {
    if (rawData.length === 0) {
      return [];
    }

    return aggregateDataForTimeframe(rawData, currentTimeframe, preferredTimezone);
  }, [currentTimeframe, preferredTimezone, rawData]);

  const repairedData = useMemo(() => {
    return repairMalformedMinuteCandles(normalizedData, currentTimeframe);
  }, [currentTimeframe, normalizedData]);

  const renderedData = useMemo(
    () => mergeMarketSnapshot(repairedData, marketSnapshot, currentTimeframe, preferredTimezone),
    [repairedData, marketSnapshot, currentTimeframe, preferredTimezone]
  );

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
