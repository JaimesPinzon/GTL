import React, { useMemo } from "react";
import {
  BarChart3,
  BookOpenCheck,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  WalletCards,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useClassContext } from "@/features/classes/context/ClassContext";
import { useClassShortcuts } from "@/features/classes/hooks/useClassShortcuts";
import { CLASS_CONTEXT_NAV_ITEMS, buildClassRoute } from "@/lib/routes";

const shortcutIcons = {
  dashboard: LayoutDashboard,
  overview: GraduationCap,
  markets: BarChart3,
  financialLab: FlaskConical,
  portfolios: WalletCards,
  academic: BookOpenCheck,
};

const ClassHeader = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { activeClassId } = useClassContext() || {};
  const { isCollapsed } = useClassShortcuts();

  const shortcuts = useMemo(
    () => CLASS_CONTEXT_NAV_ITEMS.map((item) => ({
      ...item,
      icon: shortcutIcons[item.id],
      label: item.id === "dashboard" ? "Dashboard" : t(`classes.workspace.navigation.${item.id}`),
      to: activeClassId ? buildClassRoute(activeClassId, item.path) : "/app/classes",
    })),
    [activeClassId, t]
  );

  if (isCollapsed) return null;

  return (
    <div className="relative z-20 shrink-0 border-b border-white/8 bg-[#080e19]/92 backdrop-blur-xl">
      <nav
        id="class-quick-shortcuts"
        className="scrollbar-page flex h-9 min-w-0 items-center gap-0.5 overflow-x-auto px-2 md:px-4"
        aria-label={t("classes.workspace.quickAccess")}
      >
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          const active = location.pathname === shortcut.to || location.pathname.startsWith(`${shortcut.to}/`);

          return (
            <NavLink
              key={shortcut.id}
              to={shortcut.to}
              className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs transition ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{shortcut.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default ClassHeader;
