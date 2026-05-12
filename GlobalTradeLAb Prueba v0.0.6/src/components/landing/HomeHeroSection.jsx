import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { APP_HOME_PATH, resolvePreferredHomePage } from "@/lib/routes";
import landingBackground from "./Background.png";

export const HomeHeroSection = ({ isAuthenticated, user, preferencesState }) => {
  const { t } = useTranslation();
  const platformPath = isAuthenticated ? resolvePreferredHomePage(user, preferencesState) : APP_HOME_PATH;

  return (
    <section className="relative isolate">
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="landing-glow landing-glow-left pointer-events-none absolute left-[-10%] top-24 h-80 w-80 rounded-full" />
      <div className="landing-glow landing-glow-right pointer-events-none absolute right-[-8%] top-12 h-96 w-96 rounded-full" />

      <div className="w-full -mt-[16px] px-0 pb-16 pt-0 lg:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-9"
        >
          <div className="landing-hero-media relative overflow-hidden">
            <img
              src={landingBackground}
              alt=""
              aria-hidden="true"
              className="landing-hero-image absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="landing-hero-overlay absolute inset-0" />

            <div className="relative flex min-h-[calc(100vh-6rem)] items-end px-6 py-8 sm:px-10 lg:min-h-[calc(100vh-6rem)] lg:px-14 lg:py-12">
              <div className="max-w-4xl">
                <span className="text-sm font-medium text-blue-200">{t("landing.hero.kicker")}</span>
                <h1 className="mt-6 max-w-5xl text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl lg:text-[5.5rem]">
                  {t("landing.hero.title")}
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl lg:text-[1.45rem]">
                  {t("landing.hero.description")}
                </p>

                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Button asChild size="lg" className="rounded-2xl bg-blue-500 px-7 text-base font-semibold text-white hover:bg-blue-400">
                    <Link to={isAuthenticated ? platformPath : "/register"}>{t("common.actions.register")}</Link>
                  </Button>
                  <Button asChild size="lg" variant="ghost" className="rounded-2xl border border-white/10 bg-white/5 px-7 text-base text-white hover:bg-white/10">
                    <Link to="/login">{t("common.actions.logIn")}</Link>
                  </Button>
                </div>

                <div className="mt-8 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
                  {t("landing.hero.footnote")}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const HomeDirectorySection = () => null;
