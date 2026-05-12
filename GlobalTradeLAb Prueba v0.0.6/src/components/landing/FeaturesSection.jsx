import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getFeatureCards } from "./landingData";

export const FeaturesSection = () => {
  const { t, i18n } = useTranslation();
  const featureCards = useMemo(() => getFeatureCards(t), [t, i18n.resolvedLanguage]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="landing-feature-panel rounded-[36px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="landing-section-label justify-center">{t("landing.features.label")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
            {t("landing.features.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">{t("landing.features.description")}</p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {featureCards.map(({ icon: Icon, title, description }, index) => (
            <article
              key={title}
              className="landing-feature-card rounded-[28px] p-6 transition duration-300 hover:-translate-y-1 hover:border-blue-300/40 hover:shadow-[0_26px_50px_rgba(37,99,235,0.16)]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-400/10 text-blue-300 transition duration-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-4xl text-center text-base leading-8 text-slate-400 sm:text-lg">
          {t("landing.features.footnote")}
        </p>
      </div>
    </section>
  );
};
