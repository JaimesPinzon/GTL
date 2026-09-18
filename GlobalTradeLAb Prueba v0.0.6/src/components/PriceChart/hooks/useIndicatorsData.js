import { useEffect, useMemo, useState } from "react";
import { getMarketIndicatorsFromBackend } from "@/lib/backend-market";
import { normalizeTimestampToUnixSeconds } from "../utils";
import { buildStudyInstances, getActiveStudyDefinitions, STUDY_PANES } from "../studies/registry";

export function useIndicatorsData({
  chartAppearance,
  emaPeriod,
  historyLimit,
  indicatorInstances,
  processedData,
  preferredTimezone,
  selectedSymbol,
  showEMA,
  showMACD,
  timeframe,
}) {
  const [backendIndicators, setBackendIndicators] = useState(null);
  const macdInstance = indicatorInstances?.find((instance) => instance.id === "macd");
  const macdShortPeriod = macdInstance?.parameters?.shortPeriod ?? 12;
  const macdLongPeriod = macdInstance?.parameters?.longPeriod ?? 26;
  const macdSignalPeriod = macdInstance?.parameters?.signalPeriod ?? 9;

  useEffect(() => {
    let isMounted = true;

    if (!showEMA && !showMACD) {
      setBackendIndicators(null);
      return () => {
        isMounted = false;
      };
    }

    const loadIndicators = async () => {
      setBackendIndicators(null);
      try {
        const response = await getMarketIndicatorsFromBackend({
          symbol: selectedSymbol,
          timeframe,
          limit: historyLimit,
          emaPeriod,
          macdShortPeriod,
          macdLongPeriod,
          macdSignalPeriod,
        });

        if (!isMounted) {
          return;
        }

        const normalizeSeries = (series = []) =>
          series
            .filter((entry) => entry?.time && Number.isFinite(Number(entry.value)))
            .map((entry) => ({
              ...entry,
              time: normalizeTimestampToUnixSeconds(entry.time),
              value: Number(entry.value),
            }));

        setBackendIndicators({
          ema: normalizeSeries(response?.ema),
          macdLine: normalizeSeries(response?.macdLine),
          signalLine: normalizeSeries(response?.signalLine),
          histogram: normalizeSeries(response?.histogram).map((entry) => ({
            ...entry,
            color: entry.color,
          })),
        });
      } catch (error) {
        console.error("loadIndicators error", error);

        if (isMounted) {
          setBackendIndicators(null);
        }
      }
    };

    loadIndicators();

    return () => {
      isMounted = false;
    };
  }, [emaPeriod, historyLimit, macdLongPeriod, macdShortPeriod, macdSignalPeriod, preferredTimezone, selectedSymbol, showEMA, showMACD, timeframe]);

  const resolvedIndicatorData = useMemo(() => ({
    ema: {
      "ema-line": backendIndicators?.ema ?? [],
    },
    macd: {
      "macd-line": backendIndicators?.macdLine ?? [],
      "macd-signal": backendIndicators?.signalLine ?? [],
      "macd-histogram": backendIndicators?.histogram ?? [],
    },
  }), [
    backendIndicators?.ema,
    backendIndicators?.histogram,
    backendIndicators?.macdLine,
    backendIndicators?.signalLine,
  ]);

  const activeStudyDefinitions = useMemo(
    () => getActiveStudyDefinitions({ showEMA, showMACD }),
    [showEMA, showMACD]
  );

  const studyInstances = useMemo(
    () =>
      buildStudyInstances({
        chartAppearance,
        definitions: activeStudyDefinitions,
        emaPeriod,
        indicatorInstances,
        processedData,
        resolvedIndicatorData,
      }),
    [activeStudyDefinitions, chartAppearance, emaPeriod, indicatorInstances, processedData, resolvedIndicatorData]
  );

  const overlayStudies = useMemo(
    () => studyInstances.filter((study) => study.paneId === STUDY_PANES.MAIN),
    [studyInstances]
  );

  const paneStudies = useMemo(
    () => studyInstances.filter((study) => study.paneId !== STUDY_PANES.MAIN),
    [studyInstances]
  );

  const resolvedEmaData =
    studyInstances.find((study) => study.id === "ema")?.plots.find((plot) => plot.id === "ema-line")?.data ?? [];

  const resolvedMacdStudy = studyInstances.find((study) => study.id === "macd");
  const resolvedMacdData = resolvedMacdStudy
    ? {
        macdLine: resolvedMacdStudy.plots.find((plot) => plot.id === "macd-line")?.data ?? [],
        signalLine: resolvedMacdStudy.plots.find((plot) => plot.id === "macd-signal")?.data ?? [],
        histogramData: resolvedMacdStudy.plots.find((plot) => plot.id === "macd-histogram")?.data ?? [],
      }
    : null;

  return {
    activeStudyDefinitions,
    backendIndicators,
    overlayStudies,
    paneStudies,
    resolvedEmaData,
    resolvedIndicatorData,
    resolvedMacdData,
    studyInstances,
  };
}
