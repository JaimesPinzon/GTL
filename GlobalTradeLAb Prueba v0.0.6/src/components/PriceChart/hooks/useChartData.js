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
  selectedSymbol,
}) {
  const {
    chartHistory,
    hasReachedOldestHistory,
    historyLimit,
    isInitialHistoryLoading,
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

  // The chart history is the only candle source. Quotes may update the last bar
  // after this history exists, but must never render a provisional second series.
  const rawData = chartHistory;

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
    () => repairedData.length > 0
      ? mergeMarketSnapshot(repairedData, marketSnapshot, currentTimeframe, preferredTimezone)
      : repairedData,
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
    isInitialHistoryLoading,
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
