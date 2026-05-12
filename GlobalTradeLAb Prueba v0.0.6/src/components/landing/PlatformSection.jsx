import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import gtlDashboardImage from "./GTL DASHBOARD.png";
import { getPlatformHotspots, getPlatformScreens } from "./landingData";

export const PlatformSection = () => {
  const { t, i18n } = useTranslation();
  const platformHotspots = useMemo(() => getPlatformHotspots(t), [t, i18n.resolvedLanguage]);
  const platformScreens = useMemo(() => getPlatformScreens(t), [t, i18n.resolvedLanguage]);
  const [activeHotspot, setActiveHotspot] = useState(platformHotspots[1] || platformHotspots[0]);
  const [activeScreen, setActiveScreen] = useState(platformScreens[0]);
  const ActiveScreenIcon = activeScreen.icon;

  useEffect(() => {
    setActiveHotspot(platformHotspots[1] || platformHotspots[0]);
    setActiveScreen(platformScreens[0]);
  }, [platformHotspots, platformScreens]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="landing-section-label justify-center">{t("landing.platform.label")}</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
          {t("landing.platform.title")}
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{t("landing.platform.description")}</p>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-400">{t("landing.platform.subdescription")}</p>
      </div>

      <div className="mt-14 grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="landing-panel rounded-[36px] border border-white/10 p-6 lg:p-7">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-blue-200/80">{t("landing.platform.mockupLabel")}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                {t("landing.platform.mockupTitle")}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                {t("landing.platform.mockupDescription")}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-100">
              <LayoutDashboard className="h-4 w-4" />
              {t("landing.platform.badge")}
            </div>
          </div>

          <div className="mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,20,34,0.98),rgba(8,12,22,0.99))] p-4 shadow-[0_24px_64px_rgba(2,8,24,0.34)] lg:p-5">
            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/35">
              <img src={gtlDashboardImage} alt={t("landing.platform.dashboardAlt")} className="h-auto w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 hidden lg:block">
                {platformHotspots.map((spot) => (
                  <button
                    key={spot.id}
                    type="button"
                    onMouseEnter={() => setActiveHotspot(spot)}
                    onFocus={() => setActiveHotspot(spot)}
                    onClick={() => setActiveHotspot(spot)}
                    className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-[0_12px_24px_rgba(2,8,24,0.35)] transition ${
                      activeHotspot?.id === spot.id ? "border-blue-300 bg-blue-500 text-white" : "border-white/15 bg-slate-950/78 text-blue-100 hover:border-blue-300/45 hover:bg-slate-900"
                    }`}
                    style={{ top: spot.top, left: spot.left }}
                  >
                    {spot.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-blue-200/80">{t("landing.platform.zonesTitle")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {platformHotspots.map((spot) => (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => setActiveHotspot(spot)}
                    className={`platform-zone-card rounded-2xl border px-4 py-4 text-left transition ${
                      activeHotspot?.id === spot.id ? "platform-zone-card-active border-blue-300/45 bg-blue-500/12" : "border-white/10 bg-slate-950/30 hover:border-blue-400/30 hover:bg-white/10"
                    }`}
                  >
                    <p className="platform-zone-card-title text-sm font-semibold text-white">{spot.title}</p>
                    <p className="platform-zone-card-copy mt-2 text-xs leading-6 text-slate-400">{spot.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-5">
          <article className="landing-card rounded-[30px] p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-blue-200/80">{t("landing.platform.secondaryScreensLabel")}</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{t("landing.platform.secondaryScreensTitle")}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t("landing.platform.secondaryScreensDescription")}</p>

            <div className="mt-5 grid gap-3">
              {platformScreens.map((screen) => {
                const Icon = screen.icon;
                return (
                  <button
                    key={screen.id}
                    type="button"
                    onClick={() => setActiveScreen(screen)}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${
                      activeScreen.id === screen.id ? "border-blue-300/45 bg-blue-500/12" : "border-white/10 bg-white/5 hover:border-blue-400/30 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-white">{screen.title}</h4>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{screen.caption}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="landing-card rounded-[30px] p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-blue-200/80">{t("landing.platform.activeScreenLabel")}</p>
            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-300">
                  <ActiveScreenIcon className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-semibold text-white">{activeScreen.title}</h4>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">{activeScreen.caption}</p>
            </div>
            <Button asChild className="mt-5 rounded-2xl bg-blue-500 px-6 text-white hover:bg-blue-400">
              <Link to="/register">{t("landing.platform.exploreCta")}</Link>
            </Button>
          </article>
        </div>
      </div>
    </section>
  );
};
