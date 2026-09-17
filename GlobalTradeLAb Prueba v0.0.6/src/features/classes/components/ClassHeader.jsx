import React, { useState } from "react";
import { ArrowLeft, Check, ChevronDown, ClipboardList, Copy, MoreHorizontal, Settings2, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ClassNavigation from "@/features/classes/components/ClassNavigation";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { useTradingContext } from "@/contexts/TradingContext";
import { CLASS_CONTEXT_PATHS, GLOBAL_APP_PATHS, buildClassEditRoute, buildClassRoute } from "@/lib/routes";

const ClassHeader = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useTradingContext();
  const { accessibleClasses, activeClass, selectActiveClass } = useClassContext() || {};
  const [copied, setCopied] = useState(false);

  const copyAccessCode = async () => {
    if (!activeClass?.accessCode) return;

    await navigator.clipboard.writeText(activeClass.accessCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <header className="relative z-20 shrink-0 border-b border-white/8 bg-[#0b111d]/96 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1520px] px-4 md:px-6">
        <div className="flex min-h-[82px] items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl border border-white/8 text-slate-300 hover:bg-white/[0.05] hover:text-white"
              onClick={() => navigate(GLOBAL_APP_PATHS.classes)}
              aria-label={t("classes.actions.backToClasses")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("classes.workspace.activeClass")}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-lg font-semibold text-white md:text-xl">{activeClass?.name}</h1>
                {accessibleClasses?.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 rounded-lg text-slate-400 hover:bg-white/[0.05] hover:text-white"
                        aria-label={t("classes.workspace.changeClass")}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuLabel>{t("classes.workspace.changeClass")}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {accessibleClasses.map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          onSelect={() => void selectActiveClass?.(item.id, { navigateToHome: true })}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="truncate">{item.name}</span>
                          {item.id === activeClass?.id ? <Check className="h-4 w-4 text-primary" /> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-2 text-xs font-medium text-primary sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {user?.role === "teacher"
                ? t("classes.workspace.teacherRole")
                : t("classes.workspace.studentRole")}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl border border-white/8 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  aria-label={t("classes.workspace.classActions")}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>{t("classes.workspace.administration")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === "teacher" ? (
                  <>
                    <DropdownMenuItem onSelect={() => navigate(buildClassEditRoute(activeClass.id))}>
                      <Settings2 className="mr-2 h-4 w-4" />
                      {t("classes.workspace.classSettings")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate(buildClassRoute(activeClass.id, CLASS_CONTEXT_PATHS.audit))}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      {t("classes.workspace.audit")}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem onSelect={() => void copyAccessCode()} disabled={!activeClass?.accessCode}>
                  {copied ? <Check className="mr-2 h-4 w-4 text-emerald-400" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? t("classes.workspace.codeCopied") : t("classes.workspace.copyCode")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ClassNavigation />
      </div>
    </header>
  );
};

export default ClassHeader;
