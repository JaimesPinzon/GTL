export const PORTFOLIO_RANKING_METRICS = ["return_pct", "total_pnl", "portfolio_value"] as const;
export const PORTFOLIO_RANKING_PERIODS = ["today", "7d", "30d", "class"] as const;

export type PortfolioRankingMetric = (typeof PORTFOLIO_RANKING_METRICS)[number];
export type PortfolioRankingPeriod = (typeof PORTFOLIO_RANKING_PERIODS)[number];

export type RankingMember = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  availableBalance: number;
  groupId: string | null;
  groupName: string | null;
  groupAvailableBalance: number | null;
  groupMemberCount: number;
};

export type RankingPosition = {
  id: string;
  userId: string;
  groupId: string | null;
  symbol: string;
  type: string;
  amount: number;
  entryPrice: number;
};

export type RankingTransaction = {
  id: string;
  userId: string;
  groupId: string | null;
  date: string;
};

export type PortfolioRankingRow = {
  rank: number;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  metricValue: number;
  portfolioValue: number;
  totalPnl: number;
  returnPct: number;
  operationsCount: number;
  lastActivityAt: string | null;
};

const finiteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function getRankingPeriodStart(period: PortfolioRankingPeriod, now = new Date()) {
  if (period === "class") return null;
  if (period === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const days = period === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

const belongsToPortfolio = (
  row: { userId: string; groupId: string | null },
  member: RankingMember,
) => row.userId === member.userId && !row.groupId
  || Boolean(member.groupId && row.groupId === member.groupId);

const metricFor = (
  metric: PortfolioRankingMetric,
  values: Pick<PortfolioRankingRow, "returnPct" | "totalPnl" | "portfolioValue">,
) => {
  if (metric === "total_pnl") return values.totalPnl;
  if (metric === "portfolio_value") return values.portfolioValue;
  return values.returnPct;
};

export function buildPortfolioRanking({
  members,
  positions,
  transactions,
  pricesBySymbol,
  defaultInitialBalance,
  metric,
  period,
  now = new Date(),
}: {
  members: RankingMember[];
  positions: RankingPosition[];
  transactions: RankingTransaction[];
  pricesBySymbol: Map<string, number>;
  defaultInitialBalance: number;
  metric: PortfolioRankingMetric;
  period: PortfolioRankingPeriod;
  now?: Date;
}) {
  const periodStart = getRankingPeriodStart(period, now);

  const rows = members.flatMap((member) => {
    const portfolioPositions = positions.filter((position) => belongsToPortfolio(position, member));
    const allTransactions = transactions.filter((transaction) => belongsToPortfolio(transaction, member));
    if (portfolioPositions.length === 0 && allTransactions.length === 0) return [];

    const periodTransactions = periodStart
      ? allTransactions.filter((transaction) => new Date(transaction.date).getTime() >= periodStart.getTime())
      : allTransactions;
    const marketValue = portfolioPositions.reduce((total, position) => {
      const entryPrice = finiteNumber(position.entryPrice);
      const amount = finiteNumber(position.amount);
      const currentPrice = finiteNumber(pricesBySymbol.get(position.symbol.toUpperCase()), entryPrice);
      if (entryPrice <= 0 || amount <= 0) return total;
      const direction = position.type === "SELL" ? -1 : 1;
      const unrealizedPnl = amount * ((currentPrice - entryPrice) / entryPrice) * direction;
      return total + amount + unrealizedPnl;
    }, 0);
    const availableBalance = member.groupId
      ? finiteNumber(member.groupAvailableBalance)
      : finiteNumber(member.availableBalance);
    const initialBalance = Math.max(
      0,
      finiteNumber(defaultInitialBalance) * (member.groupId ? Math.max(member.groupMemberCount, 1) : 1),
    );
    const portfolioValue = availableBalance + marketValue;
    const totalPnl = portfolioValue - initialBalance;
    const returnPct = initialBalance > 0 ? totalPnl / initialBalance * 100 : 0;
    const lastActivityAt = periodTransactions
      .map((transaction) => transaction.date)
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;
    const metricValue = metricFor(metric, { portfolioValue, totalPnl, returnPct });

    return [{
      rank: 0,
      userId: member.userId,
      displayName: member.displayName,
      email: member.email,
      avatarUrl: member.avatarUrl,
      groupId: member.groupId,
      groupName: member.groupName,
      metricValue,
      portfolioValue,
      totalPnl,
      returnPct,
      operationsCount: periodTransactions.length,
      lastActivityAt,
    }];
  });

  return rows
    .sort((left, right) => (
      right.metricValue - left.metricValue
      || right.totalPnl - left.totalPnl
      || right.portfolioValue - left.portfolioValue
      || new Date(right.lastActivityAt || 0).getTime() - new Date(left.lastActivityAt || 0).getTime()
      || left.displayName.localeCompare(right.displayName)
    ))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
