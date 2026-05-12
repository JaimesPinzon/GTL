import React, { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStartSteps } from "./landingData";

export const LearningSection = () => {
  const { t, i18n } = useTranslation();
  const startSteps = useMemo(() => getStartSteps(t), [t, i18n.resolvedLanguage]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="landing-card rounded-[32px] p-8 lg:p-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="landing-section-label">{t("landing.learning.label")}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              {t("landing.learning.title")}
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm text-blue-200">
            <BookOpen className="h-4 w-4" />
            {t("landing.learning.badge")}
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {startSteps.map((step, index) => (
            <article key={`${index}-${step}`} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                {t("landing.learning.stepLabel", { step: index + 1 })}
              </p>
              <p className="mt-4 text-base leading-8 text-slate-200">{step}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
