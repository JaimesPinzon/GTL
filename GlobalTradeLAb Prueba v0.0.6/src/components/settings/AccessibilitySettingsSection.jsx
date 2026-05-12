import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Accessibility,
  Eye,
  Keyboard,
  Link2,
  MonitorSmartphone,
  Palette,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { useTradingContext } from "@/contexts/TradingContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const ToggleRow = ({ icon: Icon, title, description, checked, onChange }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        <p className="text-sm font-semibold">{title}</p>
      </div>
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

const AccessibilitySettingsSection = () => {
  const { t } = useTranslation();
  const { accessibilityState, updateAccessibilityState } = useTradingContext();
  const { toast } = useToast();

  const state = accessibilityState || {
    highContrast: false,
    reducedMotion: false,
    keyboardNavigation: true,
    screenReaderFriendly: false,
    colorBlindSafe: false,
    underlineLinks: false,
    strongFocusIndicators: false,
  };

  const saveAccessibility = (updates, description) => {
    updateAccessibilityState?.(updates);
    toast({
      title: t("accessibilitySettings.toasts.title"),
      description,
    });
  };

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = state.reducedMotion ? "true" : "false";
    document.documentElement.dataset.highContrast = state.highContrast ? "true" : "false";
    document.documentElement.dataset.keyboardNavigation = state.keyboardNavigation ? "true" : "false";
    document.documentElement.dataset.screenReaderFriendly = state.screenReaderFriendly ? "true" : "false";
    document.documentElement.dataset.colorBlindSafe = state.colorBlindSafe ? "true" : "false";
    document.documentElement.dataset.underlineLinks = state.underlineLinks ? "true" : "false";
    document.documentElement.dataset.strongFocusIndicators = state.strongFocusIndicators ? "true" : "false";
  }, [
    state.colorBlindSafe,
    state.highContrast,
    state.keyboardNavigation,
    state.reducedMotion,
    state.screenReaderFriendly,
    state.strongFocusIndicators,
    state.underlineLinks,
  ]);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Accessibility className="h-6 w-6" />
            </span>
            {t("accessibilitySettings.title")}
          </CardTitle>
          <CardDescription>{t("accessibilitySettings.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("accessibilitySettings.summaryTitle")}</p>
            <p className="mt-2 text-sm text-foreground">
              {[
                state.highContrast && t("accessibilitySettings.summaryLabels.highContrast"),
                state.reducedMotion && t("accessibilitySettings.summaryLabels.reducedMotion"),
                state.colorBlindSafe && t("accessibilitySettings.summaryLabels.colorBlindSafe"),
                state.underlineLinks && t("accessibilitySettings.summaryLabels.underlineLinks"),
                state.strongFocusIndicators && t("accessibilitySettings.summaryLabels.strongFocusIndicators"),
              ]
                .filter(Boolean)
                .join(" | ") || t("accessibilitySettings.summaryEmpty")}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("accessibilitySettings.baseTitle")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("accessibilitySettings.baseDescription")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("accessibilitySettings.sections.visibilityTitle")}</CardTitle>
            <CardDescription>{t("accessibilitySettings.sections.visibilityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              icon={Eye}
              title={t("accessibilitySettings.options.highContrast.title")}
              description={t("accessibilitySettings.options.highContrast.description")}
              checked={Boolean(state.highContrast)}
              onChange={(value) => saveAccessibility({ highContrast: value }, t("accessibilitySettings.toasts.highContrast"))}
            />
            <ToggleRow
              icon={Palette}
              title={t("accessibilitySettings.options.colorBlindSafe.title")}
              description={t("accessibilitySettings.options.colorBlindSafe.description")}
              checked={Boolean(state.colorBlindSafe)}
              onChange={(value) => saveAccessibility({ colorBlindSafe: value }, t("accessibilitySettings.toasts.colorBlindSafe"))}
            />
            <ToggleRow
              icon={Link2}
              title={t("accessibilitySettings.options.underlineLinks.title")}
              description={t("accessibilitySettings.options.underlineLinks.description")}
              checked={Boolean(state.underlineLinks)}
              onChange={(value) => saveAccessibility({ underlineLinks: value }, t("accessibilitySettings.toasts.underlineLinks"))}
            />
            <ToggleRow
              icon={Sparkles}
              title={t("accessibilitySettings.options.strongFocusIndicators.title")}
              description={t("accessibilitySettings.options.strongFocusIndicators.description")}
              checked={Boolean(state.strongFocusIndicators)}
              onChange={(value) => saveAccessibility({ strongFocusIndicators: value }, t("accessibilitySettings.toasts.strongFocusIndicators"))}
            />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("accessibilitySettings.sections.navigationTitle")}</CardTitle>
            <CardDescription>{t("accessibilitySettings.sections.navigationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              icon={MonitorSmartphone}
              title={t("accessibilitySettings.options.reducedMotion.title")}
              description={t("accessibilitySettings.options.reducedMotion.description")}
              checked={Boolean(state.reducedMotion)}
              onChange={(value) => saveAccessibility({ reducedMotion: value }, t("accessibilitySettings.toasts.reducedMotion"))}
            />
            <ToggleRow
              icon={Keyboard}
              title={t("accessibilitySettings.options.keyboardNavigation.title")}
              description={t("accessibilitySettings.options.keyboardNavigation.description")}
              checked={Boolean(state.keyboardNavigation)}
              onChange={(value) => saveAccessibility({ keyboardNavigation: value }, t("accessibilitySettings.toasts.keyboardNavigation"))}
            />
            <ToggleRow
              icon={ScanSearch}
              title={t("accessibilitySettings.options.screenReaderFriendly.title")}
              description={t("accessibilitySettings.options.screenReaderFriendly.description")}
              checked={Boolean(state.screenReaderFriendly)}
              onChange={(value) => saveAccessibility({ screenReaderFriendly: value }, t("accessibilitySettings.toasts.screenReaderFriendly"))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccessibilitySettingsSection;
