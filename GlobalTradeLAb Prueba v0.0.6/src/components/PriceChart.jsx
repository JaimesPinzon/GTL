import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart2, BellPlus, Check, ChevronDown, Eye, EyeOff, Minus, Settings, ShoppingCart, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ChartHeader from "./PriceChart/ChartHeader";
import ChartToolSidebar from "./ChartToolSidebar";
import { useChartData } from "./PriceChart/hooks/useChartData";
import { useIndicatorsData } from "./PriceChart/hooks/useIndicatorsData";
import { useDrawingTools } from "./PriceChart/hooks/useDrawingTools";
import { usePriceOverlay } from "./PriceChart/hooks/usePriceOverlay";
import { useMainChart } from "./PriceChart/hooks/useMainChart";
import { useMacdChart } from "./PriceChart/hooks/useMacdChart";
import {
  MAX_INDICATOR_PANE_HEIGHT,
  MIN_INDICATOR_PANE_HEIGHT,
  useResizableIndicatorPane,
} from "./PriceChart/hooks/useResizableIndicatorPane";
import { useTranslation } from "react-i18next";
import DrawingLayer from "./PriceChart/drawings/DrawingLayer";
import { getDrawingLabelKey } from "./PriceChart/drawings/drawingRegistry";
import { useSearchParams } from "react-router-dom";
import { fetchNews } from "@/lib/news-api";
import { buildNewsChartMarkers } from "@/lib/news-chart-markers";
import { resolveMarketSnapshot } from "@/lib/market-price";

const getCreationHintKey = (tool, pointCount) => {
  if (tool === "polyline") return "priceChart.drawings.creation.polyline";
  if (["longPosition", "shortPosition"].includes(tool)) {
    return [
      "priceChart.drawings.creation.positionEntry",
      "priceChart.drawings.creation.positionStop",
      "priceChart.drawings.creation.positionTarget",
    ][Math.min(pointCount, 2)];
  }
  if (tool === "fibonacciExtension") {
    return [
      "priceChart.drawings.creation.impulseStart",
      "priceChart.drawings.creation.impulseEnd",
      "priceChart.drawings.creation.retracementEnd",
    ][Math.min(pointCount, 2)];
  }
  return "priceChart.drawings.creation.clickToPlace";
};

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
  indicatorInstances = [],
  onOpenIndicatorSettings,
  onRemoveIndicator,
  onToggleIndicatorVisibility,
  showEMA,
  emaPeriod,
  showMACD,
}) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const chartContainerRef = useRef(null);
  const macdChartContainerRef = useRef(null);
  const chartPanelsContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const renderedDataRef = useRef([]);
  const syncMacdVisibilityRef = useRef(() => {});
  const indicatorMenuRef = useRef(null);
  const [magnetMode, setMagnetMode] = useState("weak");
  const [keepToolActive, setKeepToolActive] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState(false);
  const [symbolNews, setSymbolNews] = useState([]);

  const {
    selectedSymbol,
    activeClass,
    activeClassId,
    initialSymbols,
    preferencesState,
    quoteData = {},
    reportChartSnapshot,
    user,
  } = useTradingWorkspace();
  const marketSnapshot = useMemo(
    () => resolveMarketSnapshot({ quote: quoteData[selectedSymbol] }),
    [quoteData, selectedSymbol]
  );
  const currentSymbolInfo = initialSymbols.find((symbol) => symbol.id === selectedSymbol);
  const currency = currentSymbolInfo ? currentSymbolInfo.currency : "USD";
  const preferredTimezone = preferencesState?.timezone || user?.timezone || null;
  const chartTimezone = preferredTimezone;
  const chartLocale = user?.language === "en" ? "en-US" : "es-CO";
  const cacheScopeKey = user?.id || user?.user_id || user?.email || "anonymous";
  const currentUserId = user?.id || user?.user_id || null;
  const canManageEducationalDrawings = user?.role === "teacher" || ["teacher", "monitor"].includes(activeClass?.membershipRole);
  const focusedNewsId = searchParams.get("news");
  const indicatorPane = useResizableIndicatorPane({
    containerRef: chartPanelsContainerRef,
    storageKey: `gtl:indicator-pane-height:v1:${cacheScopeKey}`,
  });
  const indicatorDividerColor = chartAppearance?.indicatorDividerColor ?? "#475569";
  const indicatorDividerThickness = Math.min(4, Math.max(1, Number(chartAppearance?.indicatorDividerThickness) || 1));

  useEffect(() => {
    if (!isIndicatorMenuOpen) return undefined;

    const closeIndicatorMenu = (event) => {
      if (!indicatorMenuRef.current?.contains(event.target)) {
        setIsIndicatorMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeIndicatorMenu);
    return () => window.removeEventListener("pointerdown", closeIndicatorMenu);
  }, [isIndicatorMenuOpen]);

  useEffect(() => {
    if (indicatorInstances.length === 0) setIsIndicatorMenuOpen(false);
  }, [indicatorInstances.length]);

  const {
    formattedSeriesData,
    hasReachedOldestHistory,
    historyLimit,
    isInitialHistoryLoading,
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
    marketSnapshot,
    selectedSymbol,
  });

  const { overlayStudies, paneStudies } = useIndicatorsData({
    chartAppearance,
    emaPeriod,
    historyLimit,
    indicatorInstances,
    processedData,
    preferredTimezone,
    selectedSymbol,
    showEMA,
    showMACD,
    timeframe: currentTimeframe,
  });

  useEffect(() => {
    let mounted = true;
    if (!selectedSymbol) {
      setSymbolNews([]);
      return undefined;
    }
    fetchNews({ symbol: selectedSymbol, sort: "latest", limit: 40 })
      .then((result) => { if (mounted) setSymbolNews(result.articles || []); })
      .catch(() => { if (mounted) setSymbolNews([]); });
    return () => { mounted = false; };
  }, [selectedSymbol]);

  const newsMarkers = useMemo(() => buildNewsChartMarkers(symbolNews, formattedSeriesData, focusedNewsId), [focusedNewsId, formattedSeriesData, symbolNews]);

  const drawings = useDrawingTools({
    activeTool,
    chartContainerRef,
    chartRef,
    classId: activeClassId,
    currentTimeframe,
    keepToolActive,
    magnetMode,
    ownerId: currentUserId,
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
    setIsClearDialogOpen(true);
  }, []);

  const confirmClearDrawings = useCallback(() => {
    drawings.clearDrawingObjects();
    setIsClearDialogOpen(false);
  }, [drawings.clearDrawingObjects]);

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
    isHistoryReady: !isInitialHistoryLoading && formattedSeriesData.length > 0,
    isFullScreen,
    newsMarkers,
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
    oldestRenderedTime: processedData[0]?.time ?? null,
    progressiveHistoryEnabled,
    syncMacdVisibility: handleSyncMacdVisibility,
  });

  useEffect(() => {
    onDrawingWorkspaceChange?.({
      symbol: selectedSymbol,
      timeframe: currentTimeframe,
      classId: activeClassId,
      currentUserId,
      drawings: drawings.drawingObjects,
      selectedDrawingId: drawings.selectedDrawingId,
      persistenceState: drawings.persistenceState,
      persistenceError: drawings.persistenceError?.message || null,
      actions: {
        select: drawings.selectDrawing,
        update: drawings.updateDrawing,
        remove: drawings.removeDrawing,
        duplicate: drawings.duplicateDrawing,
        copyStyle: drawings.copyDrawingStyle,
        pasteStyle: drawings.pasteDrawingStyle,
        reorder: drawings.reorderDrawing,
        setHidden: drawings.setDrawingHidden,
        clear: drawings.clearDrawingObjects,
        undo: drawings.undo,
        redo: drawings.redo,
      },
    });
  }, [
    currentTimeframe,
    activeClassId,
    currentUserId,
    drawings.clearDrawingObjects,
    drawings.copyDrawingStyle,
    drawings.drawingObjects,
    drawings.duplicateDrawing,
    drawings.persistenceError,
    drawings.persistenceState,
    drawings.pasteDrawingStyle,
    drawings.redo,
    drawings.removeDrawing,
    drawings.reorderDrawing,
    drawings.selectDrawing,
    drawings.setDrawingHidden,
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
    formattedSeriesData,
    isFullScreen,
    macdContainerRef: macdChartContainerRef,
    paneStudy: paneStudies[0] ?? null,
    seriesRef,
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
      />

      <div ref={chartPanelsContainerRef} className="relative flex min-h-0 flex-1 flex-col">
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
          className="relative min-h-0 flex-1"
          onPointerMove={overlay.handlePointerMoveOverChartArea}
          onPointerLeave={overlay.clearPriceOverlay}
        >

        <div
          className={`chart-container h-full min-h-0 ${overlay.isOverPriceUI ? "cursor-default" : "cursor-crosshair"}`}
          ref={chartContainerRef}
          style={{ height: "100%" }}
        />

          {indicatorInstances.length ? (
            <div
              ref={indicatorMenuRef}
              className="pointer-events-auto absolute top-3 z-[25]"
              style={{ left: showToolSidebar ? 56 : 12 }}
            >
              <button
                type="button"
                onClick={() => setIsIndicatorMenuOpen((open) => !open)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border shadow-lg transition ${
                  isIndicatorMenuOpen
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "app-chrome-panel border-border/80 text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
                title={t("priceChart.indicators.quickMenu")}
                aria-expanded={isIndicatorMenuOpen}
              >
                <BarChart2 className="h-4 w-4" />
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {indicatorInstances.length}
                </span>
              </button>

              {isIndicatorMenuOpen ? (
                <div className="app-chrome-strong absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">{t("priceChart.indicators.applied")}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {indicatorInstances.map((instance) => (
                      <div key={instance.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-accent/50">
                        <div className={`h-2 w-2 shrink-0 rounded-full ${instance.visible ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {instance.id === "ema"
                              ? `EMA ${instance.parameters.period}`
                              : `MACD ${instance.parameters.shortPeriod} ${instance.parameters.longPeriod} ${instance.parameters.signalPeriod}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {instance.visible ? t("priceChart.indicators.visible") : t("priceChart.indicators.hidden")}
                          </p>
                        </div>
                        <button type="button" onClick={() => onToggleIndicatorVisibility?.(instance.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title={instance.visible ? t("priceChart.indicators.hide") : t("priceChart.indicators.show")}>
                          {instance.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={() => { setIsIndicatorMenuOpen(false); onOpenIndicatorSettings?.(instance.id); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title={t("priceChart.indicators.settings")}><Settings className="h-4 w-4" /></button>
                        <button type="button" onClick={() => onRemoveIndicator?.(instance.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400" title={t("priceChart.indicators.remove")}><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

        {newsMarkers.length ? <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-sky-400/25 bg-background/90 px-3 py-1 text-[11px] font-medium text-sky-300 shadow-md">{t("priceChart.newsMarkers.count", { count: newsMarkers.length })}</div> : null}

        <DrawingLayer
          activeTool={activeTool}
          chartContainerRef={chartContainerRef}
          chartRef={chartRef}
          chartRevision={chartRevision}
          currency={currency}
          currentTimeframe={currentTimeframe}
          activeClassId={activeClassId}
          canManageEducationalDrawings={canManageEducationalDrawings}
          currentUserId={currentUserId}
          toolbarInsetLeft={(showToolSidebar ? 56 : 8) + (indicatorInstances.length ? 48 : 0)}
          drawings={drawings.visibleDrawings}
          hasCopiedStyle={drawings.hasCopiedStyle}
          onBeginDrag={drawings.beginDrag}
          onCopyStyle={drawings.copyDrawingStyle}
          onDuplicate={drawings.duplicateDrawing}
          onPasteStyle={drawings.pasteDrawingStyle}
          onRemove={drawings.removeDrawing}
          onReorder={drawings.reorderDrawing}
          onSelect={drawings.selectDrawing}
          onSetHidden={drawings.setDrawingHidden}
          onSetExplanationVisible={drawings.setDrawingExplanationVisible}
          onUpdate={drawings.updateDrawing}
          previewDrawing={drawings.previewDrawing}
          renderedDataRef={renderedDataRef}
          selectedDrawing={drawings.selectedDrawing}
          selectedDrawingId={drawings.selectedDrawingId}
          seriesRef={seriesRef}
        />

        {activeTool ? (
          <div className="app-chrome-strong pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border/80 px-3 py-2 text-xs shadow-xl">
            <span className="font-semibold text-foreground">{t(getDrawingLabelKey(activeTool))}</span>
            <span className="max-w-64 truncate text-muted-foreground">
              {t(getCreationHintKey(activeTool, drawings.tempDrawingPoints.length))}
              {" · "}
              {t("priceChart.drawings.creation.points", { count: drawings.tempDrawingPoints.length })}
            </span>
            {activeTool === "polyline" && drawings.tempDrawingPoints.length >= 2 ? (
              <button
                type="button"
                onClick={drawings.finishPolyline}
                className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 font-semibold text-primary-foreground"
              >
                <Check className="h-3.5 w-3.5" />
                {t("priceChart.drawings.creation.finish")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => drawings.cancelCurrentDrawing()}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              {t("common.actions.cancel")}
            </button>
          </div>
        ) : null}

        {isInitialHistoryLoading ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-md">
            {t("priceChart.historyStatus.loadingInitial")}
          </div>
        ) : null}

        {progressiveHistoryEnabled && !isInitialHistoryLoading && isLoadingOlderHistory ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-md">
            {t("priceChart.historyStatus.loadingOlder")}
          </div>
        ) : null}

        {progressiveHistoryEnabled && !isInitialHistoryLoading && !isLoadingOlderHistory && hasReachedOldestHistory ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border/80 bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-md">
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
                className="pointer-events-auto absolute right-[88px] flex items-center cursor-default"
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

        {showMACD ? (
          <>
            <div
              role="separator"
              tabIndex={0}
              aria-label={t("priceChart.indicators.resizePane")}
              aria-orientation="horizontal"
              aria-valuemin={MIN_INDICATOR_PANE_HEIGHT}
              aria-valuemax={MAX_INDICATOR_PANE_HEIGHT}
              aria-valuenow={indicatorPane.height}
              className={`group relative z-30 flex h-2.5 shrink-0 touch-none cursor-row-resize items-center justify-center outline-none transition-colors focus-visible:bg-primary/10 ${
                indicatorPane.isResizing ? "bg-primary/10" : "hover:bg-primary/5"
              }`}
              onDoubleClick={indicatorPane.resetHeight}
              onKeyDown={indicatorPane.handleKeyDown}
              onPointerCancel={indicatorPane.handlePointerCancel}
              onPointerDown={indicatorPane.handlePointerDown}
              onPointerMove={indicatorPane.handlePointerMove}
              onPointerUp={indicatorPane.handlePointerUp}
              title={t("priceChart.indicators.resizePaneHint")}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 transition-opacity group-hover:opacity-100"
                style={{ backgroundColor: indicatorDividerColor, height: indicatorDividerThickness }}
              />
              <span
                aria-hidden="true"
                className="relative h-1 w-10 rounded-full opacity-70 shadow-sm transition group-hover:w-14 group-hover:opacity-100 group-focus-visible:w-14 group-focus-visible:opacity-100"
                style={{ backgroundColor: indicatorDividerColor }}
              />
            </div>
            <div
              className="macd-chart-container min-h-0 shrink-0"
              ref={macdChartContainerRef}
              style={{ height: indicatorPane.height }}
            />
          </>
        ) : null}
      </div>

      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="app-chrome-strong overflow-hidden border border-primary/20 bg-background/95 p-0 shadow-[0_28px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:max-w-md">
          <div className="h-1 bg-gradient-to-r from-primary/20 via-primary to-cyan-400/30" />
          <div className="p-6">
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 text-rose-400 shadow-[0_10px_30px_rgba(244,63,94,0.12)]">
                <Trash2 className="h-5 w-5" />
              </div>
              <DialogTitle>{t("priceChart.drawings.clearDialogTitle")}</DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                {t("priceChart.drawings.clearDialogDescription", { symbol: selectedSymbol })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 grid grid-cols-2 gap-3 sm:grid sm:grid-cols-2 sm:space-x-0">
              <button
                type="button"
                onClick={() => setIsClearDialogOpen(false)}
                className="h-10 rounded-xl border border-border/80 bg-secondary/50 px-4 text-sm font-semibold text-foreground transition hover:bg-accent"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmClearDrawings}
                className="h-10 rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25"
              >
                {t("priceChart.drawings.clearDialogConfirm")}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PriceChart;
