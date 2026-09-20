import React, { useMemo } from "react";
import {
  BarChart3,
  BookOpenCheck,
  FlaskConical,
  LayoutDashboard,
  WalletCards,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useClassContext } from "@/features/classes/context/ClassContext";
import { CLASS_CONTEXT_NAV_ITEMS, buildClassRoute } from "@/lib/routes";
import { preloadPath } from "@/lib/route-loaders";

const icons = {
  overview: LayoutDashboard,
  markets: BarChart3,
  financialLab: FlaskConical,
  portfolios: WalletCards,
  academic: BookOpenCheck,
};

const ClassNavigation = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { activeClassId } = useClassContext() || {};

  const items = useMemo(
    () =>
      CLASS_CONTEXT_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(`classes.workspace.navigation.${item.id}`),
        icon: icons[item.id],
        to: activeClassId ? buildClassRoute(activeClassId, item.path) : "/app/classes",
      })),
    [activeClassId, t]
  );

  const isItemActive = (item) => {
    if (!activeClassId) return false;

    const basePath = buildClassRoute(activeClassId, item.path);
    if (item.id === "markets") {
      return (
        location.pathname.startsWith(basePath) ||
        location.pathname === buildClassRoute(activeClassId, "dashboard")
      );
    }

    if (item.id === "financialLab") {
      return (
        location.pathname.startsWith(basePath) ||
        location.pathname === buildClassRoute(activeClassId, "financial-lab")
      );
    }

    return location.pathname === basePath || location.pathname.startsWith(`${basePath}/`);
  };

  return (
    <nav
      className="scrollbar-page flex min-w-0 gap-1 overflow-x-auto"
      aria-label={t("classes.workspace.navigationAriaLabel")}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item);

        return (
          <NavLink
            key={item.id}
            to={item.to}
            onFocus={() => void preloadPath(item.to).catch(() => {})}
            onPointerEnter={() => void preloadPath(item.to).catch(() => {})}
            className={`group relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition md:px-4 ${
              active ? "text-white" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-slate-500 group-hover:text-slate-300"}`} />
            <span>{item.label}</span>
            {active ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default ClassNavigation;
