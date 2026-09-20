import { useCallback, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { getChartOptions } from "../utils";

const alignPlotToTimeline = (plotData = [], timeline = []) => {
  const valuesByTime = new Map(plotData.map((entry) => [entry.time, entry]));
  return timeline.map((entry) => valuesByTime.get(entry.time) ?? { time: entry.time });
};

export function useMacdChart({
  chartAppearance,
  chartLocale,
  chartRef,
  chartTimezone,
  formattedSeriesData,
  isFullScreen,
  macdContainerRef,
  onCrosshairMove,
  paneStudy,
  seriesRef,
  showMACD,
}) {
  const macdChartRef = useRef(null);
  const paneSeriesRefs = useRef(new Map());
  const syncRangeStateRef = useRef({ isSyncingMainToMacd: false, isSyncingMacdToMain: false });
  const unsubscribeMainToMacdRef = useRef(null);
  const unsubscribeMacdToMainRef = useRef(null);
  const unsubscribeMainCrosshairRef = useRef(null);
  const unsubscribeMacdCrosshairRef = useRef(null);
  const paneValuesByPlotRef = useRef(new Map());
  const mainValuesByTimeRef = useRef(new Map());
  const crosshairSyncStateRef = useRef({ mainToMacd: false, macdToMain: false });
  const crosshairMoveHandlerRef = useRef(onCrosshairMove);

  useEffect(() => {
    crosshairMoveHandlerRef.current = onCrosshairMove;
  }, [onCrosshairMove]);

  useEffect(() => {
    mainValuesByTimeRef.current = new Map(
      formattedSeriesData.map((entry) => [String(entry.time), entry.close ?? entry.value])
    );
  }, [formattedSeriesData]);

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
      rightPriceScale: { visible: true, minimumWidth: 80 },
      timeScale: { visible: true },
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

      const handleMainCrosshairMove = (param) => {
        if (crosshairSyncStateRef.current.macdToMain || !macdChartRef.current) {
          return;
        }

        if (param?.time == null) {
          crosshairSyncStateRef.current.mainToMacd = true;
          try {
            macdChartRef.current.clearCrosshairPosition?.();
          } finally {
            crosshairSyncStateRef.current.mainToMacd = false;
          }
          return;
        }

        for (const [plotId, paneSeries] of paneSeriesRefs.current.entries()) {
          const value = paneValuesByPlotRef.current.get(plotId)?.get(String(param.time));
          if (!Number.isFinite(value) || !paneSeries) continue;

          crosshairSyncStateRef.current.mainToMacd = true;
          try {
            macdChartRef.current.setCrosshairPosition(value, param.time, paneSeries);
          } finally {
            crosshairSyncStateRef.current.mainToMacd = false;
          }
          break;
        }
      };

      const handleMacdCrosshairMove = (param) => {
        crosshairMoveHandlerRef.current?.(param);

        if (crosshairSyncStateRef.current.mainToMacd || !chartRef.current || !seriesRef.current) {
          return;
        }

        if (param?.time == null) {
          crosshairSyncStateRef.current.macdToMain = true;
          try {
            chartRef.current.clearCrosshairPosition?.();
          } finally {
            crosshairSyncStateRef.current.macdToMain = false;
          }
          return;
        }

        const value = mainValuesByTimeRef.current.get(String(param.time));
        if (!Number.isFinite(value)) return;

        crosshairSyncStateRef.current.macdToMain = true;
        try {
          chartRef.current.setCrosshairPosition(value, param.time, seriesRef.current);
        } finally {
          crosshairSyncStateRef.current.macdToMain = false;
        }
      };

      chartRef.current.subscribeCrosshairMove(handleMainCrosshairMove);
      macdChartRef.current.subscribeCrosshairMove(handleMacdCrosshairMove);
      unsubscribeMainCrosshairRef.current = () => {
        try {
          chartRef.current?.unsubscribeCrosshairMove(handleMainCrosshairMove);
        } catch {}
      };
      unsubscribeMacdCrosshairRef.current = () => {
        try {
          macdChartRef.current?.unsubscribeCrosshairMove(handleMacdCrosshairMove);
        } catch {}
      };
    }

    syncMacdVisibility();

    return () => {
      unsubscribeMainToMacdRef.current?.();
      unsubscribeMacdToMainRef.current?.();
      unsubscribeMainCrosshairRef.current?.();
      unsubscribeMacdCrosshairRef.current?.();
      unsubscribeMainToMacdRef.current = null;
      unsubscribeMacdToMainRef.current = null;
      unsubscribeMainCrosshairRef.current = null;
      unsubscribeMacdCrosshairRef.current = null;

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
      paneValuesByPlotRef.current = new Map();
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
      const alignedData = alignPlotToTimeline(plot.data, formattedSeriesData);
      paneValuesByPlotRef.current.set(
        plot.id,
        new Map(
          alignedData
            .filter((entry) => Number.isFinite(entry.value))
            .map((entry) => [String(entry.time), entry.value])
        )
      );
      plotSeries?.setData(alignedData);
    });

    paneSeriesRefs.current.forEach((series, plotId) => {
      if (nextPlotIds.has(plotId)) {
        return;
      }

      try {
        macdChartRef.current?.removeSeries(series);
      } catch {}

      paneSeriesRefs.current.delete(plotId);
      paneValuesByPlotRef.current.delete(plotId);
    });

    const mainVisibleRange = chartRef.current?.timeScale?.().getVisibleLogicalRange?.();
    if (mainVisibleRange) {
      macdChartRef.current.timeScale().setVisibleLogicalRange(mainVisibleRange);
    }
  }, [chartRef, createSeriesForPlot, formattedSeriesData, paneStudy]);

  return {
    macdChartRef,
    syncMacdVisibility,
  };
}
