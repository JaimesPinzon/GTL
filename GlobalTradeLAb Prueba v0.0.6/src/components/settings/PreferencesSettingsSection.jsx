import React, { useEffect, useMemo } from "react";
import {
  Clock3,
  Globe,
  Languages,
  LayoutDashboard,
  ListOrdered,
  Settings2,
  Radio,
  TableProperties,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useTimezoneOptions } from "@/hooks/useTimezoneOptions";
import { getDefaultTimezone } from "@/lib/timezones";
import { APP_HOME_PATH } from "@/lib/routes";
const normalizeInterfaceLanguage = (value) => {
  if (typeof value !== "string") {
    return "es";
  }

  const normalizedValue = value.toLowerCase();
  return normalizedValue.startsWith("en") ? "en" : "es";
};

const SelectField = ({ label, icon: Icon, value, onChange, options }) => (
  <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </div>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const ToggleRow = ({ title, description, checked, onChange }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="settings-context-help text-sm text-muted-foreground">{description}</p>
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

const PreferencesSettingsSection = () => {
  const { i18n, t } = useTranslation();
  const {
    user,
    rooms = [],
    preferencesState,
    notificationState,
    appearanceState,
    updatePreferencesState,
    updateNotificationState,
    updateAppearanceState,
    updateUser,
  } = useTradingContext();
  const { toast } = useToast();
  const { normalizedTimezoneOptions, resolvedTimezone } = useTimezoneOptions(
    preferencesState?.timezone || user?.timezone || getDefaultTimezone()
  );

  const resolvedInterfaceLanguage = normalizeInterfaceLanguage(
    i18n.resolvedLanguage ||
      i18n.language ||
      preferencesState?.interfaceLanguage ||
      user?.language ||
      "es"
  );

  const state = preferencesState || {
    interfaceLanguage: resolvedInterfaceLanguage,
    timezone: resolvedTimezone,
    dateFormat: "DD/MM/YYYY",
    hourFormat: "24h",
    numberFormat: "es-CO",
    preferredCurrency: "USD",
    defaultHomePage: APP_HOME_PATH,
    defaultActiveRoomId: "",
    defaultDashboardView: "technical",
    tablePageSize: "10",
    notificationSounds: notificationState?.soundsEnabled ?? true,
    contextualHelpMessages: true,
  };

  const activeRoomOptions = useMemo(
    () => [
      { value: "", label: t("settings.preferences.options.useLastActiveRoom") },
      ...rooms.map((room) => ({ value: room.id, label: room.name })),
    ],
    [rooms, t]
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (
      normalizeInterfaceLanguage(preferencesState?.interfaceLanguage) === resolvedInterfaceLanguage
    ) {
      return;
    }

    updatePreferencesState?.({ interfaceLanguage: resolvedInterfaceLanguage });
  }, [preferencesState?.interfaceLanguage, resolvedInterfaceLanguage, updatePreferencesState, user?.id]);

  const savePreference = async (updates, descriptionKey) => {
    const next = updatePreferencesState?.(updates);

    if (updates.interfaceLanguage) {
      await i18n.changeLanguage(updates.interfaceLanguage);
      await updateUser?.({ language: updates.interfaceLanguage });
    }

    if (updates.timezone) {
      await updateUser?.({ timezone: updates.timezone });
    }

    if (updates.notificationSounds != null) {
      updateNotificationState?.({ soundsEnabled: updates.notificationSounds });
    }

    if (updates.defaultDashboardView) {
      updateAppearanceState?.({ dashboardStyle: updates.defaultDashboardView });
    }

    toast({
      title: t("settings.preferences.toasts.updatedTitle"),
      description: t(descriptionKey),
    });

    return next;
  };

  const currentDashboardView = appearanceState?.dashboardStyle || state.defaultDashboardView;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Settings2 className="h-6 w-6" />
            </span>
            {t("settings.preferences.title")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("settings.preferences.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="rounded-[28px] border border-border/60 bg-background/60 p-5">
            <p className="text-sm font-semibold">{t("settings.preferences.summaryTitle")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("settings.preferences.summaryLanguage", {
                value: resolvedInterfaceLanguage === "es"
                  ? t("settings.preferences.options.spanish")
                  : t("settings.preferences.options.english"),
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.preferences.summaryTimezone", { value: resolvedTimezone })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.preferences.summaryCurrency", { value: state.preferredCurrency })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.preferences.summaryDashboard", {
                value: t(`settings.preferences.options.${currentDashboardView}`),
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.preferences.regionTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.preferences.regionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("settings.preferences.labels.interfaceLanguage")}
              icon={Languages}
              value={resolvedInterfaceLanguage}
              onChange={(value) => savePreference({ interfaceLanguage: value }, "settings.preferences.toasts.languageUpdated")}
              options={[
                { value: "es", label: t("settings.preferences.options.spanish") },
                { value: "en", label: t("settings.preferences.options.english") },
              ]}
            />
            <SelectField
              label={t("settings.preferences.labels.timezone")}
              icon={Globe}
              value={resolvedTimezone}
              onChange={(value) => savePreference({ timezone: value }, "settings.preferences.toasts.timezoneUpdated")}
              options={normalizedTimezoneOptions.map((timezone) => ({ value: timezone, label: timezone }))}
            />
            <SelectField
              label={t("settings.preferences.labels.dateFormat")}
              icon={Clock3}
              value={state.dateFormat}
              onChange={(value) => savePreference({ dateFormat: value }, "settings.preferences.toasts.dateFormatUpdated")}
              options={[
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
              ]}
            />
            <SelectField
              label={t("settings.preferences.labels.hourFormat")}
              icon={Clock3}
              value={state.hourFormat}
              onChange={(value) => savePreference({ hourFormat: value }, "settings.preferences.toasts.hourFormatUpdated")}
              options={[
                { value: "12h", label: t("settings.preferences.options.hour12") },
                { value: "24h", label: t("settings.preferences.options.hour24") },
              ]}
            />
            <SelectField
              label={t("settings.preferences.labels.numberFormat")}
              icon={ListOrdered}
              value={state.numberFormat}
              onChange={(value) => savePreference({ numberFormat: value }, "settings.preferences.toasts.numberFormatUpdated")}
              options={[
                { value: "es-CO", label: "1.234,56" },
                { value: "en-US", label: "1,234.56" },
              ]}
            />
            <SelectField
              label={t("settings.preferences.labels.preferredCurrency")}
              icon={Wallet}
              value={state.preferredCurrency}
              onChange={(value) => savePreference({ preferredCurrency: value }, "settings.preferences.toasts.currencyUpdated")}
              options={[
                { value: "USD", label: "USD" },
                { value: "COP", label: "COP" },
                { value: "EUR", label: "EUR" },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.preferences.behaviorTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.preferences.behaviorDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("settings.preferences.labels.defaultHomePage")}
              icon={Settings2}
              value={state.defaultHomePage}
              onChange={(value) => savePreference({ defaultHomePage: value }, "settings.preferences.toasts.homeUpdated")}
              options={[
                { value: APP_HOME_PATH, label: t("settings.preferences.options.platformHome") },
                { value: "/classes", label: t("settings.preferences.options.classes") },
                { value: "/learn", label: t("settings.preferences.options.learn") },
                { value: "/markets", label: t("settings.preferences.options.markets") },
              ]}
            />
            <SelectField
              label={t("settings.preferences.labels.defaultActiveRoom")}
              icon={Radio}
              value={state.defaultActiveRoomId}
              onChange={(value) => savePreference({ defaultActiveRoomId: value }, "settings.preferences.toasts.roomUpdated")}
              options={activeRoomOptions}
            />
            <SelectField
              label={t("settings.preferences.labels.defaultDashboardView")}
              icon={LayoutDashboard}
              value={state.defaultDashboardView}
              onChange={(value) => savePreference({ defaultDashboardView: value }, "settings.preferences.toasts.dashboardUpdated")}
              options={[
                { value: "minimalist", label: t("settings.preferences.options.minimalist") },
                { value: "technical", label: t("settings.preferences.options.technical") },
                { value: "academic", label: t("settings.preferences.options.academic") },
              ]}
            />
            <SelectField
              label={t("settings.preferences.labels.tablePageSize")}
              icon={TableProperties}
              value={state.tablePageSize}
              onChange={(value) => savePreference({ tablePageSize: value }, "settings.preferences.toasts.paginationUpdated")}
              options={[
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "50", label: "50" },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.preferences.experienceTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.preferences.experienceDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              title={t("settings.preferences.labels.notificationSounds")}
              description={t("settings.preferences.descriptions.notificationSounds")}
              checked={Boolean(state.notificationSounds)}
              onChange={(value) => savePreference({ notificationSounds: value }, "settings.preferences.toasts.soundsUpdated")}
            />
            <ToggleRow
              title={t("settings.preferences.labels.contextualHelpMessages")}
              description={t("settings.preferences.descriptions.contextualHelpMessages")}
              checked={Boolean(state.contextualHelpMessages)}
              onChange={(value) =>
                savePreference({ contextualHelpMessages: value }, "settings.preferences.toasts.contextualHelpUpdated")
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PreferencesSettingsSection;

