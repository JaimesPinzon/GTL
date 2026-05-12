import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  Crown,
  CreditCard,
  History,
  Receipt,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTimeByLocale } from "@/lib/locale";

const ProgressRow = ({ label, current, limit }) => {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">
          {current} / {limit}
        </p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const MembershipSettingsSection = () => {
  const { t } = useTranslation();
  const { user, rooms = [], positions = [], transactions = [], membershipState, updateMembershipState, preferencesState } = useTradingContext();
  const { toast } = useToast();
  const [currentPlan, setCurrentPlan] = useState(membershipState?.currentPlan || user?.plan || t("settings.membership.free"));

  useEffect(() => {
    if (membershipState?.currentPlan || user?.plan) {
      setCurrentPlan(membershipState?.currentPlan || user?.plan || t("settings.membership.free"));
    }
  }, [membershipState?.currentPlan, t, user?.plan]);

  const planDetails = {
    [t("settings.membership.free")]: {
      benefits: [1, 2, 3, 4].map((n) => t(`settings.membership.planDetails.freeBenefits${n}`)),
      limitations: [1, 2, 3, 4].map((n) => t(`settings.membership.planDetails.freeLimit${n}`)),
    },
    [t("settings.membership.pro")]: {
      benefits: [1, 2, 3, 4].map((n) => t(`settings.membership.planDetails.proBenefits${n}`)),
      limitations: [1, 2].map((n) => t(`settings.membership.planDetails.proLimit${n}`)),
    },
  };

  const planData = planDetails[currentPlan] || planDetails[t("settings.membership.free")];
  const usage = useMemo(
    () => ({ rooms: rooms.length, transactions: transactions.length, positions: positions.length }),
    [positions.length, rooms.length, transactions.length]
  );
  const paymentHistory = membershipState?.paymentHistory || [];
  const planStartedAt = membershipState?.planStartedAt || user?.createdAt || "";

  const handleManagePlan = () => {
    toast({
      title: t("settings.membership.toasts.manageTitle"),
      description: t("settings.membership.toasts.manageDescription"),
    });
  };

  const handleRenewPlan = () => {
    updateMembershipState?.({
      currentPlan,
      planStartedAt: planStartedAt || new Date().toISOString(),
    });
    toast({
      title: t("settings.membership.toasts.renewedTitle"),
      description: t("settings.membership.toasts.renewedDescription"),
    });
  };

  const handleCancelSubscription = () => {
    updateMembershipState?.({
      autoRenew: false,
      billingStatus:
        currentPlan === t("settings.membership.free")
          ? t("settings.membership.billingStatuses.inactive")
          : t("settings.membership.billingStatuses.pendingCancel"),
    });
    toast({
      title: t("settings.membership.toasts.cancelTitle"),
      description: t("settings.membership.toasts.cancelDescription"),
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Crown className="h-6 w-6" />
            </span>
            {t("settings.membership.title")}
          </CardTitle>
          <CardDescription>{t("settings.membership.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="rounded-[28px] border border-border/60 bg-background/60 p-5">
            <p className="text-sm font-semibold">{t("settings.membership.currentPlan")}</p>
            <p className="mt-2 text-3xl font-semibold">{currentPlan}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("settings.membership.start", { date: formatDateTimeByLocale(planStartedAt, preferencesState, { dateStyle: "medium" }) })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("settings.membership.expiry", { date: formatDateTimeByLocale(membershipState?.planExpiresAt, preferencesState, { dateStyle: "medium" }) })}
            </p>
          </div>

          <div className="grid gap-3">
            <Button onClick={handleManagePlan}>
              <BadgeDollarSign className="mr-2 h-4 w-4" />
              {t("settings.membership.managePlan")}
            </Button>
            <Button variant="outline" onClick={handleRenewPlan}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("settings.membership.renewPlan")}
            </Button>
            <Button variant="outline" onClick={handleCancelSubscription}>
              <XCircle className="mr-2 h-4 w-4" />
              {t("settings.membership.cancelSubscription")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.membership.coverageTitle")}</CardTitle>
            <CardDescription>{t("settings.membership.coverageDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.membership.benefits")}</p>
              </div>
              {planData.benefits.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl border border-border/70 bg-background/50 p-4 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.membership.limitations")}</p>
              </div>
              {planData.limitations.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl border border-border/70 bg-background/50 p-4 text-sm">
                  <XCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.membership.usageTitle")}</CardTitle>
            <CardDescription>{t("settings.membership.usageDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <ProgressRow label={t("settings.membership.activeRooms")} current={usage.rooms} limit={currentPlan === t("settings.membership.free") ? 5 : 20} />
            <ProgressRow label={t("settings.membership.transactions")} current={usage.transactions} limit={currentPlan === t("settings.membership.free") ? 100 : 1000} />
            <ProgressRow label={t("settings.membership.positions")} current={usage.positions} limit={currentPlan === t("settings.membership.free") ? 25 : 200} />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.membership.billingTitle")}</CardTitle>
            <CardDescription>{t("settings.membership.billingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{t("settings.membership.billing")}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {membershipState?.billingStatus || t("settings.membership.billingStatuses.inactive")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{t("settings.membership.paymentMethod")}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {membershipState?.paymentMethod || t("settings.membership.noApplies")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.membership.paymentHistory")}</p>
              </div>
              {paymentHistory.length > 0 ? (
                paymentHistory.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                    <p className="text-sm font-semibold">{entry.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTimeByLocale(entry.date, preferencesState, { dateStyle: "medium" })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("settings.membership.noPayments")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.membership.comparisonTitle")}</CardTitle>
            <CardDescription>{t("settings.membership.comparisonDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className={`rounded-3xl border p-5 ${currentPlan === t("settings.membership.free") ? "border-primary bg-primary/10" : "border-border bg-background/50"}`}>
              <p className="text-lg font-semibold">{t("settings.membership.free")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("settings.membership.freeDescription")}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>{t("settings.membership.comparison.freeRooms")}</li>
                <li>{t("settings.membership.comparison.freeTransactions")}</li>
                <li>{t("settings.membership.comparison.freeBilling")}</li>
              </ul>
            </div>
            <div className={`rounded-3xl border p-5 ${currentPlan === t("settings.membership.pro") ? "border-primary bg-primary/10" : "border-border bg-background/50"}`}>
              <p className="text-lg font-semibold">{t("settings.membership.pro")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("settings.membership.proDescription")}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>{t("settings.membership.comparison.proRooms")}</li>
                <li>{t("settings.membership.comparison.proTransactions")}</li>
                <li>{t("settings.membership.comparison.proBilling")}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MembershipSettingsSection;
