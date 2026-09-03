import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  MonitorSmartphone,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserX,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTimeByLocale } from "@/lib/locale";

const buildPasswordRules = (password, t) => [
  { label: t("settings.security.passwordRules.minLength"), valid: password.length >= 8 },
  { label: t("settings.security.passwordRules.uppercase"), valid: /[A-Z]/.test(password) },
  { label: t("settings.security.passwordRules.lowercase"), valid: /[a-z]/.test(password) },
  { label: t("settings.security.passwordRules.number"), valid: /\d/.test(password) },
  { label: t("settings.security.passwordRules.symbol"), valid: /[^A-Za-z0-9]/.test(password) },
];

const buildPasswordStrength = (password, t) => {
  const rules = buildPasswordRules(password, t);
  const score = rules.filter((rule) => rule.valid).length;

  if (score <= 2) {
    return { score, label: t("settings.security.states.weak"), color: "bg-destructive" };
  }

  if (score <= 4) {
    return { score, label: t("settings.security.states.medium"), color: "bg-amber-500" };
  }

  return { score, label: t("settings.security.states.strong"), color: "bg-emerald-500" };
};

const ToggleRow = ({ title, description, checked, onChange, disabled = false, badge = null }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {badge ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="settings-context-help text-sm text-muted-foreground">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${
        checked ? "border-primary bg-primary" : "border-border bg-muted"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

const SecuritySettingsSection = () => {
  const { t } = useTranslation();
  const {
    user,
    securityState,
    preferencesState,
    changePassword,
    refreshSecuritySessions,
    revokeDeviceSession,
    updateSecurityState,
    logoutAllDevices,
    deleteAccount,
  } = useTradingContext();
  const { toast } = useToast();

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [recoveryEmail, setRecoveryEmail] = useState(securityState?.recoveryEmail || user?.email || "");
  const [deactivationReason, setDeactivationReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [currentPasswordConfirmation, setCurrentPasswordConfirmation] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const strength = useMemo(
    () => buildPasswordStrength(passwordForm.next, t),
    [passwordForm.next, t]
  );
  const passwordRules = useMemo(
    () => buildPasswordRules(passwordForm.next, t),
    [passwordForm.next, t]
  );

  const activeSessions = securityState?.activeSessions || [];
  const loginHistory = securityState?.loginHistory || [];
  const isTemporaryDisabled = Boolean(securityState?.temporarilyDisabled);

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      const sessions = await refreshSecuritySessions?.();
      if (!isMounted || !sessions) {
        return;
      }

      updateSecurityState?.({ activeSessions: sessions });
    };

    loadSessions();

    return () => {
      isMounted = false;
    };
  }, [refreshSecuritySessions, updateSecurityState]);

  const handleToggle = (key) => (value) => {
    updateSecurityState?.({ [key]: value });
    toast({
      title: t("settings.security.toasts.updatedTitle"),
      description: t("settings.security.toasts.updatedDescription"),
    });
  };

  const handleSaveRecovery = () => {
    updateSecurityState?.({ recoveryEmail: recoveryEmail.trim() });
    toast({
      title: t("settings.security.toasts.recoveryUpdatedTitle"),
      description: t("settings.security.toasts.recoveryUpdatedDescription"),
    });
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.current.trim()) {
      toast({
        title: t("settings.security.toasts.confirmCurrentPasswordTitle"),
        description: t("settings.security.toasts.confirmCurrentPasswordDescription"),
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      toast({
        title: t("settings.security.toasts.passwordMismatchTitle"),
        description: t("settings.security.toasts.passwordMismatchDescription"),
        variant: "destructive",
      });
      return;
    }

    if (strength.score < 4) {
      toast({
        title: t("settings.security.toasts.weakPasswordTitle"),
        description: t("settings.security.toasts.weakPasswordDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      await changePassword?.({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      });
      updateSecurityState?.({ lastPasswordChangedAt: new Date().toISOString() });
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      console.error(error);
      toast({
        title: t("settings.security.toasts.passwordUpdatedErrorTitle"),
        description: t("settings.security.toasts.passwordUpdatedErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeDeviceSession?.(sessionId);
      const sessions = await refreshSecuritySessions?.();
      updateSecurityState?.({ activeSessions: sessions || [] });
    } catch (error) {
      console.error(error);
      toast({
        title: t("settings.security.toasts.closeSessionsErrorTitle"),
        description: t("settings.security.toasts.closeSessionsErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      await logoutAllDevices?.();
    } catch (error) {
      console.error(error);
      toast({
        title: t("settings.security.toasts.closeSessionsErrorTitle"),
        description: t("settings.security.toasts.closeSessionsErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleToggleTemporaryDisable = async () => {
    if (!currentPasswordConfirmation.trim()) {
      toast({
        title: t("settings.security.toasts.pauseRequiresPasswordTitle"),
        description: t("settings.security.toasts.pauseRequiresPasswordDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsDisabling(true);
    try {
      const nextValue = !isTemporaryDisabled;
      updateSecurityState?.({
        temporarilyDisabled: nextValue,
        deactivationReason: deactivationReason.trim(),
      });
      toast({
        title: t(nextValue ? "settings.security.toasts.accountPausedTitle" : "settings.security.toasts.accountReactivatedTitle"),
        description: t(
          nextValue
            ? "settings.security.toasts.accountPausedDescription"
            : "settings.security.toasts.accountReactivatedDescription"
        ),
      });
    } finally {
      setIsDisabling(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== t("settings.security.confirmDeleteKeyword")) {
      toast({
        title: t("settings.security.toasts.deleteConfirmTitle"),
        description: t("settings.security.toasts.deleteConfirmDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!currentPasswordConfirmation.trim()) {
      toast({
        title: t("settings.security.toasts.deletePasswordTitle"),
        description: t("settings.security.toasts.deletePasswordDescription"),
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(t("settings.security.confirmDeleteDialog"));

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount?.();
    } catch (error) {
      console.error(error);
      toast({
        title: t("settings.security.toasts.deleteErrorTitle"),
        description: t("settings.security.toasts.deleteErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const accountStatusLabel = isTemporaryDisabled
    ? t("settings.security.states.temporarilyDisabled")
    : t("common.states.active");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.1fr_1.9fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </span>
            {t("settings.security.title")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("settings.security.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="rounded-[28px] border border-border/60 bg-background/60 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-primary" />
              <div className="space-y-2">
                <p className="text-base font-semibold">{t("settings.security.summaryTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.summaryPasswordUpdated", {
                    value: formatDateTimeByLocale(securityState?.lastPasswordChangedAt, preferencesState),
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.summaryLastLogin", {
                    value: formatDateTimeByLocale(user?.lastLoginAt || user?.updatedAt, preferencesState),
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.summaryAccountStatus", { value: accountStatusLabel })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <Button variant="outline" onClick={handleLogoutAllDevices}>
              <MonitorSmartphone className="mr-2 h-4 w-4" />
              {t("settings.security.logOutAllDevices")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.security.verificationTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.security.verificationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              title={t("settings.security.toggles.email2faTitle")}
              description={t("settings.security.toggles.email2faDescription")}
              checked={Boolean(securityState?.twoFactorEmail)}
              onChange={handleToggle("twoFactorEmail")}
            />
            <ToggleRow
              title={t("settings.security.toggles.authenticatorTitle")}
              description={t("settings.security.toggles.authenticatorDescription")}
              checked={Boolean(securityState?.twoFactorAuthenticator)}
              onChange={handleToggle("twoFactorAuthenticator")}
            />
            <ToggleRow
              title={t("settings.security.toggles.sms2faTitle")}
              description={t("settings.security.toggles.sms2faDescription")}
              checked={Boolean(securityState?.twoFactorSms)}
              onChange={handleToggle("twoFactorSms")}
              badge={t("settings.security.toggles.upcomingBadge")}
              disabled
            />
            <ToggleRow
              title={t("settings.security.toggles.notifyNewDeviceTitle")}
              description={t("settings.security.toggles.notifyNewDeviceDescription")}
              checked={Boolean(securityState?.notifyNewDevice)}
              onChange={handleToggle("notifyNewDevice")}
            />

            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.security.recoveryTitle")}</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  placeholder={t("settings.security.recoveryPlaceholder")}
                />
                <Button onClick={handleSaveRecovery}>{t("settings.security.recoveryAction")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.security.passwordTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.security.passwordDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input type="password" value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} placeholder={t("common.labels.currentPassword")} />
              <Input type="password" value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} placeholder={t("common.labels.newPassword")} />
              <div className="md:col-span-2">
                <Input type="password" value={passwordForm.confirm} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))} placeholder={t("common.labels.confirmPassword")} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold">{t("settings.security.strengthLabel", { value: strength.label })}</p>
                <p className="text-xs text-muted-foreground">
                  {t("settings.security.latestUpdateLabel", {
                    value: formatDateTimeByLocale(securityState?.lastPasswordChangedAt, preferencesState),
                  })}
                </p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div className={`h-2 rounded-full transition-all ${strength.color}`} style={{ width: `${Math.max((strength.score / 5) * 100, 8)}%` }} />
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className={`h-4 w-4 ${rule.valid ? "text-emerald-500" : "text-muted-foreground"}`} />
                    <span className={rule.valid ? "text-foreground" : "text-muted-foreground"}>{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handlePasswordChange} disabled={isSavingPassword}>
              <KeyRound className="mr-2 h-4 w-4" />
              {isSavingPassword ? t("settings.security.updatingPassword") : t("settings.security.updatePasswordAction")}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.security.sessionsTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.security.sessionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.security.activeSessionsTitle")}</p>
              </div>
              <div className="grid gap-3">
                {activeSessions.length > 0 ? (
                  activeSessions.map((session, index) => (
                    <div key={session.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">
                            {session.current
                              ? t("settings.security.currentSession")
                              : index === 0
                              ? t("settings.security.currentSession")
                              : t("settings.security.numberedSession", { count: index + 1 })}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{session.deviceLabel}</p>
                          <p className="text-xs text-muted-foreground">{session.location}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-500">
                            {t("settings.security.activeBadge")}
                          </span>
                          {!session.current ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevokeSession(session.id)}
                              aria-label={t("settings.security.logOutAllDevices")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t("settings.security.lastActivity", {
                          value: formatDateTimeByLocale(session.lastSeenAt, preferencesState),
                        })}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {t("settings.security.activeSessionsEmpty")}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.security.loginHistoryTitle")}</p>
              </div>
              <div className="grid gap-3">
                {loginHistory.length > 0 ? (
                  loginHistory.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">{formatDateTimeByLocale(entry.at, preferencesState)}</p>
                          <p className="text-sm text-muted-foreground">{entry.deviceLabel}</p>
                        </div>
                        {entry.isNewDevice ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-500">
                            {t("settings.security.newDeviceBadge")}
                          </span>
                        ) : (
                          <span className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {t("settings.security.registeredBadge")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {t("settings.security.loginHistoryEmpty")}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-destructive/30">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.security.sensitiveActionsTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.security.sensitiveActionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-semibold">{t("settings.security.passwordConfirmationTitle")}</p>
              </div>
              <Input
                type="password"
                value={currentPasswordConfirmation}
                onChange={(event) => setCurrentPasswordConfirmation(event.target.value)}
                placeholder={t("settings.security.passwordConfirmationPlaceholder")}
              />
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <UserX className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.security.temporaryDisableTitle")}</p>
              </div>
              <Textarea
                value={deactivationReason}
                onChange={(event) => setDeactivationReason(event.target.value)}
                placeholder={t("settings.security.temporaryDisablePlaceholder")}
                className="min-h-[96px]"
              />
              <div className="mt-3">
                <Button variant="outline" onClick={handleToggleTemporaryDisable} disabled={isDisabling}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  {isTemporaryDisabled ? t("settings.security.reactivateAction") : t("settings.security.temporaryDisableAction")}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold">{t("settings.security.deleteTitle")}</p>
              </div>
              <p className="settings-context-help mb-3 text-sm text-muted-foreground">{t("settings.security.deleteHelp")}</p>
              <Input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder={t("settings.security.deletePlaceholder")}
              />
              <div className="mt-3">
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? t("settings.security.deleting") : t("settings.security.deleteAction")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecuritySettingsSection;

