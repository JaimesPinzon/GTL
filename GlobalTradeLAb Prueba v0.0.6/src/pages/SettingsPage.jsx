import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Crown,
  Headphones,
  KeyRound,
  Palette,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import ProfileSettingsSection from "@/components/settings/ProfileSettingsSection";
import AccountSettingsSection from "@/components/settings/AccountSettingsSection";
import SecuritySettingsSection from "@/components/settings/SecuritySettingsSection";
import NotificationsSettingsSection from "@/components/settings/NotificationsSettingsSection";
import AppearanceSettingsSection from "@/components/settings/AppearanceSettingsSection";
import MembershipSettingsSection from "@/components/settings/MembershipSettingsSection";
import PreferencesSettingsSection from "@/components/settings/PreferencesSettingsSection";
import RoomsSettingsSection from "@/components/settings/RoomsSettingsSection";
import SupportSettingsSection from "@/components/settings/SupportSettingsSection";
import AccessibilitySettingsSection from "@/components/settings/AccessibilitySettingsSection";
import PrivacySettingsSection from "@/components/settings/PrivacySettingsSection";
import SettingsActionBar from "@/components/SettingsActionBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SectionShell = ({ icon: Icon, title, description, children }) => (
  <Card className="glass-card mx-auto w-full max-w-5xl">
    <CardHeader className="space-y-3">
      <CardTitle className="flex items-center gap-3 text-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        {title}
      </CardTitle>
      <CardDescription className="text-base">{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const PlaceholderSection = ({ sectionMeta, t }) => {
  const { icon, title, description, bullets = [] } = sectionMeta;

  return (
    <SectionShell icon={icon} title={title} description={description}>
      <div className="grid gap-4 md:grid-cols-3">
        {bullets.map((item) => (
          <div key={item} className="rounded-2xl border border-border bg-background/50 p-5">
            <p className="text-sm font-semibold text-foreground">{item}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("settings.placeholders.pendingDescription")}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
};

const SettingsPage = ({ currentTheme, setThemeMode }) => {
  const { t } = useTranslation();
  const sections = useMemo(
    () => [
      {
        value: "profile",
        label: t("settings.sections.profile"),
        icon: User,
        title: t("settings.page.profile.title"),
        description: t("settings.page.profile.description"),
        bullets: [
          t("settings.page.profile.bullets.personal"),
          t("settings.page.profile.bullets.alias"),
          t("settings.page.profile.bullets.basics"),
        ],
      },
      {
        value: "account",
        label: t("settings.sections.account"),
        icon: Wallet,
        title: t("settings.page.account.title"),
        description: t("settings.page.account.description"),
        bullets: [
          t("settings.page.account.bullets.main"),
          t("settings.page.account.bullets.access"),
          t("settings.page.account.bullets.admin"),
        ],
      },
      {
        value: "security",
        label: t("settings.sections.security"),
        icon: KeyRound,
        title: t("settings.page.security.title"),
        description: t("settings.page.security.description"),
        bullets: [
          t("settings.page.security.bullets.password"),
          t("settings.page.security.bullets.login"),
          t("settings.page.security.bullets.sessions"),
        ],
      },
      {
        value: "preferences",
        label: t("settings.sections.preferences"),
        icon: SlidersHorizontal,
        title: t("settings.page.preferences.title"),
        description: t("settings.page.preferences.description"),
        bullets: [
          t("settings.page.preferences.bullets.region"),
          t("settings.page.preferences.bullets.timezone"),
          t("settings.page.preferences.bullets.behavior"),
        ],
      },
      {
        value: "appearance",
        label: t("settings.sections.appearance"),
        icon: Palette,
        title: t("settings.page.appearance.title"),
        description: t("settings.page.appearance.description"),
      },
      {
        value: "notifications",
        label: t("settings.sections.notifications"),
        icon: Bell,
        title: t("settings.page.notifications.title"),
        description: t("settings.page.notifications.description"),
        bullets: [
          t("settings.page.notifications.bullets.system"),
          t("settings.page.notifications.bullets.activity"),
          t("settings.page.notifications.bullets.future"),
        ],
      },
      {
        value: "rooms",
        label: t("settings.sections.rooms"),
        icon: Users,
        title: t("settings.page.rooms.title"),
        description: t("settings.page.rooms.description"),
        bullets: [
          t("settings.page.rooms.bullets.active"),
          t("settings.page.rooms.bullets.access"),
          t("settings.page.rooms.bullets.permissions"),
        ],
      },
      {
        value: "membership",
        label: t("settings.sections.membership"),
        icon: Crown,
        title: t("settings.page.membership.title"),
        description: t("settings.page.membership.description"),
        bullets: [
          t("settings.page.membership.bullets.plan"),
          t("settings.page.membership.bullets.benefits"),
          t("settings.page.membership.bullets.future"),
        ],
      },
      {
        value: "privacy",
        label: t("settings.sections.privacy"),
        icon: Shield,
        title: t("settings.page.privacy.title"),
        description: t("settings.page.privacy.description"),
        bullets: [
          t("settings.page.privacy.bullets.visibility"),
          t("settings.page.privacy.bullets.permissions"),
          t("settings.page.privacy.bullets.controls"),
        ],
      },
      {
        value: "accessibility",
        label: t("settings.sections.accessibility"),
        icon: Sun,
        title: t("settings.page.accessibility.title"),
        description: t("settings.page.accessibility.description"),
        bullets: [
          t("settings.page.accessibility.bullets.reading"),
          t("settings.page.accessibility.bullets.size"),
          t("settings.page.accessibility.bullets.visual"),
        ],
      },
      {
        value: "support",
        label: t("settings.sections.support"),
        icon: Headphones,
        title: t("settings.page.support.title"),
        description: t("settings.page.support.description"),
        bullets: [
          t("settings.page.support.bullets.center"),
          t("settings.page.support.bullets.channels"),
          t("settings.page.support.bullets.resources"),
        ],
      },
    ],
    [t]
  );
  const sectionsById = useMemo(
    () => Object.fromEntries(sections.map((section) => [section.value, section])),
    [sections]
  );
  const [activeSection, setActiveSection] = useState("profile");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="sticky top-0 z-20 w-full">
        <SettingsActionBar
          items={sections.map(({ value, label }) => ({ value, label }))}
          activeItem={activeSection}
          onSelectItem={setActiveSection}
          themeMode={currentTheme}
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {activeSection === "profile" ? (
          <ProfileSettingsSection />
        ) : activeSection === "account" ? (
          <AccountSettingsSection />
        ) : activeSection === "security" ? (
          <SecuritySettingsSection />
        ) : activeSection === "notifications" ? (
          <NotificationsSettingsSection />
        ) : activeSection === "preferences" ? (
          <PreferencesSettingsSection />
        ) : activeSection === "appearance" ? (
          <AppearanceSettingsSection currentTheme={currentTheme} setThemeMode={setThemeMode} />
        ) : activeSection === "rooms" ? (
          <RoomsSettingsSection />
        ) : activeSection === "membership" ? (
          <MembershipSettingsSection />
        ) : activeSection === "privacy" ? (
          <PrivacySettingsSection />
        ) : activeSection === "accessibility" ? (
          <AccessibilitySettingsSection />
        ) : activeSection === "support" ? (
          <SupportSettingsSection />
        ) : (
          <PlaceholderSection sectionMeta={sectionsById[activeSection]} t={t} />
        )}
      </div>
    </motion.div>
  );
};

export default SettingsPage;
