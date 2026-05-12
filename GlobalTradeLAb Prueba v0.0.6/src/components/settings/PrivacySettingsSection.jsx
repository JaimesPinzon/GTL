import React from "react";
import {
  BadgeInfo,
  Download,
  Eye,
  FileWarning,
  LineChart,
  Medal,
  Shield,
  User,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTimeByLocale } from "@/lib/locale";

const SUPPORT_EMAIL = "globaltradelab.edu@gmail.com";

const SelectRow = ({ icon: Icon, title, description, value, onChange, options }) => (
  <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
    <div className="mb-2 flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
      <p className="text-sm font-semibold">{title}</p>
    </div>
    <p className="mb-3 text-sm text-muted-foreground">{description}</p>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
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

const PrivacySettingsSection = () => {
  const { t } = useTranslation();
  const {
    user,
    rooms = [],
    positions = [],
    transactions = [],
    roomMembers = [],
    roomAccounts = [],
    roomPortfolios = {},
    securityState,
    notificationState,
    appearanceState,
    preferencesState,
    accessibilityState,
    membershipState,
    privacyState,
    updatePrivacyState,
  } = useTradingContext();
  const { toast } = useToast();

  const visibilityOptions = ["private", "teachers", "members", "public"].map((value) => ({
    value,
    label: t(`settings.privacy.visibilityOptions.${value}`),
  }));

  const state = privacyState || {
    profileVisibility: "members",
    fullNameVisibility: "teachers",
    aliasVisibility: "members",
    portfolioVisibility: "teachers",
    performanceVisibility: "teachers",
    forumParticipationVisibility: "members",
    appearInRankings: true,
    shareStatistics: false,
    dataConsentGranted: true,
    dataConsentUpdatedAt: "",
    dataDeletionRequestedAt: "",
  };

  const savePrivacy = (updates, description) => {
    updatePrivacyState?.(updates);
    toast({
      title: t("settings.privacy.toastTitle"),
      description,
    });
  };

  const downloadData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user,
      rooms,
      positions,
      transactions,
      roomMembers,
      roomAccounts,
      roomPortfolios,
      states: {
        securityState,
        notificationState,
        appearanceState,
        preferencesState,
        accessibilityState,
        membershipState,
        privacyState: state,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gtl-data-${user?.username || user?.id || "user"}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: t("settings.privacy.toasts.exportedTitle"),
      description: t("settings.privacy.toasts.exportedDescription"),
    });
  };

  const requestDataDeletion = () => {
    const requestedAt = new Date().toISOString();
    updatePrivacyState?.({ dataDeletionRequestedAt: requestedAt });

    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      t("settings.privacy.mail.deletionSubject")
    )}&body=${encodeURIComponent(
      t("settings.privacy.mail.deletionBody", {
        user: user?.email || user?.id || "no-data",
        date: requestedAt,
      })
    )}`;

    window.location.href = href;

    toast({
      title: t("settings.privacy.toasts.requestReadyTitle"),
      description: t("settings.privacy.toasts.requestReadyDescription"),
    });
  };

  const toggleConsent = () => {
    const nextValue = !state.dataConsentGranted;
    savePrivacy(
      {
        dataConsentGranted: nextValue,
        dataConsentUpdatedAt: new Date().toISOString(),
      },
      t(nextValue ? "settings.privacy.toasts.consentGranted" : "settings.privacy.toasts.consentRevoked")
    );
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </span>
            {t("settings.privacy.title")}
          </CardTitle>
          <CardDescription>{t("settings.privacy.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.privacy.profileVisibility")}</p>
            <p className="mt-2 text-sm text-foreground">
              {visibilityOptions.find((option) => option.value === state.profileVisibility)?.label || t("settings.privacy.noValue")}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.privacy.consentTitle")}</p>
            <p className="mt-2 text-sm text-foreground">
              {state.dataConsentGranted ? t("settings.privacy.accepted") : t("settings.privacy.revoked")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("settings.privacy.lastUpdated", {
                date: formatDateTimeByLocale(state.dataConsentUpdatedAt, preferencesState),
              })}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.privacy.deletionRequestTitle")}</p>
            <p className="mt-2 text-sm text-foreground">{formatDateTimeByLocale(state.dataDeletionRequestedAt, preferencesState)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.privacy.visibilityTitle")}</CardTitle>
            <CardDescription>{t("settings.privacy.visibilityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <SelectRow icon={Eye} title={t("settings.privacy.rows.profile.title")} description={t("settings.privacy.rows.profile.description")} value={state.profileVisibility} onChange={(value) => savePrivacy({ profileVisibility: value }, t("settings.privacy.profileVisibility"))} options={visibilityOptions} />
            <SelectRow icon={User} title={t("settings.privacy.rows.fullName.title")} description={t("settings.privacy.rows.fullName.description")} value={state.fullNameVisibility} onChange={(value) => savePrivacy({ fullNameVisibility: value }, t("settings.privacy.rows.fullName.title"))} options={visibilityOptions} />
            <SelectRow icon={BadgeInfo} title={t("settings.privacy.rows.alias.title")} description={t("settings.privacy.rows.alias.description")} value={state.aliasVisibility} onChange={(value) => savePrivacy({ aliasVisibility: value }, t("settings.privacy.rows.alias.title"))} options={visibilityOptions} />
            <SelectRow icon={LineChart} title={t("settings.privacy.rows.portfolio.title")} description={t("settings.privacy.rows.portfolio.description")} value={state.portfolioVisibility} onChange={(value) => savePrivacy({ portfolioVisibility: value }, t("settings.privacy.rows.portfolio.title"))} options={visibilityOptions} />
            <SelectRow icon={LineChart} title={t("settings.privacy.rows.performance.title")} description={t("settings.privacy.rows.performance.description")} value={state.performanceVisibility} onChange={(value) => savePrivacy({ performanceVisibility: value }, t("settings.privacy.rows.performance.title"))} options={visibilityOptions} />
            <SelectRow icon={Users} title={t("settings.privacy.rows.forum.title")} description={t("settings.privacy.rows.forum.description")} value={state.forumParticipationVisibility} onChange={(value) => savePrivacy({ forumParticipationVisibility: value }, t("settings.privacy.rows.forum.title"))} options={visibilityOptions} />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.privacy.rankingsTitle")}</CardTitle>
            <CardDescription>{t("settings.privacy.rankingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow title={t("settings.privacy.toggles.rankings.title")} description={t("settings.privacy.toggles.rankings.description")} checked={Boolean(state.appearInRankings)} onChange={(value) => savePrivacy({ appearInRankings: value }, t("settings.privacy.toggles.rankings.title"))} />
            <ToggleRow title={t("settings.privacy.toggles.statistics.title")} description={t("settings.privacy.toggles.statistics.description")} checked={Boolean(state.shareStatistics)} onChange={(value) => savePrivacy({ shareStatistics: value }, t("settings.privacy.toggles.statistics.title"))} />
            <ToggleRow title={t("settings.privacy.toggles.consent.title")} description={t("settings.privacy.toggles.consent.description")} checked={Boolean(state.dataConsentGranted)} onChange={toggleConsent} />
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
              {t("settings.privacy.lastUpdated", {
                date: formatDateTimeByLocale(state.dataConsentUpdatedAt, preferencesState),
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.privacy.personalDataTitle")}</CardTitle>
            <CardDescription>{t("settings.privacy.personalDataDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.privacy.cards.downloadTitle")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t("settings.privacy.cards.downloadDescription")}</p>
              <Button className="mt-4" onClick={downloadData}>
                <Download className="mr-2 h-4 w-4" />
                {t("settings.privacy.downloadData")}
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.privacy.cards.deleteTitle")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t("settings.privacy.cards.deleteDescription")}</p>
              <Button className="mt-4" variant="outline" onClick={requestDataDeletion}>
                <FileWarning className="mr-2 h-4 w-4" />
                {t("settings.privacy.deleteData")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.privacy.exposureTitle")}</CardTitle>
            <CardDescription>{t("settings.privacy.exposureDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="flex items-center gap-2">
                <Medal className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.privacy.rankings")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.appearInRankings ? t("settings.privacy.exposure.rankingsVisible") : t("settings.privacy.exposure.rankingsHidden")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.privacy.statistics")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.shareStatistics ? t("settings.privacy.exposure.statisticsVisible") : t("settings.privacy.exposure.statisticsHidden")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacySettingsSection;
