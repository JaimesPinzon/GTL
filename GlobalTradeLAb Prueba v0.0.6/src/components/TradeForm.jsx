import React, { useState, useEffect } from 'react';
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

const TradeForm = () => {
  const { selectedSymbol, openPosition, user, balance, getCurrentPrice, initialSymbols } = useTradingWorkspace();
  const { toast } = useToast();

  const currentSymbolInfo = initialSymbols.find(s => s.id === selectedSymbol);
  const currentPrice = getCurrentPrice(selectedSymbol);
  const assetCurrency = currentSymbolInfo ? currentSymbolInfo.currency : 'USD';
  const userCurrency = 'USD';

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
    userCurrency
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
      userBalance={balance ?? user?.balance ?? 0}
      isStock={currentSymbolInfo?.type === 'stock'}
    />
  );
};

export default TradeForm;
