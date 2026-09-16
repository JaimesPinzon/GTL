import React, { useEffect, useMemo } from 'react';
import { useLocation } from "react-router-dom";
import { useTradingWorkspace } from '@/features/classes/hooks/useTradingWorkspace';
import { useToast } from "@/components/ui/use-toast";
import TradeFormLogic from './TradeForm/TradeFormLogic';
import TradeFormUI from './TradeForm/TradeFormUI';

const TradeForm = () => {
  const {
    selectedSymbol,
    openPosition,
    user,
    balance,
    getCurrentPrice,
    initialSymbols,
    activeRoomId,
    activeRoom,
    activeRoomAccount,
    activeRoomAccountStatus,
    refreshRoomAccount,
    roomPortfolioStatus,
    refreshActiveRoomData,
    isSubmittingTrade,
  } = useTradingWorkspace();
  const location = useLocation();
  const { toast } = useToast();
  const roomPathMatch = location.pathname.match(/^\/app\/classes\/([^/]+)(\/.*)?$/);
  const routeRoomId = roomPathMatch?.[1] || null;
  const resolvedRoomId = routeRoomId || activeRoomId || null;
  const currentRoomAccount =
    activeRoomAccount?.roomId === resolvedRoomId ? activeRoomAccount : null;
  const resolvedRoomBalance =
    resolvedRoomId && user
      ? currentRoomAccount?.availableBalance ?? null
      : balance ?? 0;
  const normalizedRoomBalance = Number.isFinite(Number(resolvedRoomBalance))
    ? Number(resolvedRoomBalance)
    : null;
  const normalizedTotalBalance = Number.isFinite(Number(currentRoomAccount?.totalBalance))
    ? Number(currentRoomAccount.totalBalance)
    : normalizedRoomBalance ?? 0;

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
    isSubmittingTrade,
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
      userBalance={normalizedRoomBalance ?? 0}
      totalBalance={normalizedTotalBalance}
      balanceStatus={activeRoomAccountStatus || (resolvedRoomId ? "loading" : "ready")}
      onRetryBalance={refreshRoomAccount}
      portfolioStatus={roomPortfolioStatus}
      onRetryPortfolio={refreshActiveRoomData}
      isSubmitting={isSubmittingTrade}
      isStock={currentSymbolInfo?.type === 'stock'}
    />
  );
};

export default TradeForm;
