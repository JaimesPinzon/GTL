import { useTranslation } from "react-i18next";

import { formatCurrency } from "@/lib/market-data";

export const usePortfolioManager = ({ currentUser, updateUser, toast, activeRoom, currentBalance }) => {
  const { t } = useTranslation();
  const isTeacher = currentUser?.role === "teacher";
  const normalizeBalance = (value) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  };
  const isRoomReadOnlyForStudents = (room) => {
    if (!room) {
      return false;
    }

    const normalizedState = String(room.state || "").trim().toLowerCase();
    if (["closed", "archived", "inactive", "deleted"].includes(normalizedState)) {
      return true;
    }

    const closeDateValue = room.operationCloseDate || room.endDate;
    if (!closeDateValue) {
      return false;
    }

    const closeDate = new Date(closeDateValue);
    if (!Number.isFinite(closeDate.getTime())) {
      return false;
    }

    closeDate.setHours(23, 59, 59, 999);
    return Date.now() > closeDate.getTime();
  };

  const openPosition = async (symbol, type, amountUSD, entryPrice, justification, attachmentName, options = {}) => {
    const overrideBalance = normalizeBalance(options?.availableBalance);
    const contextBalance = normalizeBalance(currentBalance);
    const effectiveBalance =
      options?.availableBalance !== undefined && options?.availableBalance !== null
        ? overrideBalance
        : contextBalance;

    if (!currentUser) {
      toast({
        title: t("trading.toasts.userNotFoundTitle"),
        description: t("trading.toasts.userNotFoundDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (!isTeacher && !activeRoom?.id) {
      toast({
        title: t("trading.toasts.roomRequiredTitle"),
        description: t("trading.toasts.roomRequiredDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (!isTeacher && isRoomReadOnlyForStudents(activeRoom)) {
      toast({
        title: t("trading.toasts.roomClosedForOperationsTitle"),
        description: t("trading.toasts.roomClosedForOperationsDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (amountUSD <= 0) {
      toast({
        title: t("trading.toasts.invalidAmountTitle"),
        description: t("trading.toasts.invalidAmountDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (effectiveBalance < amountUSD) {
      toast({
        title: t("trading.toasts.insufficientBalanceTitle"),
        description: t(
          isTeacher
            ? "trading.toasts.insufficientBalanceTeacher"
            : "trading.toasts.insufficientBalanceStudent"
        ),
        variant: "destructive",
      });
      return false;
    }

    if (entryPrice <= 0 && symbol !== "TEST_ZERO_PRICE") {
      toast({
        title: t("trading.toasts.invalidPriceTitle"),
        description: t("trading.toasts.invalidPriceDescription"),
        variant: "destructive",
      });
      return false;
    }

    const newPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      symbol,
      type,
      amount: amountUSD,
      entryPrice,
      openDate: new Date().toISOString(),
      justification,
      attachmentName: attachmentName || null,
    };

    const newTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: `OPEN_${type}`,
      symbol,
      amount: amountUSD,
      price: entryPrice,
      date: new Date().toISOString(),
      justification,
      attachmentName: attachmentName || null,
    };

    await updateUser({
      ...currentUser,
      positions: [...currentUser.positions, newPosition],
      transactions: [...currentUser.transactions, newTransaction],
      balance: effectiveBalance - amountUSD,
    });

    toast({
      title: t("trading.toasts.positionOpenedTitle"),
      description: t("trading.toasts.positionOpenedDescription", {
        side: t(type === "BUY" ? "trading.sides.buy" : "trading.sides.sell"),
        symbol,
        amount: formatCurrency(amountUSD, "USD"),
      }),
      variant: "default",
    });
    return true;
  };

  const closePosition = async (positionId, closePrice) => {
    if (!currentUser) {
      toast({
        title: t("trading.toasts.userNotFoundTitle"),
        description: t("trading.toasts.userNotFoundDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (!isTeacher && !activeRoom?.id) {
      toast({
        title: t("trading.toasts.roomRequiredTitle"),
        description: t("trading.toasts.roomRequiredDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (!isTeacher && isRoomReadOnlyForStudents(activeRoom)) {
      toast({
        title: t("trading.toasts.roomClosedForOperationsTitle"),
        description: t("trading.toasts.roomClosedForOperationsDescription"),
        variant: "destructive",
      });
      return false;
    }

    const positionToClose = currentUser.positions.find((position) => position.id === positionId);
    if (!positionToClose) {
      toast({
        title: t("trading.toasts.positionNotFoundTitle"),
        description: t("trading.toasts.positionNotFoundDescription"),
        variant: "destructive",
      });
      return false;
    }

    if (closePrice <= 0 && positionToClose.symbol !== "TEST_ZERO_PRICE") {
      toast({
        title: t("trading.toasts.invalidClosePriceTitle"),
        description: t("trading.toasts.invalidClosePriceDescription"),
        variant: "destructive",
      });
      return false;
    }

    let profitOrLoss;
    if (positionToClose.type === "BUY") {
      profitOrLoss =
        (closePrice - positionToClose.entryPrice) *
        (positionToClose.amount / (positionToClose.entryPrice || 1));
    } else {
      profitOrLoss =
        (positionToClose.entryPrice - closePrice) *
        (positionToClose.amount / (positionToClose.entryPrice || 1));
    }

    if (positionToClose.entryPrice === 0 && positionToClose.symbol !== "TEST_ZERO_PRICE") {
      profitOrLoss =
        positionToClose.type === "BUY"
          ? positionToClose.amount * (closePrice > 0 ? 1 : -1)
          : positionToClose.amount * (closePrice > 0 ? -1 : 1);
    }

    const newTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: `CLOSE_${positionToClose.type}`,
      symbol: positionToClose.symbol,
      amount: positionToClose.amount,
      entryPrice: positionToClose.entryPrice,
      closePrice,
      profitOrLoss,
      date: new Date().toISOString(),
      justification: positionToClose.justification,
      attachmentName: positionToClose.attachmentName,
    };

    await updateUser({
      ...currentUser,
      positions: currentUser.positions.filter((position) => position.id !== positionId),
      transactions: [...currentUser.transactions, newTransaction],
      balance: currentBalance + positionToClose.amount + profitOrLoss,
    });

    toast({
      title: t("trading.toasts.positionClosedTitle"),
      description: t("trading.toasts.positionClosedDescription", {
        symbol: positionToClose.symbol,
        profitOrLoss: formatCurrency(profitOrLoss, "USD"),
      }),
      variant: profitOrLoss >= 0 ? "default" : "destructive",
    });
    return true;
  };

  return { openPosition, closePosition };
};
