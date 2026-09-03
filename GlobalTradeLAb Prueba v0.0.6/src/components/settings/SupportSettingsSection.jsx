import React from "react";
import {
  BookOpen,
  Bug,
  Copy,
  FileCheck2,
  Headphones,
  HelpCircle,
  Lightbulb,
  Mail,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const SUPPORT_EMAIL = "globaltradelab.edu@gmail.com";
const PLATFORM_VERSION = "0.0.4";

const SupportSettingsSection = () => {
  const { t } = useTranslation();
  const { user, activeRoom, roomMembers } = useTradingContext();
  const { toast } = useToast();

  const teacherEmail =
    user?.role === "student"
      ? roomMembers.find((member) => member.roleInRoom === "teacher")?.profile?.email || null
      : null;

  const faqItems = [1, 2, 3, 4].map((index) => ({
    question: t(`settings.support.faq.q${index}`),
    answer: t(`settings.support.faq.a${index}`),
  }));

  const legalItems = [
    {
      icon: Scale,
      title: t("settings.support.legal.termsTitle"),
      description: t("settings.support.legal.termsDescription"),
    },
    {
      icon: ShieldCheck,
      title: t("settings.support.legal.privacyTitle"),
      description: t("settings.support.legal.privacyDescription"),
    },
    {
      icon: FileCheck2,
      title: t("settings.support.legal.licensesTitle"),
      description: t("settings.support.legal.licensesDescription"),
    },
  ];

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t("settings.support.copySuccessTitle"),
        description: t("settings.support.copiedDescription", { label }),
      });
    } catch (error) {
      console.error("copyToClipboard error", error);
      toast({
        title: t("settings.support.copyErrorTitle"),
        description: t("settings.support.copyErrorDescription", { label }),
        variant: "destructive",
      });
    }
  };

  const openMailTo = (subject, body) => {
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Headphones className="h-6 w-6" />
            </span>
            {t("settings.support.title")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("settings.support.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.support.helpCenter")}</p>
            <p className="settings-context-help mt-2 text-sm text-foreground">{t("settings.support.helpCenterDescription")}</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.support.currentVersion")}</p>
            <p className="mt-2 text-sm font-medium text-foreground">GTL v{PLATFORM_VERSION}</p>
            <p className="settings-context-help mt-1 text-xs text-muted-foreground">{t("settings.support.versionHelp")}</p>
          </div>

          {user?.role === "student" && teacherEmail ? (
            <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.support.linkedTeacher")}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{teacherEmail}</p>
              <p className="settings-context-help mt-1 text-xs text-muted-foreground">
                {activeRoom?.name
                  ? t("settings.support.teacherHelpRoom", { room: activeRoom.name })
                  : t("settings.support.teacherHelpGeneric")}
              </p>
              <Button className="mt-3" variant="outline" onClick={() => copyToClipboard(teacherEmail, t("settings.support.linkedTeacher"))}>
                <Copy className="mr-2 h-4 w-4" />
                {t("settings.support.copyTeacherEmail")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.support.faqTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.support.faqDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.support.helpCenter")}</p>
              </div>
              <p className="settings-context-help mt-2 text-sm text-muted-foreground">{t("settings.support.supportCenterDescription")}</p>
            </div>

            <div className="grid gap-4">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.question}</p>
                      <p className="settings-context-help mt-2 text-sm text-muted-foreground">{item.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.support.contactTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.support.contactDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.support.supportContact")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{SUPPORT_EMAIL}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => copyToClipboard(SUPPORT_EMAIL, t("settings.support.supportContact"))}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t("settings.support.copy")}
                </Button>
                <Button onClick={() => openMailTo(t("settings.support.subjects.support"), t("settings.support.bodies.support"))}>
                  <Mail className="mr-2 h-4 w-4" />
                  {t("settings.support.contact")}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.support.reportError")}</p>
              </div>
              <p className="settings-context-help mt-2 text-sm text-muted-foreground">{t("settings.support.errorDescription")}</p>
              <Button className="mt-4" onClick={() => openMailTo(t("settings.support.subjects.error"), t("settings.support.bodies.error", { version: PLATFORM_VERSION }))}>
                <Bug className="mr-2 h-4 w-4" />
                {t("settings.support.sendReport")}
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.support.sendSuggestion")}</p>
              </div>
              <p className="settings-context-help mt-2 text-sm text-muted-foreground">{t("settings.support.suggestionDescription")}</p>
              <Button className="mt-4" variant="outline" onClick={() => openMailTo(t("settings.support.subjects.suggestion"), t("settings.support.bodies.suggestion"))}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("settings.support.sendSuggestion")}
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.support.adminHelp")}</p>
              </div>
              <p className="settings-context-help mt-2 text-sm text-muted-foreground">{t("settings.support.adminHelpDescription")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.support.legalTitle")}</CardTitle>
            <CardDescription className="settings-context-help">{t("settings.support.legalDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {legalItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="rounded-2xl border border-border/70 bg-background/50 p-5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">{item.title}</p>
                  </div>
                  <p className="settings-context-help mt-3 text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SupportSettingsSection;

