import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Facebook, Check, ChevronUp, Globe, Instagram, Linkedin, Send, Youtube } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { APP_HOME_PATH, resolvePreferredHomePage } from "@/lib/routes";
import { getFooterGroups, getPublicNavItems } from "./landingData";

export const LandingLayout = ({ children, isAuthenticated, user, preferencesState, flushTop = false }) => {
  const { t, i18n } = useTranslation();
  const platformPath = isAuthenticated ? resolvePreferredHomePage(user, preferencesState) : APP_HOME_PATH;
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);
  const publicNavItems = useMemo(() => getPublicNavItems(t), [t, i18n.resolvedLanguage]);
  const footerGroups = useMemo(() => getFooterGroups(t), [t, i18n.resolvedLanguage]);
  const languageOptions = useMemo(
    () => [
      { value: "es", label: "Espanol" },
      { value: "en", label: "English" },
    ],
    []
  );
  const currentLanguage = i18n.resolvedLanguage?.startsWith("en") ? "en" : "es";
  const currentLanguageLabel =
    languageOptions.find((option) => option.value === currentLanguage)?.label || t("common.languageName");

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (!languageMenuRef.current?.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isLanguageMenuOpen]);

  const handleLanguageChange = async (nextLanguage) => {
    await i18n.changeLanguage(nextLanguage);
    setIsLanguageMenuOpen(false);
  };

  return (
    <div className="landing-shell bg-slate-950 text-slate-50" data-landing-theme="dark">
      <header className="landing-header fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt={t("landing.brand.logoAlt")} className="h-11 w-11 rounded-xl object-cover shadow-[0_8px_24px_rgba(15,23,42,0.35)]" />
            <span className="block truncate bg-gradient-to-r from-[#76a2ff] via-[#4f82ff] to-[#2f66e3] bg-clip-text text-[1.9rem] font-bold tracking-tight text-transparent sm:text-[2.1rem]">
              GlobalTradeLab
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {publicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `text-sm font-medium transition ${isActive ? "text-white" : "text-slate-300 hover:text-white"}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden rounded-xl border border-white/10 text-slate-100 hover:bg-white/10 sm:inline-flex">
              <Link to="/login">{t("common.actions.logIn")}</Link>
            </Button>
            <Button asChild className="rounded-xl bg-blue-500 text-white hover:bg-blue-400">
              <Link to={isAuthenticated ? platformPath : "/register"}>{t("common.actions.register")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className={`overflow-hidden ${flushTop ? "pt-0" : "pt-24"}`}>{children}</main>

      <footer className="landing-footer border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 xl:grid-cols-[1.15fr_2fr]">
            <div className="space-y-7">
              <div>
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt={t("landing.brand.logoAlt")} className="h-12 w-12 rounded-2xl object-cover shadow-[0_8px_24px_rgba(15,23,42,0.28)]" />
                  <div>
                    <p className="bg-gradient-to-r from-[#76a2ff] via-[#4f82ff] to-[#2f66e3] bg-clip-text text-[2rem] font-bold tracking-tight text-transparent">GlobalTradeLab</p>
                  </div>
                </div>
                <p className="landing-footer-copy mt-5 max-w-md text-sm leading-7">{t("landing.footer.description")}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {[{ icon: Send, label: "Telegram" }, { icon: Facebook, label: "Facebook" }, { icon: Youtube, label: "YouTube" }, { icon: Instagram, label: "Instagram" }, { icon: Linkedin, label: "LinkedIn" }].map(({ icon: Icon, label }) => (
                  <button key={label} type="button" className="landing-footer-social flex h-11 w-11 items-center justify-center rounded-2xl transition" aria-label={label}>
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>

              <div className="landing-footer-lang inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium">
                <Globe className="h-5 w-5" />
                <span>{currentLanguageLabel}</span>
              </div>

              <div className="space-y-4">
                <p className="landing-footer-legal text-sm leading-7">{t("landing.footer.legal.dataNotice")}</p>
                <p className="landing-footer-legal text-sm leading-7">{t("landing.footer.legal.educationalNotice")}</p>
                <p className="landing-footer-legal text-sm leading-7">{t("landing.footer.legal.copyright")}</p>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <p className="landing-footer-heading text-sm uppercase tracking-[0.18em]">{group.title}</p>
                  <div className="mt-5 space-y-3">
                    {group.links.map((linkItem) => (
                      <NavLink key={`${group.title}-${linkItem.label}`} to={linkItem.to} className="landing-footer-link block text-[1.05rem] font-medium leading-7 transition">
                        {linkItem.label}
                      </NavLink>
                    ))}
                  </div>

                  {group.title === t("landing.footer.groups.explore.title") ? (
                    <div className="mt-8 space-y-7">
                      <div>
                        <p className="landing-footer-heading text-sm uppercase tracking-[0.18em]">{t("landing.footer.contact.title")}</p>
                        <div className="mt-4 space-y-2">
                          <a href="mailto:globaltradelab.edu@gmail.com" className="landing-footer-mini-link block transition">
                            globaltradelab.edu@gmail.com
                          </a>
                          <NavLink to="/contacto" className="landing-footer-mini-link block transition">
                            {t("landing.footer.contact.formLink")}
                          </NavLink>
                        </div>
                      </div>

                      <div>
                        <p className="landing-footer-heading text-sm uppercase tracking-[0.18em]">{t("landing.footer.legal.title")}</p>
                        <div className="mt-4 space-y-2">
                          <NavLink to="/contacto?topic=terminos" className="landing-footer-mini-link block transition">
                            {t("landing.footer.legal.termsLink")}
                          </NavLink>
                          <NavLink to="/contacto?topic=privacidad" className="landing-footer-mini-link block transition">
                            {t("landing.footer.legal.privacyLink")}
                          </NavLink>
                        </div>
                      </div>

                      <div>
                        <p className="landing-footer-heading text-sm uppercase tracking-[0.18em]">{t("landing.footer.support.title")}</p>
                        <div className="mt-4 space-y-2">
                          <NavLink to="/contacto?topic=soporte" className="landing-footer-mini-link block transition">
                            {t("landing.footer.support.helpCenterLink")}
                          </NavLink>
                          <NavLink to="/contacto" className="landing-footer-mini-link block transition">
                            {t("landing.footer.support.platformSupportLink")}
                          </NavLink>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-blue-400/15 bg-blue-500/8 px-5 py-4">
            <p className="landing-footer-heading text-sm uppercase tracking-[0.18em]">{t("landing.footer.noticeTitle")}</p>
            <p className="landing-footer-copy mt-3 max-w-4xl text-sm leading-7">{t("landing.footer.notice")}</p>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/8 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="landing-footer-copy">{t("landing.footer.navigationTitle")}</p>
            <div className="flex flex-wrap gap-5">
              {publicNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} className="landing-footer-mini-link transition">
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <div ref={languageMenuRef} className="fixed bottom-5 left-5 z-[70]">
        {isLanguageMenuOpen ? (
          <div className="mb-3 w-[220px] overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/95 p-2 shadow-[0_18px_46px_rgba(2,8,24,0.5)] backdrop-blur">
            {languageOptions.map((option) => {
              const isActive = option.value === currentLanguage;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleLanguageChange(option.value)}
                  className={`flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-500/14 text-white"
                      : "text-slate-200 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  <span>{option.label}</span>
                  {isActive ? <Check className="h-4 w-4 text-blue-300" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsLanguageMenuOpen((previous) => !previous)}
          className="inline-flex items-center gap-3 rounded-[18px] border border-white/10 bg-slate-950/88 px-5 py-3 text-base font-semibold text-slate-100 shadow-[0_16px_40px_rgba(2,8,24,0.42)] backdrop-blur transition hover:border-blue-400/25 hover:bg-slate-900/96"
          aria-haspopup="menu"
          aria-expanded={isLanguageMenuOpen}
          aria-label={t("landing.language.currentAriaLabel", { language: currentLanguageLabel })}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/16 bg-white/4">
            <Globe className="h-4.5 w-4.5 text-slate-100" />
          </span>
          <span>{currentLanguageLabel}</span>
          <ChevronUp className={`h-4 w-4 text-slate-300 transition-transform ${isLanguageMenuOpen ? "" : "rotate-180"}`} />
        </button>
      </div>
    </div>
  );
};
