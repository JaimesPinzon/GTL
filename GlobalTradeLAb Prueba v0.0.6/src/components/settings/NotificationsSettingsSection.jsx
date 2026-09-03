import React from "react";
import {
  Bell,
  Building2,
  CircleDollarSign,
  GraduationCap,
  Mail,
  MonitorSpeaker,
  Shield,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const ToggleRow = ({ title, description, checked, onChange, icon: Icon }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        <p className="text-sm font-semibold">{title}</p>
      </div>
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

const NotificationsSettingsSection = () => {
  const { t } = useTranslation();
  const { notificationState, updateNotificationState } = useTradingContext();
  const { toast } = useToast();

  const state = notificationState || {
    emailEnabled: true,
    inAppEnabled: true,
    soundsEnabled: true,
    popupsEnabled: true,
    digestFrequency: "daily",
    categories: {
      academic: true,
      financial: true,
      administrative: true,
      security: true,
    },
    alerts: {
      academicActivity: true,
      roomAlerts: true,
      grades: true,
      forums: true,
      lowBalance: true,
      activityOpenClose: true,
      maintenance: true,
    },
  };

  const saveAndToast = (updates, description = t("settings.notifications.toastSaved")) => {
    updateNotificationState?.(updates);
    toast({
      title: t("settings.notifications.toastTitle"),
      description,
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </span>
            {t("settings.notifications.title")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("settings.notifications.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <ToggleRow
            title={t("settings.notifications.items.email.title")}
            description={t("settings.notifications.items.email.description")}
            checked={Boolean(state.emailEnabled)}
            onChange={(value) => saveAndToast({ emailEnabled: value })}
            icon={Mail}
          />
          <ToggleRow
            title={t("settings.notifications.items.inApp.title")}
            description={t("settings.notifications.items.inApp.description")}
            checked={Boolean(state.inAppEnabled)}
            onChange={(value) => saveAndToast({ inAppEnabled: value })}
            icon={MonitorSpeaker}
          />
          <ToggleRow
            title={t("settings.notifications.items.sounds.title")}
            description={t("settings.notifications.items.sounds.description")}
            checked={Boolean(state.soundsEnabled)}
            onChange={(value) => saveAndToast({ soundsEnabled: value })}
            icon={Volume2}
          />
          <ToggleRow
            title={t("settings.notifications.items.popups.title")}
            description={t("settings.notifications.items.popups.description")}
            checked={Boolean(state.popupsEnabled)}
            onChange={(value) => saveAndToast({ popupsEnabled: value })}
            icon={Bell}
          />

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-sm font-semibold">{t("settings.notifications.digestTitle")}</p>
            <p className="settings-context-help mt-1 text-sm text-muted-foreground">{t("settings.notifications.digestDescription")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["off", "daily", "weekly"].map((value) => (
                <Button
                  key={value}
                  variant={state.digestFrequency === value ? "default" : "outline"}
                  onClick={() =>
                    saveAndToast(
                      { digestFrequency: value },
                      t("settings.notifications.digestConfigured", {
                        value: t(`settings.notifications.digestOptions.${value}`).toLowerCase(),
                      })
                    )
                  }
                >
                  {t(`settings.notifications.digestOptions.${value}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.notifications.categoriesTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.notifications.categoriesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow title={t("settings.notifications.items.academic.title")} description={t("settings.notifications.items.academic.description")} checked={Boolean(state.categories.academic)} onChange={(value) => saveAndToast({ categories: { academic: value } })} icon={GraduationCap} />
            <ToggleRow title={t("settings.notifications.items.financial.title")} description={t("settings.notifications.items.financial.description")} checked={Boolean(state.categories.financial)} onChange={(value) => saveAndToast({ categories: { financial: value } })} icon={CircleDollarSign} />
            <ToggleRow title={t("settings.notifications.items.administrative.title")} description={t("settings.notifications.items.administrative.description")} checked={Boolean(state.categories.administrative)} onChange={(value) => saveAndToast({ categories: { administrative: value } })} icon={Building2} />
            <ToggleRow title={t("settings.notifications.items.security.title")} description={t("settings.notifications.items.security.description")} checked={Boolean(state.categories.security)} onChange={(value) => saveAndToast({ categories: { security: value } })} icon={Shield} />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.notifications.alertsTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.notifications.alertsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {["academicActivity", "roomAlerts", "grades", "forums", "lowBalance", "activityOpenClose", "maintenance"].map((key) => (
              <ToggleRow
                key={key}
                title={t(`settings.notifications.items.${key}.title`)}
                description={t(`settings.notifications.items.${key}.description`)}
                checked={Boolean(state.alerts[key])}
                onChange={(value) => saveAndToast({ alerts: { [key]: value } })}
                icon={
                  key === "lowBalance"
                    ? CircleDollarSign
                    : key === "maintenance"
                      ? Building2
                      : key === "roomAlerts"
                        ? MonitorSpeaker
                        : key === "forums"
                          ? Bell
                          : GraduationCap
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationsSettingsSection;

