import React from "react";
import { BookOpenCheck, LayoutDashboard, Library, Map, Settings2, UserCircle } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useTradingContext } from "@/contexts/TradingContext";
import { useLearning } from "@/features/learning/context/LearningContext";
import { resolveLearningLocale } from "@/features/learning/data/learningCatalog";
import { getLearningCopy } from "@/features/learning/data/learningCopy";

const LearningShell = () => {
  const { i18n } = useTranslation();
  const { user } = useTradingContext();
  const { catalog } = useLearning();
  const locale = resolveLearningLocale(i18n.resolvedLanguage);
  const copy = getLearningCopy(locale);
  const canManage = ["teacher", "admin"].includes(user?.role);
  const navItems = [
    { id: "home", label: copy.nav.home, to: "/app/learn", icon: LayoutDashboard, end: true },
    { id: "explore", label: copy.nav.explore, to: "/app/learn/explore", icon: Library },
    { id: "paths", label: copy.nav.paths, to: "/app/learn/paths", icon: Map },
    { id: "mine", label: copy.nav.mine, to: "/app/learn/my-learning", icon: UserCircle },
    ...(canManage ? [{ id: "manage", label: copy.nav.manage, to: "/app/learn/manage", icon: Settings2 }] : []),
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsla(var(--primary)/.08),transparent_34%)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 md:px-7 lg:flex-row lg:items-center lg:justify-between">
          <NavLink to="/app/learn" end className="flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><BookOpenCheck className="h-5 w-5" /></span>
            <div><p className="text-lg font-semibold tracking-tight">{copy.brand}</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">GlobalTradeLab</p></div>
          </NavLink>
          <nav className="scrollbar-dashboard -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" aria-label={copy.brand}>
            {navItems.map(({ id, label, to, icon: Icon, end }) => (
              <NavLink
                key={id}
                to={to}
                end={end}
                className={({ isActive }) => cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />{label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-7 md:px-7 md:py-9">
        <Outlet context={{ copy, catalog, locale, canManage }} />
      </div>
    </div>
  );
};

export default LearningShell;
