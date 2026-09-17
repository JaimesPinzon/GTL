const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isClosingTransaction = (transaction) =>
  String(transaction?.type || "").toUpperCase().includes("CLOSE");

export const getPortfolioAnalytics = ({
  availableBalance = 0,
  initialCapital = 0,
  positions = [],
  transactions = [],
  getCurrentPrice = () => 0,
  symbols = [],
}) => {
  const symbolMap = new Map(symbols.map((symbol) => [symbol.id, symbol]));

  const positionRows = positions.map((position) => {
    const entryPrice = safeNumber(position.entryPrice);
    const principal = safeNumber(position.amount);
    const livePrice = safeNumber(getCurrentPrice(position.symbol));
    const currentPrice = livePrice > 0 ? livePrice : entryPrice;
    const direction = position.type === "SELL" ? -1 : 1;
    const returnRate = entryPrice > 0 ? direction * ((currentPrice - entryPrice) / entryPrice) : 0;
    const unrealizedPnl = principal * returnRate;
    const marketValue = Math.max(0, principal + unrealizedPnl);
    const asset = symbolMap.get(position.symbol);

    return {
      ...position,
      assetName: asset?.name || position.symbol,
      assetType: asset?.type || "other",
      exchange: asset?.exchangeLabel || "—",
      currency: position.currency || asset?.currency || "USD",
      currentPrice,
      hasLivePrice: livePrice > 0,
      quantity: entryPrice > 0 ? principal / entryPrice : 0,
      unrealizedPnl,
      marketValue,
      returnPercentage: returnRate * 100,
    };
  });

  const investedValue = positionRows.reduce((total, position) => total + position.marketValue, 0);
  const unrealizedPnl = positionRows.reduce((total, position) => total + position.unrealizedPnl, 0);
  const closedTransactions = transactions.filter(isClosingTransaction);
  const realizedPnl = closedTransactions.reduce(
    (total, transaction) => total + safeNumber(transaction.profitOrLoss),
    0
  );
  const tradingPnl = realizedPnl + unrealizedPnl;
  const portfolioValue = safeNumber(availableBalance) + investedValue;
  const resolvedInitialCapital = Math.max(0, safeNumber(initialCapital));
  const returnPercentage = resolvedInitialCapital > 0 ? (tradingPnl / resolvedInitialCapital) * 100 : 0;
  const grossExposure = positionRows.reduce((total, position) => total + Math.abs(position.marketValue), 0);

  const weightedRows = positionRows.map((position) => ({
    ...position,
    weight: portfolioValue > 0 ? (position.marketValue / portfolioValue) * 100 : 0,
  }));

  const allocation = weightedRows.reduce((groups, position) => {
    const key = position.assetType;
    const current = groups.get(key) || { type: key, value: 0, percentage: 0 };
    current.value += position.marketValue;
    groups.set(key, current);
    return groups;
  }, new Map());

  if (safeNumber(availableBalance) > 0) {
    allocation.set("cash", {
      type: "cash",
      value: safeNumber(availableBalance),
      percentage: 0,
    });
  }

  const allocationRows = [...allocation.values()]
    .map((item) => ({
      ...item,
      percentage: portfolioValue > 0 ? (item.value / portfolioValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );
  let runningValue = resolvedInitialCapital;
  let peakValue = runningValue;
  let maximumDrawdown = 0;
  const evolution = [{
    date: sortedTransactions[0]?.date || new Date().toISOString(),
    value: runningValue,
  }];

  sortedTransactions.forEach((transaction) => {
    if (isClosingTransaction(transaction)) {
      runningValue += safeNumber(transaction.profitOrLoss);
      peakValue = Math.max(peakValue, runningValue);
      if (peakValue > 0) {
        maximumDrawdown = Math.min(maximumDrawdown, ((runningValue - peakValue) / peakValue) * 100);
      }
      evolution.push({ date: transaction.date, value: runningValue });
    }
  });

  if (evolution.length === 1 || Math.abs(evolution[evolution.length - 1].value - portfolioValue) > 0.005) {
    peakValue = Math.max(peakValue, portfolioValue);
    if (peakValue > 0) {
      maximumDrawdown = Math.min(maximumDrawdown, ((portfolioValue - peakValue) / peakValue) * 100);
    }
    evolution.push({ date: new Date().toISOString(), value: portfolioValue });
  }

  const winners = closedTransactions.filter((transaction) => safeNumber(transaction.profitOrLoss) > 0);
  const losers = closedTransactions.filter((transaction) => safeNumber(transaction.profitOrLoss) < 0);
  const averageWin = winners.length
    ? winners.reduce((total, transaction) => total + safeNumber(transaction.profitOrLoss), 0) / winners.length
    : 0;
  const averageLoss = losers.length
    ? losers.reduce((total, transaction) => total + safeNumber(transaction.profitOrLoss), 0) / losers.length
    : 0;

  const performanceByAsset = [...new Set(transactions.map((transaction) => transaction.symbol).filter(Boolean))]
    .map((symbol) => {
      const assetTransactions = transactions.filter((transaction) => transaction.symbol === symbol);
      const result = assetTransactions.reduce(
        (total, transaction) => total + (isClosingTransaction(transaction) ? safeNumber(transaction.profitOrLoss) : 0),
        0
      );
      const capital = assetTransactions.reduce((total, transaction) => total + safeNumber(transaction.amount), 0);
      return {
        symbol,
        operations: assetTransactions.length,
        result,
        returnPercentage: capital > 0 ? (result / capital) * 100 : 0,
      };
    })
    .sort((a, b) => b.result - a.result);

  const largestPosition = [...weightedRows].sort((a, b) => b.weight - a.weight)[0] || null;
  const concentration = largestPosition?.weight || 0;

  return {
    allocation: allocationRows,
    averageLoss,
    averageWin,
    closedTransactions,
    evolution,
    grossExposure,
    investedValue,
    largestPosition,
    losers: losers.length,
    maximumDrawdown,
    performanceByAsset,
    portfolioValue,
    positionRows: weightedRows,
    realizedPnl,
    returnPercentage,
    tradingPnl,
    unrealizedPnl,
    winRate: closedTransactions.length ? (winners.length / closedTransactions.length) * 100 : 0,
    winners: winners.length,
    cashPercentage: portfolioValue > 0 ? (safeNumber(availableBalance) / portfolioValue) * 100 : 0,
    exposurePercentage: portfolioValue > 0 ? (grossExposure / portfolioValue) * 100 : 0,
    concentration,
  };
};

export const getClassPortfolioAnalytics = (portfolios = []) => {
  const active = portfolios.filter(Boolean);
  const profitable = active.filter((portfolio) => portfolio.tradingPnl > 0).length;
  const averageReturn = active.length
    ? active.reduce((total, portfolio) => total + portfolio.returnPercentage, 0) / active.length
    : 0;
  const totalValue = active.reduce((total, portfolio) => total + portfolio.portfolioValue, 0);
  const totalPnl = active.reduce((total, portfolio) => total + portfolio.tradingPnl, 0);
  const activeAssets = new Set(
    active.flatMap((portfolio) => portfolio.positionRows.map((position) => position.symbol))
  ).size;

  return {
    activeAssets,
    averageReturn,
    profitable,
    profitablePercentage: active.length ? (profitable / active.length) * 100 : 0,
    studentCount: active.length,
    totalPnl,
    totalValue,
  };
};
