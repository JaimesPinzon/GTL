import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/market-data";
import { submitRoomTrade } from "@/lib/room-trades";

export const usePortfolioManager = ({ currentUser, onTradeCommitted, toast, activeRoom, currentBalance }) => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const retryRef = useRef(null);
  const [isSubmittingTrade, setSubmittingTrade] = useState(false);
  const createRequestId = () => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
  };
  const failure = (title, description) => {
    toast({ title: t(title), description: t(description), variant: "destructive" });
    return false;
  };
  const submit = async (order) => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setSubmittingTrade(true);
    try {
      const scopedOrder = { ...order, roomId: activeRoom.id };
      const fingerprint = JSON.stringify({ userId: currentUser.id, ...scopedOrder });
      // Preserve the key on a timeout/server failure. Retrying is not another purchase.
      if (retryRef.current?.fingerprint !== fingerprint) {
        retryRef.current = { fingerprint, requestId: createRequestId() };
      }
      const result = await submitRoomTrade({ ...scopedOrder, requestId: retryRef.current.requestId });
      onTradeCommitted?.(result);
      retryRef.current = null;
      return result;
    } catch (error) {
      if (error?.status >= 400 && error?.status < 500) retryRef.current = null;
      console.error("room trade persistence error", { status: error?.status, message: error?.message });
      toast({
        title: t("trading.toasts.operationFailedTitle"),
        description: error?.message || t("trading.toasts.operationFailedDescription"),
        variant: "destructive",
      });
      return null;
    } finally {
      pendingRef.current = false;
      setSubmittingTrade(false);
    }
  };
  const canOperate = () => {
    if (!currentUser) return failure("trading.toasts.userNotFoundTitle", "trading.toasts.userNotFoundDescription");
    if (!activeRoom?.id) return failure("trading.toasts.roomRequiredTitle", "trading.toasts.roomRequiredDescription");
    return !pendingRef.current;
  };
  const openPosition = async (symbol, type, amountUSD, entryPrice, justification, attachmentName) => {
    if (!canOperate()) return false;
    if (!Number.isFinite(amountUSD) || amountUSD <= 0 || Math.round(amountUSD * 100) < 1) {
      return failure("trading.toasts.invalidAmountTitle", "trading.toasts.invalidAmountDescription");
    }
    if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !["BUY", "SELL"].includes(type)) {
      return failure("trading.toasts.invalidPriceTitle", "trading.toasts.invalidPriceDescription");
    }
    if (!justification?.trim()) return failure("trading.form.missingJustificationTitle", "trading.form.missingJustificationDescription");
    if (currentBalance == null || !Number.isFinite(currentBalance) || currentBalance < amountUSD) {
      return failure("trading.toasts.insufficientBalanceTitle", currentUser.role === "teacher"
        ? "trading.toasts.insufficientBalanceTeacher" : "trading.toasts.insufficientBalanceStudent");
    }
    const result = await submit({ action: "open", symbol, type, amount: amountUSD, price: entryPrice, justification, attachmentName: attachmentName || null });
    if (!result) return false;
    toast({
      title: t("trading.toasts.positionOpenedTitle"),
      description: t("trading.toasts.positionOpenedDescription", {
        side: t(type === "BUY" ? "trading.sides.buy" : "trading.sides.sell"), symbol, amount: formatCurrency(amountUSD, "USD"),
      }),
      variant: "default",
    });
    return true;
  };
  const closePosition = async (positionId, closePrice) => {
    if (!canOperate()) return false;
    const position = currentUser.positions?.find((item) => item.id === positionId);
    if (!position) return failure("trading.toasts.positionNotFoundTitle", "trading.toasts.positionNotFoundDescription");
    if (!Number.isFinite(closePrice) || closePrice <= 0) return failure("trading.toasts.invalidClosePriceTitle", "trading.toasts.invalidClosePriceDescription");
    const result = await submit({ action: "close", positionId, price: closePrice });
    if (!result) return false;
    toast({
      title: t("trading.toasts.positionClosedTitle"),
      description: t("trading.toasts.positionClosedDescription", { symbol: position.symbol, profitOrLoss: formatCurrency(result.profitOrLoss, "USD") }),
      variant: result.profitOrLoss >= 0 ? "default" : "destructive",
    });
    return true;
  };
  return { openPosition, closePosition, isSubmittingTrade };
};
