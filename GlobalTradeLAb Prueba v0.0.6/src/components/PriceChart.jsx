import React, { useCallback, useEffect, useRef, useState } from "react";
import { BellPlus, Minus, ShoppingCart, TrendingDown, TrendingUp, X } from "lucide-react";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import ChartHeader from "./PriceChart/ChartHeader";
import ChartToolSidebar from "./ChartToolSidebar";
import { useChartData } from "./PriceChart/hooks/useChartData";
import { useIndicatorsData } from "./PriceChart/hooks/useIndicatorsData";
import { useDrawingTools } from "./PriceChart/hooks/useDrawingTools";
import { usePriceOverlay } from "./PriceChart/hooks/usePriceOverlay";
import { useMainChart } from "./PriceChart/hooks/useMainChart";
import { useMacdChart } from "./PriceChart/hooks/useMacdChart";
import { useTranslation } from "react-i18next";
import DrawingLayer from "./PriceChart/drawings/DrawingLayer";

const PriceChart = ({
  chartType,
  currentTimeframe,
  isFullScreen,
  setIsFullScreen,
  chartAppearance,
  onRegisterActions,
  onDrawingWorkspaceChange,
  activeTool,
  setActiveTool,
  showToolSidebar = true,
  showEMA,
  emaPeriod,
  showMACD,
}) => {
  const { t } = useTranslation();
  const chartContainerRef = useRef(null);
  const macdChartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const renderedDataRef = useRef([]);
  const syncMacdVisibilityRef = useRef(() => {});
  const [magnetMode, setMagnetMode] = useState("weak");
  const [keepToolActive, setKeepToolActive] = useState(false);

  const {
    selectedSymbol,
    initialSymbols,
    marketData = {},
    preferencesState,
    reportChartSnapshot,
    user,
  } = useTradingWorkspace();
  const selectedMarketData = marketData[selectedSymbol] ?? [];
  const currentSymbolInfo = initialSymbols.find((symbol) => symbol.id === selectedSymbol);
  const currency = currentSymbolInfo ? currentSymbolInfo.currency : "USD";
  const preferredTimezone = preferencesState?.timezone || user?.timezone || null;
  const chartTimezone = preferredTimezone;
  const chartLocale = user?.language === "en" ? "en-US" : "es-CO";
  const cacheScopeKey = user?.id || user?.user_id || user?.email || "anonymous";

  const {
    formattedSeriesData,
    hasReachedOldestHistory,
    historyLimit,
    isLoadingOlderHistory,
    loadOlderHistory,
    progressiveHistoryEnabled,
    renderedData,
    processedData,
    visibleOhlcData,
  } = useChartData({
    cacheScopeKey,
    chartType,
    currentTimeframe,
    preferredTimezone,
    selectedMarketData,
    selectedSymbol,
  });

  const { overlayStudies, paneStudies } = useIndicatorsData({
    chartAppearance,
    emaPeriod,
    historyLimit,
    processedData,
    preferredTimezone,
    selectedSymbol,
    showEMA,
    showMACD,
    timeframe: currentTimeframe,
  });

  const drawings = useDrawingTools({
    activeTool,
    chartContainerRef,
    chartRef,
    currentTimeframe,
    keepToolActive,
    magnetMode,
    ownerId: user?.id || user?.user_id || null,
    renderedDataRef,
    selectedSymbol,
    seriesRef,
    setActiveTool,
  });

  const overlay = usePriceOverlay({
    chartContainerRef,
    renderedDataRef,
    seriesRef,
  });

  const handleSyncMacdVisibility = useCallback(() => {
    syncMacdVisibilityRef.current?.();
  }, []);

  const handleChartCrosshairMove = useCallback((param) => {
    overlay.handleCrosshairMove(param);
    drawings.handleCrosshairMove(param);
  }, [drawings.handleCrosshairMove, overlay.handleCrosshairMove]);

  const requestClearDrawings = useCallback(() => {
    if (window.confirm(t("priceChart.drawings.clearConfirm"))) {
      drawings.clearDrawingObjects();
    }
  }, [drawings.clearDrawingObjects, t]);

  const { chartRevision } = useMainChart({
    chartAppearance,
    chartLocale,
    chartTimezone,
    chartType,
    chartRef,
    containerRef: chartContainerRef,
    currency,
    currentTimeframe,
    formattedSeriesData,
    isFullScreen,
    onChartClick: drawings.handleChartClick,
    onCrosshairMove: handleChartCrosshairMove,
    onRegisterActions,
    processedData,
    renderedDataRef,
    seriesRef,
    selectedSymbol,
    showMACD,
    overlayStudies,
    onLoadOlderHistory: loadOlderHistory,
    progressiveHistoryEnabled,
    syncMacdVisibility: handleSyncMacdVisibility,
  });

  useEffect(() => {
    onDrawingWorkspaceChange?.({
      symbol: selectedSymbol,
      timeframe: currentTimeframe,
      drawings: drawings.drawingObjects,
      selectedDrawingId: drawings.selectedDrawingId,
      persistenceState: drawings.persistenceState,
      persistenceError: drawings.persistenceError?.message || null,
      actions: {
        select: drawings.selectDrawing,
        update: drawings.updateDrawing,
        remove: drawings.removeDrawing,
        duplicate: drawings.duplicateDrawing,
        reorder: drawings.reorderDrawing,
        clear: drawings.clearDrawingObjects,
        undo: drawings.undo,
        redo: drawings.redo,
      },
    });
  }, [
    currentTimeframe,
    drawings.clearDrawingObjects,
    drawings.drawingObjects,
    drawings.duplicateDrawing,
    drawings.persistenceError,
    drawings.persistenceState,
    drawings.redo,
    drawings.removeDrawing,
    drawings.reorderDrawing,
    drawings.selectDrawing,
    drawings.selectedDrawingId,
    drawings.undo,
    drawings.updateDrawing,
    onDrawingWorkspaceChange,
    selectedSymbol,
  ]);

  useEffect(() => () => onDrawingWorkspaceChange?.(null), [onDrawingWorkspaceChange]);

  const { syncMacdVisibility } = useMacdChart({
    chartAppearance,
    chartLocale,
    chartRef,
    chartTimezone,
    currentTimeframe,
    formattedSeriesData,
    isFullScreen,
    macdContainerRef: macdChartContainerRef,
    paneStudy: paneStudies[0] ?? null,
    showMACD,
  });

  useEffect(() => {
    syncMacdVisibilityRef.current = syncMacdVisibility;
  }, [syncMacdVisibility]);

  useEffect(() => {
    if (!isFullScreen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && drawings.interactionMode === "idle" && !activeTool) {
        setIsFullScreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, drawings.interactionMode, isFullScreen, setIsFullScreen]);

  const currentOHLC = visibleOhlcData.length > 0 ? visibleOhlcData[visibleOhlcData.length - 1] : {};
  const previousOHLC = visibleOhlcData.length > 1 ? visibleOhlcData[visibleOhlcData.length - 2] : {};
  const currentPrice = currentOHLC.close || 0;
  const prevPrice = previousOHLC.close || 0;
  const priceChange = currentPrice - prevPrice;
  const priceChangePercent = prevPrice !== 0 ? (priceChange / prevPrice) * 100 : 0;

  useEffect(() => {
    if (!selectedSymbol || !currentOHLC?.time || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      return;
    }

    reportChartSnapshot?.(selectedSymbol, {
      time: currentOHLC.time,
      price: currentPrice,
      change: priceChangePercent,
      currency,
    });
  }, [currency, currentOHLC?.time, currentPrice, priceChangePercent, reportChartSnapshot, selectedSymbol]);

  const chartWrapperClass = isFullScreen
    ? "flex h-full min-h-0 flex-1 flex-col bg-background p-3"
    : "app-chrome-panel rounded-none border-x-0 p-3 flex h-[min(42vh,500px)] min-h-[570px] flex-col xl:h-[min(46vh,540px)]";

  return (
    <div className={chartWrapperClass}>
      <ChartHeader
        currentSymbolInfo={currentSymbolInfo}
        selectedSymbol={selectedSymbol}
        ohlc={currentOHLC}
        hoverOhlc={overlay.hoveredCandle}
        currentPrice={currentPrice}
        priceChange={priceChange}
        priceChangePercent={priceChangePercent}
        currency={currency}
        chartAppearance={chartAppearance}
        clearDrawings={requestClearDrawings}
        hasDrawings={drawings.hasDrawings}
      />

      <div
        className="relative flex-1 min-h-0"
        onPointerMove={overlay.handlePointerMoveOverChartArea}
        onPointerLeave={overlay.clearPriceOverlay}
      >
        <ChartToolSidebar
          activeTool={activeTool}
          keepToolActive={keepToolActive}
          magnetMode={magnetMode}
          onSelectTool={setActiveTool}
          onClear={drawings.clearDrawingObjects}
          onSetKeepToolActive={setKeepToolActive}
          onSetMagnetMode={setMagnetMode}
          isPinned={showToolSidebar}
          className="absolute inset-y-0 left-0 z-30"
        />

        <div
          className={`chart-container h-full min-h-0 ${overlay.isOverPriceUI ? "cursor-default" : "cursor-crosshair"}`}
          ref={chartContainerRef}
          style={{ height: "100%" }}
        />

        <DrawingLayer
          activeTool={activeTool}
          chartContainerRef={chartContainerRef}
          chartRef={chartRef}
          chartRevision={chartRevision}
          currency={currency}
          currentTimeframe={currentTimeframe}
          drawings={drawings.visibleDrawings}
          onBeginDrag={drawings.beginDrag}
          onDuplicate={drawings.duplicateDrawing}
          onRemove={drawings.removeDrawing}
          onReorder={drawings.reorderDrawing}
          onSelect={drawings.selectDrawing}
          onUpdate={drawings.updateDrawing}
          previewDrawing={drawings.previewDrawing}
          renderedDataRef={renderedDataRef}
          selectedDrawing={drawings.selectedDrawing}
          selectedDrawingId={drawings.selectedDrawingId}
          seriesRef={seriesRef}
        />

        {progressiveHistoryEnabled && isLoadingOlderHistory ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-md">
            {t("priceChart.historyStatus.loadingOlder")}
          </div>
        ) : null}

        {progressiveHistoryEnabled && !isLoadingOlderHistory && hasReachedOldestHistory ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-md">
            {t("priceChart.historyStatus.noOlderData")}
          </div>
        ) : null}

        {progressiveHistoryEnabled && !isLoadingOlderHistory && hasReachedOldestHistory ? (
          <div className="pointer-events-none absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-r-md border border-l-0 border-border/80 bg-background/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-md">
            {t("priceChart.historyStatus.noOlderData")}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-10">
          {overlay.displayPriceMarker ? (
            <>
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-border/80"
                style={{ top: overlay.displayPriceMarker.y }}
              />
              <div
                ref={overlay.priceTriggerRef}
                className="pointer-events-auto absolute right-3 flex items-center gap-2 cursor-default"
                style={{ top: Math.max(8, overlay.displayPriceMarker.y - 14) }}
                onPointerEnter={overlay.handlePriceOverlayEnter}
                onPointerLeave={overlay.handlePriceOverlayLeave}
              >
                <button
                  type="button"
                  onClick={overlay.handlePriceMenuToggle}
                  className={`app-chrome-panel flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition ${
                    overlay.isPriceMenuOpen
                      ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-300"
                      : "border-border/80 hover:bg-accent"
                  }`}
                  title={t("priceChart.priceActions.title")}
                  aria-expanded={overlay.isPriceMenuOpen}
                  aria-label={t("priceChart.priceActions.openAriaLabel")}
                >
                  <BellPlus className="h-3.5 w-3.5" />
                </button>
                <div className="pointer-events-none app-chrome-panel rounded-l-md border border-border/80 px-2 py-1 text-[12px] font-semibold text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                  {overlay.displayPriceMarker.price.toFixed(currency === "USD" ? 2 : 4)}
                </div>
              </div>

              {overlay.isPriceMenuOpen ? (
                <div
                  ref={overlay.priceMenuRef}
                  className="pointer-events-auto app-chrome-panel absolute w-[280px] overflow-hidden rounded-[16px] border border-border/80 text-foreground shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
                  style={{ top: overlay.priceMenuTop, right: overlay.priceActionMenuRightOffset }}
                  onPointerEnter={overlay.handlePriceOverlayEnter}
                  onPointerLeave={overlay.handlePriceOverlayLeave}
                >
                  <div className="flex items-center justify-end border-b border-border/70 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        overlay.setIsPriceMenuOpen(false);
                        overlay.setIsOverPriceUI(false);
                        overlay.setLockedPriceMarker(null);
                      }}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                      title={t("common.actions.close")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-3 border-b border-border/70 px-4 py-3 text-left text-sm hover:bg-accent/60">
                    <BellPlus className="h-4 w-4 text-emerald-300" />
                    <span>{t("priceChart.priceActions.addAlert", { symbol: selectedSymbol, price: overlay.displayPriceMarker.price.toFixed(3) })}</span>
                  </button>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-3 border-b border-border/70 px-4 py-3 text-left text-sm hover:bg-accent/60">
                    <TrendingDown className="h-4 w-4 text-rose-300" />
                    <span>{t("priceChart.priceActions.sellLimit", { symbol: selectedSymbol, price: overlay.displayPriceMarker.price.toFixed(3) })}</span>
                  </button>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-3 border-b border-border/70 px-4 py-3 text-left text-sm hover:bg-accent/60">
                    <TrendingUp className="h-4 w-4 text-emerald-300" />
                    <span>{t("priceChart.priceActions.buyStop", { symbol: selectedSymbol, price: overlay.displayPriceMarker.price.toFixed(3) })}</span>
                  </button>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-3 border-b border-border/70 px-4 py-3 text-left text-sm hover:bg-accent/60">
                    <ShoppingCart className="h-4 w-4 text-sky-300" />
                    <span>{t("priceChart.priceActions.addOrder", { symbol: selectedSymbol, price: overlay.displayPriceMarker.price.toFixed(3) })}</span>
                  </button>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent/60">
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span>{t("priceChart.priceActions.drawLine", { price: overlay.displayPriceMarker.price.toFixed(3) })}</span>
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {showMACD ? <div className="macd-chart-container mt-1 h-[120px] shrink-0" ref={macdChartContainerRef} /> : null}
    </div>
  );
};

export default PriceChart;
