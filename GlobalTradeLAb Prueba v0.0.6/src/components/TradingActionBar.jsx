import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BellPlus,
  Camera,
  CandlestickChart,
  ChevronDown,
  Expand,
  Grid2x2,
  LayoutGrid,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Settings2,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Button } from "@/components/ui/button";

const TradingActionBar = ({
  chartType,
  currentTimeframe,
  setCurrentTimeframe,
  onOpenChartTypes,
  onOpenIndicators,
  onOpenAlert,
  onOpenAppearance,
  isChartFullScreen,
  onToggleFullScreen,
  isTradePanelOpen,
  onTogglePanel,
  onOpenMarketSearch,
  onCaptureChart,
  isChartToolSidebarPinned,
  onToggleChartToolSidebarPinned,
  isWorkspaceUtilityRailPinned,
  onToggleWorkspaceUtilityRailPinned,
}) => {
  const { t } = useTranslation();
  const { selectedSymbol } = useTradingWorkspace();
  const timeframeGroups = useMemo(
    () => [
      {
        label: t("trading.actionBar.timeframe.minutes"),
        items: [
          { value: "1m", description: t("trading.actionBar.timeframeLabels.oneMinute") },
          { value: "2m", description: t("trading.actionBar.timeframeLabels.twoMinutes") },
          { value: "3m", description: t("trading.actionBar.timeframeLabels.threeMinutes") },
          { value: "4m", description: t("trading.actionBar.timeframeLabels.fourMinutes") },
          { value: "5m", description: t("trading.actionBar.timeframeLabels.fiveMinutes") },
          { value: "10m", description: t("trading.actionBar.timeframeLabels.tenMinutes") },
          { value: "15m", description: t("trading.actionBar.timeframeLabels.fifteenMinutes") },
          { value: "30m", description: t("trading.actionBar.timeframeLabels.thirtyMinutes") },
          { value: "45m", description: t("trading.actionBar.timeframeLabels.fortyFiveMinutes") },
        ],
      },
      {
        label: t("trading.actionBar.timeframe.hours"),
        items: [
          { value: "1H", description: t("trading.actionBar.timeframeLabels.oneHour") },
          { value: "2H", description: t("trading.actionBar.timeframeLabels.twoHours") },
          { value: "3H", description: t("trading.actionBar.timeframeLabels.threeHours") },
          { value: "4H", description: t("trading.actionBar.timeframeLabels.fourHours") },
        ],
      },
      {
        label: t("trading.actionBar.timeframe.days"),
        items: [
          { value: "1D", description: t("trading.actionBar.timeframeLabels.oneDay") },
          { value: "3D", description: t("trading.actionBar.timeframeLabels.threeDays") },
          { value: "5D", description: t("trading.actionBar.timeframeLabels.fiveDays") },
        ],
      },
      {
        label: t("trading.actionBar.timeframe.weeks"),
        items: [
          { value: "1W", description: t("trading.actionBar.timeframeLabels.oneWeek") },
        ],
      },
      {
        label: t("trading.actionBar.timeframe.months"),
        items: [
          { value: "1M", description: t("trading.actionBar.timeframeLabels.oneMonth") },
          { value: "3M", description: t("trading.actionBar.timeframeLabels.threeMonths") },
          { value: "6M", description: t("trading.actionBar.timeframeLabels.sixMonths") },
        ],
      },
      {
        label: t("trading.actionBar.timeframe.years"),
        items: [
          { value: "1Y", description: t("trading.actionBar.timeframeLabels.oneYear") },
          { value: "3Y", description: t("trading.actionBar.timeframeLabels.threeYears") },
          { value: "5Y", description: t("trading.actionBar.timeframeLabels.fiveYears") },
        ],
      },
    ],
    [t]
  );
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => ({
    [t("trading.actionBar.timeframe.minutes")]: true,
    [t("trading.actionBar.timeframe.hours")]: false,
    [t("trading.actionBar.timeframe.days")]: false,
    [t("trading.actionBar.timeframe.weeks")]: false,
    [t("trading.actionBar.timeframe.months")]: false,
    [t("trading.actionBar.timeframe.years")]: false,
  }));
  const timeframeRef = useRef(null);
  const timeframeButtonRef = useRef(null);
  const [timeframePosition, setTimeframePosition] = useState({ top: 72, left: 16 });

  useEffect(() => {
    setExpandedGroups({
      [t("trading.actionBar.timeframe.minutes")]: true,
      [t("trading.actionBar.timeframe.hours")]: false,
      [t("trading.actionBar.timeframe.days")]: false,
      [t("trading.actionBar.timeframe.weeks")]: false,
      [t("trading.actionBar.timeframe.months")]: false,
      [t("trading.actionBar.timeframe.years")]: false,
    });
  }, [t]);

  useEffect(() => {
    const updatePosition = () => {
      const rect = timeframeButtonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      setTimeframePosition({
        top: rect.bottom + 10,
        left: rect.left,
      });
    };

    const handleOutsideClick = (event) => {
      if (!timeframeRef.current?.contains(event.target)) {
        setIsTimeframeOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsTimeframeOpen(false);
      }
    };

    updatePosition();
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, []);

  const toggleGroup = (label) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [label]: !previous[label],
    }));
  };

  return (
    <div className="app-chrome-strong app-chrome-divider border-b">
      <div className="flex min-h-12 items-stretch">
        <div className="app-chrome-divider flex w-12 shrink-0 items-center justify-center border-r">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onToggleChartToolSidebarPinned}
            title={isChartToolSidebarPinned ? t("trading.actionBar.hideTools") : t("trading.actionBar.pinTools")}
          >
            {isChartToolSidebarPinned ? (
              <PanelLeftClose className="h-4 w-4 text-primary" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-4 py-1.5">
          <button
            type="button"
            onClick={onOpenMarketSearch}
            className="inline-flex h-9 items-center rounded-l-2xl rounded-r-xl border border-border/80 bg-secondary/55 px-4 text-sm font-semibold text-foreground hover:bg-accent"
          >
            {selectedSymbol}
            <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
          </button>

          <span className="mx-2 h-6 w-px bg-border/80" />

          <div ref={timeframeRef}>
            <button
              type="button"
              ref={timeframeButtonRef}
              onClick={() => {
                const rect = timeframeButtonRef.current?.getBoundingClientRect();
                if (rect) {
                  setTimeframePosition({
                    top: rect.bottom + 10,
                    left: rect.left,
                  });
                }
                setIsTimeframeOpen((previous) => !previous);
              }}
              className="inline-flex h-9 w-[112px] items-center justify-between rounded-xl border border-border/80 bg-secondary/45 px-3 text-sm font-semibold text-foreground hover:bg-accent"
            >
              <span>{currentTimeframe}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${isTimeframeOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <span className="mx-2 h-6 w-px bg-border/80" />

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onOpenChartTypes}>
            {chartType === "candlestick" ? <CandlestickChart className="h-4 w-4" /> : null}
            {chartType === "line" ? <LineChart className="h-4 w-4" /> : null}
            {chartType === "heikinashi" ? <LayoutGrid className="h-4 w-4" /> : null}
          </Button>

          <Button
            variant="ghost"
            className="h-9 gap-2 px-3 text-sm text-foreground/90 hover:bg-accent hover:text-foreground"
            onClick={onOpenIndicators}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("trading.actionBar.indicators")}
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Grid2x2 className="h-4 w-4" />
          </Button>

          <Button variant="ghost" className="h-9 gap-2 px-3 text-sm text-foreground/90 hover:bg-accent hover:text-foreground" onClick={onOpenAlert}>
            <BellPlus className="h-4 w-4" />
            {t("trading.actionBar.alert")}
          </Button>

          <span className="mx-2 h-6 w-px bg-border/80" />

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onOpenAppearance}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onToggleFullScreen}>
              <Expand className={`h-4 w-4 ${isChartFullScreen ? "text-primary" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={onCaptureChart}>
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              className="h-9 gap-2 rounded-xl border border-border/80 bg-secondary/45 px-3 text-sm text-foreground hover:bg-accent"
              onClick={onTogglePanel}
            >
              {isTradePanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              {t("trading.actionBar.trade")}
            </Button>
          </div>
        </div>

        <div className="app-chrome-divider -ml-[10px] mr-[10px] flex w-12 shrink-0 items-center justify-center border-l">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onToggleWorkspaceUtilityRailPinned}
            title={
              isWorkspaceUtilityRailPinned
                ? t("trading.actionBar.hideRightRail")
                : t("trading.actionBar.pinRightRail")
            }
          >
            {isWorkspaceUtilityRailPinned ? (
              <PanelRightClose className="h-4 w-4 text-primary" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {isTimeframeOpen ? (
        <div className="fixed inset-0 z-50" onClick={() => setIsTimeframeOpen(false)}>
          <div
            ref={timeframeRef}
            className="app-chrome-panel absolute w-[272px] overflow-hidden rounded-[18px] border border-border/80 shadow-[0_28px_60px_rgba(0,0,0,0.55)]"
            style={{ top: timeframePosition.top, left: timeframePosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[420px] overflow-y-auto pr-1 [scrollbar-color:hsla(var(--border)/0.9)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80">
              {timeframeGroups.map((group, index) => {
                const isExpanded = expandedGroups[group.label];

                return (
                  <div key={group.label} className={index > 0 ? "border-t border-border/70" : ""}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:bg-accent/60"
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isExpanded ? (
                      <div className="pb-1">
                        {group.items.map((item) => {
                          const isActive = currentTimeframe === item.value;

                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => {
                                setCurrentTimeframe(item.value);
                                setIsTimeframeOpen(false);
                              }}
                              className={`block w-full px-4 py-2.5 text-left text-[14px] font-medium leading-tight transition ${
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground hover:bg-accent/70"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold">{item.value}</span>
                                <span className={`${isActive ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                                  {item.description}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TradingActionBar;
