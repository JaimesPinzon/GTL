import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  Layers3,
  MessageSquare,
  Newspaper,
  Radar,
  Rss,
  Shapes,
} from "lucide-react";
import { useTradingContext } from "@/contexts/TradingContext";
import { useTimezoneOptions } from "@/hooks/useTimezoneOptions";
import {
  formatTimezoneOffsetCompact,
  formatUnixSecondsInTimezone,
  getDefaultTimezone,
} from "@/lib/timezones";

const WorkspaceUtilityRail = ({ activePanel, onTogglePanel }) => {
  const { t } = useTranslation();
  const { preferencesState, updatePreferencesState, updateUser, user } = useTradingContext();
  const [clockUnixSeconds, setClockUnixSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);
  const timezoneButtonRef = useRef(null);
  const timezoneMenuRef = useRef(null);
  const selectedTimezoneButtonRef = useRef(null);
  const panels = [
    { id: "notes", icon: Newspaper, label: t("workspaceRail.panels.notes") },
    { id: "alerts", icon: Radar, label: t("workspaceRail.panels.alerts") },
    { id: "layers", icon: Layers3, label: t("workspaceRail.panels.layers") },
    { id: "comments", icon: MessageSquare, label: t("workspaceRail.panels.comments") },
    { id: "patterns", icon: Shapes, label: t("workspaceRail.panels.patterns") },
    { id: "events", icon: CalendarDays, label: t("workspaceRail.panels.events") },
    { id: "feed", icon: Rss, label: t("workspaceRail.panels.feed") },
    { id: "signals", icon: BellRing, label: t("workspaceRail.panels.signals") },
  ];
  const panelCopy = {
    notes: {
      title: t("workspaceRail.copy.notes.title"),
      body: t("workspaceRail.copy.notes.body"),
    },
    alerts: {
      title: t("workspaceRail.copy.alerts.title"),
      body: t("workspaceRail.copy.alerts.body"),
    },
    layers: {
      title: t("workspaceRail.copy.layers.title"),
      body: t("workspaceRail.copy.layers.body"),
    },
    comments: {
      title: t("workspaceRail.copy.comments.title"),
      body: t("workspaceRail.copy.comments.body"),
    },
    patterns: {
      title: t("workspaceRail.copy.patterns.title"),
      body: t("workspaceRail.copy.patterns.body"),
    },
    events: {
      title: t("workspaceRail.copy.events.title"),
      body: t("workspaceRail.copy.events.body"),
    },
    feed: {
      title: t("workspaceRail.copy.feed.title"),
      body: t("workspaceRail.copy.feed.body"),
    },
    signals: {
      title: t("workspaceRail.copy.signals.title"),
      body: t("workspaceRail.copy.signals.body"),
    },
  };
  const panelData = activePanel ? panelCopy[activePanel] : null;
  const { normalizedTimezoneOptions, resolvedTimezone } = useTimezoneOptions(
    preferencesState?.timezone || user?.timezone || getDefaultTimezone()
  );
  const chartLocale = user?.language === "en" ? "en-US" : "es-CO";
  const chartClock = formatUnixSecondsInTimezone(clockUnixSeconds, resolvedTimezone, chartLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const timezoneOffsetCompact = formatTimezoneOffsetCompact(resolvedTimezone);
  const selectedTimezoneIndex = useMemo(
    () => normalizedTimezoneOptions.findIndex((timezone) => timezone === resolvedTimezone),
    [normalizedTimezoneOptions, resolvedTimezone]
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockUnixSeconds(Math.floor(Date.now() / 1000));
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isTimezoneOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        timezoneButtonRef.current?.contains(target) ||
        timezoneMenuRef.current?.contains(target)
      ) {
        return;
      }

      setIsTimezoneOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsTimezoneOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isTimezoneOpen]);

  useEffect(() => {
    if (!isTimezoneOpen) {
      return;
    }

    selectedTimezoneButtonRef.current?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
  }, [isTimezoneOpen, resolvedTimezone]);

  const handleTimezoneChange = async (nextTimezone) => {
    updatePreferencesState?.({ timezone: nextTimezone });
    await updateUser?.({ timezone: nextTimezone });
    setIsTimezoneOpen(false);
  };

  return (
    <div className="app-chrome-strong app-chrome-divider relative hidden h-full w-12 shrink-0 border-l py-2 shadow-xl xl:flex xl:flex-col xl:items-center">
      {activePanel ? (
        <div className="app-chrome-panel app-chrome-divider absolute inset-y-0 right-full w-[320px] border-l shadow-2xl xl:flex xl:flex-col">
          <div className="app-chrome-divider border-b px-5 py-4">
            <h3 className="text-lg font-semibold text-foreground">{panelData?.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{panelData?.body}</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="rounded-2xl border border-border/80 bg-secondary/45 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("workspaceRail.activeAsset")}</p>
              <p className="mt-2 text-xl font-semibold text-foreground">BTCUSD</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("workspaceRail.contextualPanel")}</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-secondary/45 p-4">
              <p className="text-sm text-muted-foreground">
                {t("workspaceRail.utilitiesDescription")}
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
              {t("workspaceRail.extensionDescription")}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center gap-2">
        {panels.map((panel) => {
          const Icon = panel.icon;
          const isActive = activePanel === panel.id;
          return (
            <button
              key={panel.id}
              type="button"
              title={panel.label}
              onClick={() => onTogglePanel(isActive ? null : panel.id)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/75 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <div className="relative border-t border-border/70 px-1 pt-2">
        {isTimezoneOpen ? (
          <div
            ref={timezoneMenuRef}
            className="app-chrome-strong absolute bottom-0 right-full z-30 mr-3 w-[268px] overflow-hidden rounded-[18px] border border-border/80 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="max-h-[420px] overflow-y-auto py-2">
              {normalizedTimezoneOptions.map((timezone, index) => {
                const isSelected = timezone === resolvedTimezone;

                return (
                  <button
                    key={timezone}
                    ref={isSelected ? selectedTimezoneButtonRef : null}
                    type="button"
                    onClick={() => handleTimezoneChange(timezone)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                      isSelected ? "text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                    }`}
                    title={timezone}
                  >
                    <span className="flex w-4 shrink-0 items-center justify-center">
                      {isSelected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="truncate font-medium">{timezone}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border/70 px-4 py-2 text-center text-xs font-medium text-muted-foreground">
              {t("settings.preferences.labels.timezone")}
            </div>
            <div
              className="absolute bottom-4 -right-1.5 h-3 w-3 rotate-45 border-b border-r border-border/80 bg-[hsl(var(--background))]"
              aria-hidden="true"
            />
          </div>
        ) : null}

        <button
          ref={timezoneButtonRef}
          type="button"
          onClick={() => setIsTimezoneOpen((previous) => !previous)}
          title={resolvedTimezone}
          className="flex h-[74px] w-10 flex-col items-center justify-center gap-1 rounded-[18px] border border-border/80 bg-background/55 px-0 py-2 text-foreground transition hover:bg-accent/70"
        >
          <Clock3 className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold leading-none text-foreground">{chartClock}</span>
          <span className="text-[10px] font-semibold leading-none text-muted-foreground">{timezoneOffsetCompact}</span>
        </button>
      </div>
    </div>
  );
};

export default WorkspaceUtilityRail;
