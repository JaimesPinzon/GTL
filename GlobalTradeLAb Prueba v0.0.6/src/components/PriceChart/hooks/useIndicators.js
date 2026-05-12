import { useMemo } from "react";
import { normalizeTimestampToUnixSeconds } from "../utils";
import { buildEmaSeriesData } from "../Indicators/ema";
import { buildMacdSeriesData } from "../Indicators/macd";

export function useIndicators({ emaPeriod, processedData, showEMA, showMACD }) {
  const emaData = useMemo(() => {
    if (!showEMA || processedData.length < emaPeriod) {
      return [];
    }

    return buildEmaSeriesData({
      emaPeriod,
      processedData,
    }).map((entry) => ({
      ...entry,
      time: normalizeTimestampToUnixSeconds(entry.time),
    }));
  }, [emaPeriod, processedData, showEMA]);

  const macdData = useMemo(() => {
    if (!showMACD || processedData.length < 26) {
      return null;
    }

    return buildMacdSeriesData(processedData);
  }, [processedData, showMACD]);

  return { emaData, macdData };
}
