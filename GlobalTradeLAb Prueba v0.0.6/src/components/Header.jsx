import React from "react";
import { motion } from "framer-motion";
import { Bell, DollarSign, LogOut, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/market-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { t } = useTranslation();
  const {
    user,
    logout,
    notifications = [],
    preferencesState,
    activeRoomId,
    activeRoomAccount,
    activeRoomAccountStatus,
    activeRoom,
  } = useTradingContext();
  const location = useLocation();
  const roomPathMatch = location.pathname.match(/^\/app\/classes\/([^/]+)(\/.*)?$/);
  const routeRoomId = roomPathMatch?.[1] || null;
  const isInsideClassWorkspace = Boolean(roomPathMatch);
  const resolvedRoomId = routeRoomId || activeRoomId || null;
  const shouldShowContextBalance = Boolean(user) && isInsideClassWorkspace && Boolean(resolvedRoomId);
  const account = activeRoomAccount?.roomId === resolvedRoomId ? activeRoomAccount : null;
  const resolvedCurrency = account?.currency || activeRoom?.defaultCurrency ||
    preferencesState?.preferredCurrency || "USD";
  const balanceLabel = account
    ? formatCurrency(account.totalBalance ?? account.availableBalance, resolvedCurrency)
    : t(activeRoomAccountStatus === "loading" ? "common.states.loading" : "common.states.unavailable");

  return (
    <header className="app-chrome sticky top-0 z-30 shrink-0 border-b app-chrome-divider px-5 py-4 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center"
        >
          <h1
            className="notranslate bg-gradient-to-r from-[#76a2ff] via-[#4f82ff] to-[#2f66e3] bg-clip-text text-2xl font-bold text-transparent"
            translate="no"
          >
            {t("common.appName")}
          </h1>
        </motion.div>

        <div className="flex items-center gap-3">
          {shouldShowContextBalance ? (
            <div className="flex items-center rounded-full border border-border/70 bg-secondary/70 px-4 py-2.5 shadow-[inset_0_1px_0_hsla(var(--background)/0.12)]">
              <DollarSign className="mr-2 h-4 w-4 text-green-400" />
              <span className="font-medium" title={t("trading.form.totalBalanceLabel")}>
                {balanceLabel}
              </span>
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full border border-border/70 bg-secondary/55 hover:bg-accent">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 ? (
                  <span className="absolute right-0 top-0 block h-2 w-2 rounded-full bg-red-500" />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>{t("common.notifications.title")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t("common.notifications.empty")}
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <DropdownMenuItem key={index}>{notification.message}</DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex max-w-[280px] items-center rounded-full border border-border/70 bg-secondary/70 px-4 py-2.5 shadow-[inset_0_1px_0_hsla(var(--background)/0.12)]">
                <User className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate font-medium">{user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("navigation.header.logoutAriaLabel")}
                className="rounded-full border border-border/70 bg-secondary/55 hover:bg-accent"
                onClick={logout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Button variant="secondary" asChild>
              <Link to="/login">{t("navigation.header.guestCta")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
