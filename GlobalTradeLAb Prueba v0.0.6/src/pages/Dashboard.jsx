import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import PriceChart from "@/components/PriceChart";
import TradingActionBar from "@/components/TradingActionBar";
import { DEFAULT_TIMEFRAME } from "@/lib/market-timeframes";
import TradeSidePanel from "@/components/TradeSidePanel";
import MarketSearchOverlay from "@/components/MarketSearchOverlay";
import IndicatorsOverlay from "@/components/IndicatorsOverlay";
import AlertOverlay from "@/components/AlertOverlay";
import ChartAppearanceOverlay from "@/components/ChartAppearanceOverlay";
import ChartTypeOverlay from "@/components/ChartTypeOverlay";
import WorkspaceUtilityRail from "@/components/WorkspaceUtilityRail";
import DashboardWidgetShelf from "@/components/DashboardWidgetShelf";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import {
  MAX_ACTIVE_INDICATORS,
  useIndicatorManager,
} from "@/components/PriceChart/hooks/useIndicatorManager";

const createDefaultChartAppearance = () => ({
  backgroundColor: "transparent",
  upColor: "#22c55e",
  downColor: "#ef4444",
  lineColor: "#f59e0b",
  indicatorDividerColor: "#475569",
  indicatorDividerThickness: 1,
  bodyEnabled: true,
  borderEnabled: true,
  wickEnabled: true,
  paletteTarget: "upColor",
});

const Dashboard = () => {
  const { selectedSymbol, user } = useTradingWorkspace();
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [isMarketSearchOpen, setIsMarketSearchOpen] = useState(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isChartTypeOpen, setIsChartTypeOpen] = useState(false);
  const [chartType, setChartType] = useState("candlestick");
  const [currentTimeframe, setCurrentTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [isChartFullScreen, setIsChartFullScreen] = useState(false);
  const [indicatorEditorId, setIndicatorEditorId] = useState(null);
  const [chartSideTool, setChartSideTool] = useState(null);
  const [isChartToolSidebarPinned, setIsChartToolSidebarPinned] = useState(true);
  const [isWorkspaceUtilityRailPinned, setIsWorkspaceUtilityRailPinned] = useState(true);
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState(null);
  const [chartActions, setChartActions] = useState(null);
  const [drawingWorkspace, setDrawingWorkspace] = useState(null);
  const [chartAppearance, setChartAppearance] = useState(createDefaultChartAppearance);
  const indicatorManager = useIndicatorManager(user?.id || user?.user_id || user?.email || "anonymous");
  const emaInstance = indicatorManager.instances.find((instance) => instance.id === "ema");
  const macdInstance = indicatorManager.instances.find((instance) => instance.id === "macd");
  const showEMA = Boolean(emaInstance?.active && emaInstance?.visible);
  const showMACD = Boolean(macdInstance?.active && macdInstance?.visible);
  const emaPeriod = emaInstance?.parameters?.period ?? 20;

  const workspaceColumns = useMemo(
    () => (isWorkspaceUtilityRailPinned ? "minmax(0,1fr) 48px" : "minmax(0,1fr) 0px"),
    [isWorkspaceUtilityRailPinned]
  );

  const resetAppearance = () => setChartAppearance(createDefaultChartAppearance());
  const handleAppearanceChange = (field, value) =>
    setChartAppearance((previous) => ({ ...previous, [field]: value }));
  const clearChartSideTool = () => setChartSideTool(null);

  const handleCaptureChart = () => {
    chartActions?.captureScreenshot?.();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.dispatchEvent(
      new CustomEvent("gtl:chart-fullscreen-change", {
        detail: { isFullScreen: isChartFullScreen },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("gtl:chart-fullscreen-change", {
          detail: { isFullScreen: false },
        })
      );
    };
  }, [isChartFullScreen]);

  return (
    <div
      className={
        isChartFullScreen
          ? "fixed inset-0 z-40 flex min-h-0 min-w-0 flex-col bg-background"
          : "flex h-full min-h-0 min-w-0 flex-col bg-background"
      }
    >
      <div className="sticky top-0 z-30">
        <TradingActionBar
          chartType={chartType}
          setChartType={setChartType}
          currentTimeframe={currentTimeframe}
          setCurrentTimeframe={setCurrentTimeframe}
          onOpenChartTypes={() => setIsChartTypeOpen(true)}
          onOpenIndicators={() => setIsIndicatorsOpen(true)}
          onOpenAlert={() => setIsAlertOpen(true)}
          onOpenAppearance={() => setIsAppearanceOpen(true)}
          isChartFullScreen={isChartFullScreen}
          onToggleFullScreen={() => setIsChartFullScreen((previous) => !previous)}
          isTradePanelOpen={isTradePanelOpen}
          onTogglePanel={() => setIsTradePanelOpen((previous) => !previous)}
          onOpenMarketSearch={() => setIsMarketSearchOpen(true)}
          onCaptureChart={handleCaptureChart}
          isChartToolSidebarPinned={isChartToolSidebarPinned}
          onToggleChartToolSidebarPinned={() => setIsChartToolSidebarPinned((previous) => !previous)}
          isWorkspaceUtilityRailPinned={isWorkspaceUtilityRailPinned}
          onToggleWorkspaceUtilityRailPinned={() => {
            setIsWorkspaceUtilityRailPinned((previous) => {
              const nextValue = !previous;

              if (!nextValue) {
                setActiveWorkspacePanel(null);
              }

              return nextValue;
            });
          }}
        />
      </div>

      <main className="relative flex-1 overflow-hidden">
        <div
          className={`scrollbar-dashboard h-full overflow-y-auto overflow-x-hidden ${
            isChartFullScreen ? "pb-0 pt-0" : "pb-4 pt-2"
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`flex min-h-0 flex-col ${isChartFullScreen ? "h-full" : "space-y-6"}`}
          >
            <div
              className={`overflow-hidden xl:grid xl:items-stretch ${
                isChartFullScreen ? "h-full flex-1 min-h-0" : "shrink-0"
              }`}
              style={{ gridTemplateColumns: workspaceColumns }}
            >
              <div
                className={`min-w-0 ${isChartFullScreen ? "h-full min-h-0" : ""} ${
                  activeWorkspacePanel && isWorkspaceUtilityRailPinned ? "xl:mr-[320px]" : ""
                }`}
              >
                <PriceChart
                  chartType={chartType}
                  setChartType={setChartType}
                  currentTimeframe={currentTimeframe}
                  setCurrentTimeframe={setCurrentTimeframe}
                  isFullScreen={isChartFullScreen}
                  setIsFullScreen={setIsChartFullScreen}
                  chartAppearance={chartAppearance}
                  onRegisterActions={setChartActions}
                  onDrawingWorkspaceChange={setDrawingWorkspace}
                  activeTool={chartSideTool}
                  setActiveTool={setChartSideTool}
                  showToolSidebar={isChartToolSidebarPinned}
                  indicatorInstances={indicatorManager.activeInstances}
                  onOpenIndicatorSettings={(id) => {
                    setIndicatorEditorId(id);
                    setIsIndicatorsOpen(true);
                  }}
                  onRemoveIndicator={indicatorManager.removeIndicator}
                  onToggleIndicatorVisibility={indicatorManager.toggleVisibility}
                  showEMA={showEMA}
                  emaPeriod={emaPeriod}
                  showMACD={showMACD}
                />
              </div>

              <div className={isWorkspaceUtilityRailPinned ? "min-w-0" : "min-w-0 overflow-hidden"}>
                {isWorkspaceUtilityRailPinned ? (
                  <WorkspaceUtilityRail
                    activePanel={activeWorkspacePanel}
                    drawingWorkspace={drawingWorkspace}
                    onTogglePanel={setActiveWorkspacePanel}
                  />
                ) : null}
              </div>
            </div>

            {isChartFullScreen ? null : (
              <DashboardWidgetShelf selectedSymbol={selectedSymbol} />
            )}
          </motion.div>
          <TradeSidePanel open={isTradePanelOpen} onClose={() => setIsTradePanelOpen(false)} />
        </div>
      </main>

      <MarketSearchOverlay open={isMarketSearchOpen} onClose={() => setIsMarketSearchOpen(false)} />
      <IndicatorsOverlay
        activeInstances={indicatorManager.activeInstances}
        favorites={indicatorManager.favorites}
        initialEditingId={indicatorEditorId}
        instances={indicatorManager.instances}
        maxActiveIndicators={MAX_ACTIVE_INDICATORS}
        onAdd={indicatorManager.addIndicator}
        open={isIndicatorsOpen}
        onClose={() => {
          setIsIndicatorsOpen(false);
          setIndicatorEditorId(null);
        }}
        onRemove={indicatorManager.removeIndicator}
        onReorder={indicatorManager.reorderIndicator}
        onReset={indicatorManager.resetIndicator}
        onToggleFavorite={indicatorManager.toggleFavorite}
        onToggleVisibility={indicatorManager.toggleVisibility}
        onUpdate={indicatorManager.updateIndicator}
      />
      <AlertOverlay open={isAlertOpen} onClose={() => setIsAlertOpen(false)} />
      <ChartTypeOverlay
        open={isChartTypeOpen}
        onClose={() => setIsChartTypeOpen(false)}
        chartType={chartType}
        setChartType={setChartType}
      />
      <ChartAppearanceOverlay
        open={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
        appearance={chartAppearance}
        onChange={handleAppearanceChange}
        onReset={resetAppearance}
      />
    </div>
  );
};

export default Dashboard;
