import React from "react";
import { WalletCards } from "lucide-react";
import { useTranslation } from "react-i18next";

import StudentPortfolioPage from "@/components/Students/StudentPortfolioPage";
import TeacherPortfolio from "@/components/teacher/TeacherPortfolio";
import { useTradingContext } from "@/contexts/TradingContext";

const ClassPortfolioPage = () => {
  const { t } = useTranslation();
  const { user } = useTradingContext();

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1520px] p-4 md:p-6">
        <div className="mb-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <WalletCards className="h-4 w-4" /> {t("classes.workspace.portfolios.eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t("classes.workspace.portfolios.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {user?.role === "teacher"
              ? t("classes.workspace.portfolios.teacherDescription")
              : t("classes.workspace.portfolios.studentDescription")}
          </p>
        </div>

        {user?.role === "teacher" ? <TeacherPortfolio /> : <StudentPortfolioPage />}
      </div>
    </div>
  );
};

export default ClassPortfolioPage;
