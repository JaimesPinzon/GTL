import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import {
  focusLatestBars,
  getChartOptions,
  getPriceFormat,
  getSeriesOptions,
} from "../utils";
import { INITIAL_VISIBLE_BARS_BY_TIMEFRAME } from "@/lib/market-timeframes";

export function useChartEngine({
  chartAppearance,
  chartContainerRef,
  chartRef,
  chartType,
  currency,
  currentTimeframe,
  emaData,
  formattedSeriesData,
  isFullScreen,
  macdChartContainerRef,
  macdData,
  onChartClick,
  onCrosshairMove,
  onRegisterActions,
  processedData,
  renderedDataRef,
  seriesRef,
  selectedSymbol,
  showMACD,
}) {
  const macdChartRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const macdSeriesRef = useRef(null);
  const signalSeriesRef = useRef(null);
  const histogramSeriesRef = useRef(null);
  const clickHandlerRef = useRef(onChartClick);
  const crosshairHandlerRef = useRef(onCrosshairMove);

  useEffect(() => {
    clickHandlerRef.current = onChartClick;
  }, [onChartClick]);

  useEffect(() => {
    crosshairHandlerRef.current = onCrosshairMove;
  }, [onCrosshairMove]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const chartOptions = getChartOptions(
      currentTheme,
      isFullScreen,
      chartContainerRef,
      !!showMACD,
      chartAppearance
    );

    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    const handleChartClick = (param) => clickHandlerRef.current?.(param);
    const handleCrosshairMove = (param) => crosshairHandlerRef.current?.(param);

    chartRef.current.subscribeClick(handleChartClick);
    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    if (showMACD && macdChartContainerRef.current) {
      const macdChartOptions = {
        ...getChartOptions(currentTheme, isFullScreen, macdChartContainerRef, false, chartAppearance),
        height: 100,
        rightPriceScale: { visible: true },
        timeScale: { visible: false },
      };

      macdChartRef.current = createChart(macdChartContainerRef.current, macdChartOptions);

      if (chartRef.current && macdChartRef.current) {
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (macdChartRef.current?.timeScale) {
            macdChartRef.current.timeScale().setVisibleLogicalRange(range);
          }
        });

        macdChartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (chartRef.current?.timeScale) {
            chartRef.current.timeScale().setVisibleLogicalRange(range);
          }
        });
      }
    } else if (macdChartRef.current) {
      try {
        macdChartRef.current.remove();
      } catch {}
      macdChartRef.current = null;
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }

      if (macdChartRef.current && macdChartContainerRef.current) {
        macdChartRef.current.applyOptions({
          width: macdChartContainerRef.current.clientWidth,
          height: macdChartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);
    if (macdChartContainerRef.current) {
      resizeObserver.observe(macdChartContainerRef.current);
    }

    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName !== "class") continue;

        const newTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        if (chartRef.current) {
          chartRef.current.applyOptions(
            getChartOptions(newTheme, isFullScreen, chartContainerRef, !!showMACD, chartAppearance)
          );
        }
        if (macdChartRef.current) {
          macdChartRef.current.applyOptions(
            getChartOptions(newTheme, isFullScreen, macdChartContainerRef, false, chartAppearance)
          );
        }
      }
    });

    themeObserver.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      themeObserver.disconnect();

      if (chartRef.current) {
        try {
          chartRef.current.unsubscribeClick(handleChartClick);
        } catch {}
      }
      if (chartRef.current) {
        try {
          chartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
        } catch {}
      }

      if (emaSeriesRef.current && chartRef.current) {
        try {
          chartRef.current.removeSeries(emaSeriesRef.current);
        } catch {}
      }
      if (seriesRef.current && chartRef.current) {
        try {
          chartRef.current.removeSeries(seriesRef.current);
        } catch {}
      }
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {}
      }

      if (macdSeriesRef.current && macdChartRef.current) {
        try {
          macdChartRef.current.removeSeries(macdSeriesRef.current);
        } catch {}
      }
      if (signalSeriesRef.current && macdChartRef.current) {
        try {
          macdChartRef.current.removeSeries(signalSeriesRef.current);
        } catch {}
      }
      if (histogramSeriesRef.current && macdChartRef.current) {
        try {
          macdChartRef.current.removeSeries(histogramSeriesRef.current);
        } catch {}
      }
      if (macdChartRef.current) {
        try {
          macdChartRef.current.remove();
        } catch {}
      }

      seriesRef.current = null;
      emaSeriesRef.current = null;
      chartRef.current = null;
      macdSeriesRef.current = null;
      signalSeriesRef.current = null;
      histogramSeriesRef.current = null;
      macdChartRef.current = null;
    };
  }, [
    chartAppearance,
    chartContainerRef,
    isFullScreen,
    macdChartContainerRef,
    showMACD,
  ]);

  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) {
      return;
    }

    if (processedData.length === 0 || formattedSeriesData.length === 0) {
      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }
      return;
    }

    if (!seriesRef.current) {
      const seriesOptions = getSeriesOptions(chartType, chartAppearance);
      seriesRef.current =
        chartType === "line"
          ? chartRef.current.addLineSeries(seriesOptions)
          : chartRef.current.addCandlestickSeries(seriesOptions);
    } else {
      try {
        seriesRef.current.applyOptions(getSeriesOptions(chartType, chartAppearance));
      } catch {
        try {
          if (chartRef.current && seriesRef.current) {
            chartRef.current.removeSeries(seriesRef.current);
          }
        } catch {}

        const seriesOptions = getSeriesOptions(chartType, chartAppearance);
        seriesRef.current =
          chartType === "line"
            ? chartRef.current.addLineSeries(seriesOptions)
            : chartRef.current.addCandlestickSeries(seriesOptions);
      }
    }

    renderedDataRef.current = processedData;
    seriesRef.current.setData(formattedSeriesData);

    const lastPrice =
      formattedSeriesData.length > 0
        ? formattedSeriesData[formattedSeriesData.length - 1]?.close ||
          formattedSeriesData[formattedSeriesData.length - 1]?.value ||
          0
        : 0;
    const priceFormat = getPriceFormat(lastPrice, currency);

    if (seriesRef.current) seriesRef.current.applyOptions({ priceFormat });
    const visibleBars = INITIAL_VISIBLE_BARS_BY_TIMEFRAME[currentTimeframe] ?? 120;
    focusLatestBars(chartRef.current, formattedSeriesData.length, visibleBars);
    focusLatestBars(macdChartRef.current, formattedSeriesData.length, visibleBars);
  }, [
    chartAppearance,
    chartType,
    currency,
    currentTimeframe,
    formattedSeriesData,
    processedData,
  ]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    if (emaSeriesRef.current) {
      try {
        chartRef.current.removeSeries(emaSeriesRef.current);
      } catch {}
      emaSeriesRef.current = null;
    }

    if (emaData.length === 0) {
      return;
    }

    emaSeriesRef.current = chartRef.current.addLineSeries({
      color: chartAppearance?.lineColor ?? "rgba(255, 165, 0, 0.8)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    emaSeriesRef.current.setData(emaData);
  }, [chartAppearance?.lineColor, emaData]);

  useEffect(() => {
    if (!macdChartRef.current) {
      return;
    }

    if (macdSeriesRef.current) {
      try {
        macdChartRef.current.removeSeries(macdSeriesRef.current);
      } catch {}
      macdSeriesRef.current = null;
    }
    if (signalSeriesRef.current) {
      try {
        macdChartRef.current.removeSeries(signalSeriesRef.current);
      } catch {}
      signalSeriesRef.current = null;
    }
    if (histogramSeriesRef.current) {
      try {
        macdChartRef.current.removeSeries(histogramSeriesRef.current);
      } catch {}
      histogramSeriesRef.current = null;
    }

    if (!macdData) {
      return;
    }

    macdSeriesRef.current = macdChartRef.current.addLineSeries({
      color: "blue",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    signalSeriesRef.current = macdChartRef.current.addLineSeries({
      color: "orange",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    histogramSeriesRef.current = macdChartRef.current.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
    });

    macdSeriesRef.current.setData(macdData.macdLine);
    signalSeriesRef.current.setData(macdData.signalLine);
    histogramSeriesRef.current.setData(macdData.histogramData);
  }, [macdData]);

  useEffect(() => {
    if (!onRegisterActions) return undefined;

    const captureScreenshot = () => {
      if (!chartRef.current) return false;

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

  return {
    renderedDataRef,
    seriesRef,
  };
}
