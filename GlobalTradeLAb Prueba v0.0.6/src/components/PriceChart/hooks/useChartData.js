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

  // Keep the selected interval's history intact. Hourly history is not minute data.
  const rawData = selectedMarketData?.length ? selectedMarketData : chartHistory;

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
