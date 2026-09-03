import React from "react";
import {
  ArrowDown,
  ArrowUp,
  LayoutDashboard,
  LayoutGrid,
  Monitor,
  Moon,
  Palette,
  Sun,
  Type,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const COLOR_OPTIONS = ["#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444"];

const ToggleRow = ({ title, description, checked, onChange }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${
        checked ? "border-primary bg-primary" : "border-border bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

const AppearanceSettingsSection = ({ currentTheme, setThemeMode }) => {
  const { t } = useTranslation();
  const { appearanceState, updateAppearanceState } = useTradingContext();
  const { toast } = useToast();

  const state = appearanceState || {
    themeMode: "dark",
    primaryColor: "#3b82f6",
    secondaryColor: "#0f172a",
    borderStyle: "rounded",
    fontSize: "medium",
    componentSize: "medium",
    dashboardStyle: "technical",
    homeWidgets: {
      portfolio: true,
      activeRooms: true,
      pendingActivities: true,
      news: false,
      ranking: true,
      watchlist: true,
    },
    homeWidgetOrder: ["portfolio", "activeRooms", "pendingActivities", "ranking", "watchlist", "news"],
  };

  const persist = (updates, description = t("settings.appearance.toastSaved")) => {
    updateAppearanceState?.(updates);
    toast({
      title: t("settings.appearance.toastTitle"),
      description,
    });
  };

  const moveWidget = (widgetId, direction) => {
    const currentIndex = state.homeWidgetOrder.indexOf(widgetId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.homeWidgetOrder.length) {
      return;
    }

    const nextOrder = [...state.homeWidgetOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    persist({ homeWidgetOrder: nextOrder }, t("settings.appearance.orderUpdated"));
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Palette className="h-6 w-6" />
            </span>
            {t("settings.appearance.title")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("settings.appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-[28px] border border-border/60 bg-background/60 p-5">
            <p className="text-sm font-semibold">{t("settings.appearance.currentView")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.appearance.currentTheme", {
                value: currentTheme === "dark" ? t("settings.appearance.options.dark") : t("settings.appearance.options.light"),
              })}
            </p>
            <div className="mt-4 flex gap-3">
              <div className="h-12 w-12 rounded-2xl border border-border" style={{ backgroundColor: state.primaryColor }} />
              <div className="h-12 w-12 rounded-2xl border border-border" style={{ backgroundColor: state.secondaryColor }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{t("settings.appearance.themeTitle")}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "light", label: t("settings.appearance.options.light"), icon: Sun },
                { value: "dark", label: t("settings.appearance.options.dark"), icon: Moon },
                { value: "auto", label: t("settings.appearance.options.auto"), icon: Monitor },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    variant={state.themeMode === option.value ? "default" : "outline"}
                    onClick={() => {
                      setThemeMode?.(option.value);
                      persist({ themeMode: option.value }, t("settings.appearance.themeApplied", { value: option.label.toLowerCase() }));
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.appearance.colorsTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.appearance.colorsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("settings.appearance.primaryColor")}</p>
              <div className="flex flex-wrap gap-3">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={`primary-${color}`}
                    type="button"
                    className={`h-11 w-11 rounded-2xl border-2 transition ${state.primaryColor === color ? "scale-105 border-foreground" : "border-border"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => persist({ primaryColor: color }, t("settings.appearance.primaryUpdated"))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("settings.appearance.secondaryColor")}</p>
              <div className="flex flex-wrap gap-3">
                {["#0f172a", "#1e293b", "#334155", "#164e63", "#14532d", "#4c1d95"].map((color) => (
                  <button
                    key={`secondary-${color}`}
                    type="button"
                    className={`h-11 w-11 rounded-2xl border-2 transition ${state.secondaryColor === color ? "scale-105 border-foreground" : "border-border"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => persist({ secondaryColor: color }, t("settings.appearance.secondaryUpdated"))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("settings.appearance.borderStyle")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "rounded", label: t("settings.appearance.options.rounded") },
                  { value: "standard", label: t("settings.appearance.options.standard") },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={state.borderStyle === option.value ? "default" : "outline"}
                    onClick={() => persist({ borderStyle: option.value }, t("settings.appearance.borderUpdated"))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.appearance.scaleTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.appearance.scaleDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.appearance.fontSize")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "small", label: t("settings.appearance.options.small") },
                  { value: "medium", label: t("settings.appearance.options.medium") },
                  { value: "large", label: t("settings.appearance.options.large") },
                ].map((option) => (
                  <Button key={option.value} variant={state.fontSize === option.value ? "default" : "outline"} onClick={() => persist({ fontSize: option.value }, t("settings.appearance.fontUpdated"))}>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("settings.appearance.componentSize")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "small", label: t("settings.appearance.options.compact") },
                  { value: "medium", label: t("settings.appearance.options.medium") },
                  { value: "large", label: t("settings.appearance.options.spacious") },
                ].map((option) => (
                  <Button key={option.value} variant={state.componentSize === option.value ? "default" : "outline"} onClick={() => persist({ componentSize: option.value }, t("settings.appearance.componentUpdated"))}>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.appearance.dashboardTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.appearance.dashboardDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {["minimalist", "technical", "academic"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => persist({ dashboardStyle: option }, t("settings.appearance.dashboardUpdated"))}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  state.dashboardStyle === option ? "border-primary bg-primary/10" : "border-border bg-background/50 hover:bg-accent/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{t(`settings.appearance.options.${option}`)}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t(`settings.appearance.dashboardOptions.${option}`)}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.appearance.widgetsTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.appearance.widgetsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.homeWidgetOrder.map((widgetId, index) => (
              <div key={widgetId} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">{t(`settings.appearance.widgets.${widgetId}`)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("settings.appearance.widgetPosition", { count: index + 1 })}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleRow
                      title={t("settings.appearance.widgetVisibility")}
                      description={t("settings.appearance.widgetVisibilityDescription")}
                      checked={Boolean(state.homeWidgets[widgetId])}
                      onChange={(value) => persist({ homeWidgets: { [widgetId]: value } }, t("settings.appearance.widgetUpdated"))}
                    />
                    <Button variant="outline" size="icon" onClick={() => moveWidget(widgetId, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => moveWidget(widgetId, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppearanceSettingsSection;

