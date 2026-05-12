import { useCallback, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { focusLatestBars, getChartOptions } from "../utils";
import { INITIAL_VISIBLE_BARS_BY_TIMEFRAME } from "@/lib/market-timeframes";

export function useMacdChart({
  chartAppearance,
  chartLocale,
  chartRef,
  chartTimezone,
  currentTimeframe,
  formattedSeriesData,
  isFullScreen,
  macdContainerRef,
  paneStudy,
  showMACD,
}) {
  const macdChartRef = useRef(null);
  const paneSeriesRefs = useRef(new Map());
  const syncRangeStateRef = useRef({ isSyncingMainToMacd: false, isSyncingMacdToMain: false });
  const unsubscribeMainToMacdRef = useRef(null);
  const unsubscribeMacdToMainRef = useRef(null);

  const createSeriesForPlot = useCallback((plot) => {
    if (!macdChartRef.current) {
      return null;
    }

    if (plot.type === "histogram") {
      return macdChartRef.current.addHistogramSeries(plot.options ?? {});
    }

    return macdChartRef.current.addLineSeries(plot.options ?? {});
  }, []);

  const syncMacdVisibility = useCallback(() => {
    if (macdChartRef.current && macdContainerRef.current) {
      macdChartRef.current.applyOptions({
        width: macdContainerRef.current.clientWidth,
        height: macdContainerRef.current.clientHeight,
      });
    }
  }, [macdContainerRef]);

  useEffect(() => {
    if (!macdContainerRef.current) {
      return;
    }

    if (macdChartRef.current) {
      try {
        macdChartRef.current.remove();
      } catch {}
      macdChartRef.current = null;
    }

    if (!showMACD) {
      paneSeriesRefs.current = new Map();
      return;
    }

    macdContainerRef.current.innerHTML = "";
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";

    macdChartRef.current = createChart(macdContainerRef.current, {
      ...getChartOptions(currentTheme, isFullScreen, macdContainerRef, false, chartAppearance, chartLocale, chartTimezone),
      height: 100,
      rightPriceScale: { visible: true },
      timeScale: { visible: false },
    });

    if (chartRef.current && macdChartRef.current) {
      const handleMainToMacdRangeChange = (range) => {
        if (!range || !macdChartRef.current?.timeScale) {
          return;
        }

        if (syncRangeStateRef.current.isSyncingMacdToMain) {
          return;
        }

        syncRangeStateRef.current.isSyncingMainToMacd = true;
        try {
          macdChartRef.current.timeScale().setVisibleLogicalRange(range);
        } finally {
          syncRangeStateRef.current.isSyncingMainToMacd = false;
        }
      };

      const handleMacdToMainRangeChange = (range) => {
        if (!range || !chartRef.current?.timeScale) {
          return;
        }

        if (syncRangeStateRef.current.isSyncingMainToMacd) {
          return;
        }

        syncRangeStateRef.current.isSyncingMacdToMain = true;
        try {
          chartRef.current.timeScale().setVisibleLogicalRange(range);
        } finally {
          syncRangeStateRef.current.isSyncingMacdToMain = false;
        }
      };

      chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleMainToMacdRangeChange);
      macdChartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleMacdToMainRangeChange);

      unsubscribeMainToMacdRef.current = () => {
        try {
          chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleMainToMacdRangeChange);
        } catch {}
      };
      unsubscribeMacdToMainRef.current = () => {
        try {
          macdChartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleMacdToMainRangeChange);
        } catch {}
      };
    }

    syncMacdVisibility();

    return () => {
      unsubscribeMainToMacdRef.current?.();
      unsubscribeMacdToMainRef.current?.();
      unsubscribeMainToMacdRef.current = null;
      unsubscribeMacdToMainRef.current = null;

      paneSeriesRefs.current.forEach((series) => {
        if (macdChartRef.current && series) {
          try {
            macdChartRef.current.removeSeries(series);
          } catch {}
        }
      });
      if (macdChartRef.current) {
        try {
          macdChartRef.current.remove();
        } catch {}
      }

      paneSeriesRefs.current = new Map();
      macdChartRef.current = null;
    };
  }, [chartRef, macdContainerRef, showMACD, syncMacdVisibility]);

  useEffect(() => {
    if (!macdChartRef.current || !showMACD) {
      return;
    }

    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    macdChartRef.current.applyOptions(
      getChartOptions(currentTheme, isFullScreen, macdContainerRef, false, chartAppearance, chartLocale, chartTimezone)
    );
    syncMacdVisibility();
  }, [chartAppearance, chartLocale, chartTimezone, isFullScreen, macdContainerRef, showMACD, syncMacdVisibility]);

  useEffect(() => {
    if (!macdChartRef.current) {
      return;
    }

    if (!paneStudy) {
      paneSeriesRefs.current.forEach((series) => {
        series?.setData([]);
      });
      return;
    }

    const nextPlotIds = new Set();

    paneStudy.plots.forEach((plot) => {
      nextPlotIds.add(plot.id);

      if (!paneSeriesRefs.current.has(plot.id)) {
        const series = createSeriesForPlot(plot);

        if (series) {
          paneSeriesRefs.current.set(plot.id, series);
        }
      }

      const plotSeries = paneSeriesRefs.current.get(plot.id);
      plotSeries?.applyOptions(plot.options ?? {});
      plotSeries?.setData(plot.data ?? []);
    });

    paneSeriesRefs.current.forEach((series, plotId) => {
      if (nextPlotIds.has(plotId)) {
        return;
      }

      try {
        macdChartRef.current?.removeSeries(series);
      } catch {}

      paneSeriesRefs.current.delete(plotId);
    });

    focusLatestBars(
      macdChartRef.current,
      formattedSeriesData.length,
      INITIAL_VISIBLE_BARS_BY_TIMEFRAME[currentTimeframe] ?? 120
    );
  }, [createSeriesForPlot, currentTimeframe, formattedSeriesData.length, paneStudy]);

  return {
    macdChartRef,
    syncMacdVisibility,
  };
}
