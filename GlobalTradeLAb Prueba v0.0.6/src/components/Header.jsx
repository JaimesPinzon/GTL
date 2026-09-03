import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, DollarSign, LogOut, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/market-data";
import {
  fetchResolvedUserRoomAccount,
  resolveUserRoomAccount,
  subscribeToRoomAccount,
} from "@/lib/room-balance";
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
    authenticatedUserId,
    balance,
    logout,
    notifications = [],
    preferencesState,
    activeRoomId,
    roomAccounts,
    roomMembers,
    activeRoom,
  } = useTradingContext();
  const location = useLocation();
  const roomPathMatch = location.pathname.match(/^\/app\/classes\/([^/]+)(\/.*)?$/);
  const routeRoomId = roomPathMatch?.[1] || null;
  const isInsideClassWorkspace = Boolean(roomPathMatch);
  const resolvedRoomId = routeRoomId || activeRoomId || null;
  const roomUserIdCandidates = useMemo(() => {
    const rawCandidates = [authenticatedUserId, user?.id];
    const seen = new Set();

    return rawCandidates
      .map((candidate) => String(candidate || "").trim())
      .filter((candidate) => {
        if (!candidate || seen.has(candidate)) {
          return false;
        }

        seen.add(candidate);
        return true;
      });
  }, [authenticatedUserId, user?.id]);
  const effectiveUserId = roomUserIdCandidates[0] || null;

  const accountToWatch = useMemo(
    () =>
      resolveUserRoomAccount({
        roomId: resolvedRoomId,
        userId: effectiveUserId,
        userIds: roomUserIdCandidates,
        roomAccounts,
        roomMembers,
      }),
    [resolvedRoomId, effectiveUserId, roomUserIdCandidates, roomAccounts, roomMembers]
  );
  const studentSingleAccountFallback = useMemo(() => {
    if (!resolvedRoomId || user?.role !== "student" || accountToWatch) {
      return null;
    }

    const activeAccountsInRoom = (roomAccounts || []).filter((account) => {
      if (account?.roomId !== resolvedRoomId) {
        return false;
      }
      return String(account?.state || "active").toLowerCase() === "active";
    });

    if (activeAccountsInRoom.length === 1) {
      return activeAccountsInRoom[0];
    }

    const activeMembersInRoom = (roomMembers || []).filter((member) => {
      if (member?.roomId !== resolvedRoomId) {
        return false;
      }
      return String(member?.state || "active").toLowerCase() === "active";
    });

    if (activeMembersInRoom.length !== 1) {
      return null;
    }

    const onlyMember = activeMembersInRoom[0];
    const availableBalance = Number(onlyMember?.individualAvailableBalance ?? 0);
    const blockedBalance = Number(onlyMember?.individualBlockedBalance ?? 0);
    const totalBalance = Number(
      onlyMember?.individualTotalBalance ??
        availableBalance + blockedBalance
    );

    return {
      id: onlyMember?.id ? `rm:${onlyMember.id}` : `rm:${resolvedRoomId}:single`,
      roomId: resolvedRoomId,
      userId: onlyMember?.userId || effectiveUserId || null,
      availableBalance: Number.isFinite(availableBalance) ? availableBalance : 0,
      blockedBalance: Number.isFinite(blockedBalance) ? blockedBalance : 0,
      totalBalance: Number.isFinite(totalBalance) ? totalBalance : 0,
      currency: onlyMember?.individualCurrency || activeRoom?.defaultCurrency || "USD",
      state: "active",
      ownerType: "user",
      ownerGroupId: null,
      isShared: false,
      createdAt: onlyMember?.joinedAt || null,
      updatedAt: null,
    };
  }, [
    accountToWatch,
    activeRoom?.defaultCurrency,
    effectiveUserId,
    resolvedRoomId,
    roomAccounts,
    roomMembers,
    user?.role,
  ]);
  const resolvedAccountToWatch = accountToWatch || studentSingleAccountFallback;

  const [liveRoomAccount, setLiveRoomAccount] = useState(null);

  useEffect(() => {
    if (!effectiveUserId || !resolvedRoomId) {
      setLiveRoomAccount(null);
      return undefined;
    }

    let isClosed = false;
    setLiveRoomAccount(resolvedAccountToWatch || null);

    const refreshResolvedAccount = async () => {
      try {
        const resolvedAccount = await fetchResolvedUserRoomAccount({
          roomId: resolvedRoomId,
          userId: effectiveUserId,
          userIds: roomUserIdCandidates,
        });

        if (!isClosed) {
          setLiveRoomAccount(resolvedAccount || resolvedAccountToWatch || null);
        }
      } catch (error) {
        console.warn("Header refreshResolvedAccount warning", error);
      }
    };

    void refreshResolvedAccount();

    const unsubscribe =
      resolvedAccountToWatch?.id
        ? subscribeToRoomAccount({
            account: resolvedAccountToWatch,
            onChange: (updatedAccount) => {
              setLiveRoomAccount(updatedAccount);
            },
          })
        : () => {};

    const pollingIntervalId =
      typeof window !== "undefined"
        ? window.setInterval(() => {
            void refreshResolvedAccount();
          }, 5000)
        : null;

    return () => {
      isClosed = true;
      if (pollingIntervalId != null) {
        window.clearInterval(pollingIntervalId);
      }
      unsubscribe?.();
    };
  }, [
    effectiveUserId,
    resolvedRoomId,
    resolvedAccountToWatch?.id,
    resolvedAccountToWatch,
    roomUserIdCandidates,
  ]);

  const shouldShowContextBalance = Boolean(user) && isInsideClassWorkspace && Boolean(resolvedRoomId);
  const canUseContextRoomBalanceFallback =
    !liveRoomAccount &&
    !resolvedAccountToWatch &&
    Boolean(activeRoomId) &&
    Boolean(resolvedRoomId) &&
    activeRoomId === resolvedRoomId;
  const resolvedBalance =
    liveRoomAccount?.availableBalance ??
    resolvedAccountToWatch?.availableBalance ??
    (canUseContextRoomBalanceFallback ? balance ?? 0 : 0);
  const resolvedCurrency =
    liveRoomAccount?.currency ||
    resolvedAccountToWatch?.currency ||
    activeRoom?.defaultCurrency ||
    preferencesState?.preferredCurrency ||
    "USD";

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
              <span className="font-medium">
                {formatCurrency(resolvedBalance, resolvedCurrency)}
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
