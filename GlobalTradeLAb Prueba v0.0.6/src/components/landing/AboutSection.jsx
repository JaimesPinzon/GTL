import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getAboutCards } from "./landingData";

export const AboutSection = () => {
  const { t, i18n } = useTranslation();
  const aboutCards = useMemo(() => getAboutCards(t), [t, i18n.resolvedLanguage]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="landing-about-panel rounded-[36px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="landing-section-label justify-center">{t("landing.about.label")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
            {t("landing.about.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{t("landing.about.description")}</p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl text-center">
          <p className="text-base leading-8 text-slate-200 sm:text-lg">{t("landing.about.paragraph1")}</p>
          <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">{t("landing.about.paragraph2")}</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {aboutCards.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="landing-card rounded-[28px] border-white/8 bg-[linear-gradient(180deg,rgba(22,31,48,0.94),rgba(13,19,31,0.98))] p-6 transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_28px_60px_rgba(7,14,30,0.42)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-400/10 text-blue-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-4xl text-center text-base leading-8 text-slate-400 sm:text-lg">
          {t("landing.about.footnote")}
        </p>
      </div>
    </section>
  );
};
