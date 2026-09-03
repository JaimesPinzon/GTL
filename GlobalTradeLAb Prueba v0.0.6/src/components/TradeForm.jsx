import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from "react-router-dom";
import { useTradingWorkspace } from '@/features/classes/hooks/useTradingWorkspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/market-data';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import TradeFormLogic from './TradeForm/TradeFormLogic';
import TradeFormUI from './TradeForm/TradeFormUI';
import {
  fetchResolvedUserRoomAccount,
  resolveUserRoomAccount,
  subscribeToRoomAccount,
} from "@/lib/room-balance";

const TradeForm = () => {
  const {
    selectedSymbol,
    openPosition,
    user,
    authenticatedUserId,
    balance,
    getCurrentPrice,
    initialSymbols,
    activeRoomId,
    activeRoom,
    roomAccounts,
    roomMembers,
  } = useTradingWorkspace();
  const location = useLocation();
  const { toast } = useToast();
  const roomPathMatch = location.pathname.match(/^\/app\/classes\/([^/]+)(\/.*)?$/);
  const routeRoomId = roomPathMatch?.[1] || null;
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
        console.warn("TradeForm refreshResolvedAccount warning", error);
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

  const currentRoomAccount = liveRoomAccount || resolvedAccountToWatch;
  const resolvedRoomBalance =
    resolvedRoomId && user
      ? currentRoomAccount?.availableBalance ?? resolvedAccountToWatch?.availableBalance ?? balance ?? 0
      : balance ?? 0;
  const normalizedRoomBalance = Number.isFinite(Number(resolvedRoomBalance))
    ? Number(resolvedRoomBalance)
    : 0;

  const currentSymbolInfo = initialSymbols.find(s => s.id === selectedSymbol);
  const currentPrice = getCurrentPrice(selectedSymbol);
  const assetCurrency = currentSymbolInfo ? currentSymbolInfo.currency : 'USD';
  const userCurrency = currentRoomAccount?.currency || activeRoom?.defaultCurrency || 'USD';

  const {
    tradeMode, setTradeMode,
    amount, setAmount,
    quantity, setQuantity,
    tradeType, setTradeType,
    justification, setJustification,
    attachmentName,
    handleFileChange,
    handleSubmit,
    totalCostUSD,
  } = TradeFormLogic({
    selectedSymbol,
    openPosition,
    user,
    getCurrentPrice,
    initialSymbols,
    toast,
    assetCurrency,
    userCurrency,
    availableBalance: normalizedRoomBalance,
  });

  // Corregido: solo depende de selectedSymbol
  useEffect(() => {
    setAmount('');
    setQuantity('');
    setJustification('');
    handleFileChange({ target: { files: [] }}); 
    setTradeMode('amount');
  }, [selectedSymbol]);

  return (
    <TradeFormUI
      selectedSymbol={selectedSymbol}
      currentPrice={currentPrice}
      assetCurrency={assetCurrency}
      userCurrency={userCurrency}
      tradeMode={tradeMode}
      setTradeMode={setTradeMode}
      amount={amount}
      setAmount={setAmount}
      quantity={quantity}
      setQuantity={setQuantity}
      tradeType={tradeType}
      setTradeType={setTradeType}
      justification={justification}
      setJustification={setJustification}
      attachmentName={attachmentName}
      handleFileChange={handleFileChange}
      handleSubmit={handleSubmit}
      totalCostUSD={totalCostUSD}
      userBalance={normalizedRoomBalance}
      isStock={currentSymbolInfo?.type === 'stock'}
    />
  );
};

export default TradeForm;
