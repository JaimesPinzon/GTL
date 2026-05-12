import { useCallback, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import { focusLatestBars, getChartOptions, getPriceFormat, getSeriesOptions } from "../utils";
import { INITIAL_VISIBLE_BARS_BY_TIMEFRAME } from "@/lib/market-timeframes";

export function useMainChart({
  chartAppearance,
  chartLocale,
  chartTimezone,
  chartType,
  chartRef,
  containerRef,
  currency,
  currentTimeframe,
  drawingSeriesRefs,
  formattedSeriesData,
  isFullScreen,
  onChartClick,
  onCrosshairMove,
  onLoadOlderHistory,
  onRegisterActions,
  overlayStudies,
  progressiveHistoryEnabled,
  processedData,
  renderedDataRef,
  seriesRef,
  selectedSymbol,
  showMACD,
  syncMacdVisibility,
}) {
  const seriesTypeRef = useRef(null);
  const overlaySeriesRefs = useRef(new Map());
  const hasAutoFocusedRef = useRef(false);
  const chartClickHandlerRef = useRef(onChartClick);
  const crosshairMoveHandlerRef = useRef(onCrosshairMove);
  const loadOlderHistoryHandlerRef = useRef(onLoadOlderHistory);
  const resizeFrameRef = useRef(null);
  const userInteractionArmedRef = useRef(false);
  const lastVisibleFromRef = useRef(null);

  const createSeriesForPlot = useCallback((plot) => {
    if (!chartRef.current) {
      return null;
    }

    if (plot.type === "histogram") {
      return chartRef.current.addHistogramSeries(plot.options ?? {});
    }

    return chartRef.current.addLineSeries(plot.options ?? {});
  }, [chartRef]);

  useEffect(() => {
    hasAutoFocusedRef.current = false;
    userInteractionArmedRef.current = false;
    lastVisibleFromRef.current = null;
  }, [chartType, currentTimeframe, selectedSymbol]);

  useEffect(() => {
    chartClickHandlerRef.current = onChartClick;
  }, [onChartClick]);

  useEffect(() => {
    crosshairMoveHandlerRef.current = onCrosshairMove;
  }, [onCrosshairMove]);

  useEffect(() => {
    loadOlderHistoryHandlerRef.current = onLoadOlderHistory;
  }, [onLoadOlderHistory]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {}
      chartRef.current = null;
    }

    containerRef.current.innerHTML = "";

    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    chartRef.current = createChart(
      containerRef.current,
      getChartOptions(
        currentTheme,
        isFullScreen,
        containerRef,
        !!showMACD,
        chartAppearance,
        chartLocale,
        chartTimezone
      )
    );

    const handleChartClickProxy = (param) => chartClickHandlerRef.current?.(param);
    const handleCrosshairMoveProxy = (param) => crosshairMoveHandlerRef.current?.(param);

    chartRef.current.subscribeClick(handleChartClickProxy);
    chartRef.current.subscribeCrosshairMove(handleCrosshairMoveProxy);

    const applyResize = () => {
      if (chartRef.current && containerRef.current) {
        const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
        const scrollPosition = chartRef.current.timeScale().scrollPosition?.();

        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });

        if (Number.isFinite(scrollPosition)) {
          try {
            chartRef.current.timeScale().scrollToPosition(scrollPosition, false);
          } catch {}
        }

        if (visibleRange) {
          try {
            chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
          } catch {}
        }
      }

      syncMacdVisibility?.();
    };

    const handleResize = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        applyResize();
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName !== "class") {
          continue;
        }

        const nextTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        chartRef.current?.applyOptions(
          getChartOptions(
            nextTheme,
            isFullScreen,
            containerRef,
            !!showMACD,
            chartAppearance,
            chartLocale,
            chartTimezone
          )
        );
      }
    });

    themeObserver.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }

      try {
        chartRef.current?.unsubscribeClick(handleChartClickProxy);
      } catch {}
      try {
        chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMoveProxy);
      } catch {}

      drawingSeriesRefs.current.forEach((series) => {
        if (chartRef.current && series) {
          try {
            chartRef.current.removeSeries(series);
          } catch {}
        }
      });

      overlaySeriesRefs.current.forEach((series) => {
        if (chartRef.current && series) {
          try {
            chartRef.current.removeSeries(series);
          } catch {}
        }
      });

      if (seriesRef.current && chartRef.current) {
        try {
          chartRef.current.removeSeries(seriesRef.current);
        } catch {}
      }

      try {
        chartRef.current?.remove();
      } catch {}

      chartRef.current = null;
      seriesRef.current = null;
      seriesTypeRef.current = null;
      overlaySeriesRefs.current = new Map();
      drawingSeriesRefs.current = [];
    };
  }, [containerRef, drawingSeriesRefs, syncMacdVisibility]);

  useEffect(() => {
    if (!chartRef.current || !containerRef.current) {
      return;
    }

    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    chartRef.current.applyOptions(
      getChartOptions(
        currentTheme,
        isFullScreen,
        containerRef,
        !!showMACD,
        chartAppearance,
        chartLocale,
        chartTimezone
      )
    );
  }, [chartAppearance, chartLocale, chartTimezone, containerRef, isFullScreen, showMACD]);

  useEffect(() => {
    if (!chartRef.current || !progressiveHistoryEnabled || typeof loadOlderHistoryHandlerRef.current !== "function") {
      return;
    }

    let isRequestInFlight = false;
    let lastRequestAt = 0;
    const chartHost = containerRef.current;

    const armUserInteraction = () => {
      userInteractionArmedRef.current = true;
    };

    const handleVisibleRangeChange = async (range) => {
      if (!range || isRequestInFlight) {
        return;
      }
      const currentFrom = Number.isFinite(range.from) ? range.from : null;
      if (!userInteractionArmedRef.current) {
        if (currentFrom !== null) {
          lastVisibleFromRef.current = currentFrom;
        }
        return;
      }

      const previousFrom = lastVisibleFromRef.current;
      if (currentFrom !== null) {
        lastVisibleFromRef.current = currentFrom;
      }

      // Only request older candles when the user is effectively panning to the left.
      if (
        currentFrom === null ||
        previousFrom === null ||
        currentFrom >= previousFrom - 0.01
      ) {
        return;
      }

      const barsInfo = seriesRef.current?.barsInLogicalRange?.(range);
      if (!barsInfo) {
        return;
      }

      const barsBefore = Number.isFinite(barsInfo.barsBefore) ? barsInfo.barsBefore : Number.POSITIVE_INFINITY;
      if (barsBefore > 40) {
        return;
      }

      const now = Date.now();
      if (now - lastRequestAt < 500) {
        return;
      }

      lastRequestAt = now;
      isRequestInFlight = true;

      try {
        await loadOlderHistoryHandlerRef.current?.();
      } finally {
        window.setTimeout(() => {
          isRequestInFlight = false;
        }, 250);
      }
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    chartHost?.addEventListener("wheel", armUserInteraction, { passive: true });
    chartHost?.addEventListener("pointerdown", armUserInteraction, { passive: true });
    chartHost?.addEventListener("touchstart", armUserInteraction, { passive: true });

    return () => {
      try {
        chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      } catch {}
      chartHost?.removeEventListener("wheel", armUserInteraction);
      chartHost?.removeEventListener("pointerdown", armUserInteraction);
      chartHost?.removeEventListener("touchstart", armUserInteraction);
    };
  }, [containerRef, formattedSeriesData.length, progressiveHistoryEnabled, seriesRef]);

  useEffect(() => {
    if (!chartRef.current || !containerRef.current) {
      return;
    }

    if (processedData.length === 0 || formattedSeriesData.length === 0) {
      seriesRef.current?.setData([]);
      return;
    }

    const shouldRecreateSeries = !seriesRef.current || seriesTypeRef.current !== chartType;

    if (shouldRecreateSeries && seriesRef.current && chartRef.current) {
      try {
        chartRef.current.removeSeries(seriesRef.current);
      } catch {}
      seriesRef.current = null;
      seriesTypeRef.current = null;
    }

    if (!seriesRef.current) {
      const seriesOptions = getSeriesOptions(chartType, chartAppearance);
      seriesRef.current =
        chartType === "line"
          ? chartRef.current.addLineSeries(seriesOptions)
          : chartRef.current.addCandlestickSeries(seriesOptions);
      seriesTypeRef.current = chartType;
    } else {
      seriesRef.current.applyOptions(getSeriesOptions(chartType, chartAppearance));
    }

    renderedDataRef.current = processedData;
    seriesRef.current.setData(formattedSeriesData);

    const lastPrice =
      formattedSeriesData[formattedSeriesData.length - 1]?.close ??
      formattedSeriesData[formattedSeriesData.length - 1]?.value ??
      0;

    seriesRef.current.applyOptions({ priceFormat: getPriceFormat(lastPrice, currency) });

    if (!hasAutoFocusedRef.current) {
      focusLatestBars(
        chartRef.current,
        formattedSeriesData.length,
        INITIAL_VISIBLE_BARS_BY_TIMEFRAME[currentTimeframe] ?? 120
      );
      hasAutoFocusedRef.current = true;
    }
  }, [chartAppearance, chartLocale, chartTimezone, chartType, currency, currentTimeframe, formattedSeriesData, isFullScreen, processedData, renderedDataRef, showMACD]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const nextPlotIds = new Set();

    overlayStudies.forEach((study) => {
      study.plots.forEach((plot) => {
        nextPlotIds.add(plot.id);

        if (!overlaySeriesRefs.current.has(plot.id)) {
          const series = createSeriesForPlot(plot);

          if (series) {
            overlaySeriesRefs.current.set(plot.id, series);
          }
        }

        const plotSeries = overlaySeriesRefs.current.get(plot.id);
        plotSeries?.applyOptions(plot.options ?? {});
        plotSeries?.setData(plot.data ?? []);
      });
    });

    overlaySeriesRefs.current.forEach((series, plotId) => {
      if (nextPlotIds.has(plotId)) {
        return;
      }

      try {
        chartRef.current?.removeSeries(series);
      } catch {}

      overlaySeriesRefs.current.delete(plotId);
    });
  }, [createSeriesForPlot, overlayStudies]);

  useEffect(() => {
    if (!onRegisterActions) {
      return undefined;
    }

    const captureScreenshot = () => {
      if (!chartRef.current) {
        return false;
      }

      try {
        const canvas = chartRef.current.takeScreenshot();
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${selectedSymbol.toLowerCase()}-chart.png`;
        link.click();
        return true;
      } catch (error) {
        console.error("captureScreenshot error", error);
        return false;
      }
    };

    onRegisterActions({ captureScreenshot });
    return () => onRegisterActions(null);
  }, [onRegisterActions, selectedSymbol]);
}
