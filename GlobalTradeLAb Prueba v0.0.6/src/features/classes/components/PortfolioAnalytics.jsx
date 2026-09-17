import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  Landmark,
  Search,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/market-data";
import { getPortfolioAnalytics } from "@/features/classes/lib/portfolio-analytics";
import PortfolioRanking from "@/features/classes/components/PortfolioRanking";

const tabs = ["summary", "positions", "operations", "performance", "risk", "ranking"];
const allocationColors = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#f43f5e"];

const toneClass = (value) => (value >= 0 ? "text-emerald-400" : "text-rose-400");
const signedCurrency = (value, currency) => `${value > 0 ? "+" : ""}${formatCurrency(value, currency)}`;
const signedPercentage = (value) => `${value > 0 ? "+" : ""}${formatPercentage(value)}`;

const MetricCard = ({ icon: Icon, label, value, detail, tone = "neutral" }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_18px_50px_rgba(2,6,23,0.16)]">
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <span className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2 text-slate-400">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className={`mt-3 text-xl font-semibold ${tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-rose-400" : "text-slate-100"}`}>
      {value}
    </p>
    {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
  </div>
);

const EmptyState = ({ icon: Icon = Briefcase, title, description }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center">
    <span className="rounded-2xl bg-white/[0.04] p-3 text-slate-500"><Icon className="h-6 w-6" /></span>
    <p className="mt-4 font-medium text-slate-200">{title}</p>
    <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
  </div>
);

const EvolutionChart = ({ values, initialCapital, currency, label }) => {
  const width = 720;
  const height = 250;
  const padding = 24;
  const series = values.length ? values : [{ value: initialCapital }, { value: initialCapital }];
  const allValues = [...series.map((point) => point.value), initialCapital];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(max - min, Math.max(Math.abs(max) * 0.02, 1));
  const yFor = (value) => height - padding - ((value - min) / range) * (height - padding * 2);
  const points = series.map((point, index) => {
    const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
    return `${x},${yFor(point.value)}`;
  }).join(" ");
  const referenceY = yFor(initialCapital);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(series[series.length - 1]?.value || 0, currency)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-px w-6 border-t border-dashed border-slate-500" />
          {formatCurrency(initialCapital, currency)}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] w-full overflow-visible" role="img" aria-label={label}>
        <defs>
          <linearGradient id="portfolio-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.2, 0.5, 0.8].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} stroke="rgba(148,163,184,.12)" />
        ))}
        <line x1={padding} x2={width - padding} y1={referenceY} y2={referenceY} stroke="rgba(148,163,184,.45)" strokeDasharray="7 7" />
        <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill="url(#portfolio-area)" />
        <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((point, index) => {
          const [cx, cy] = points.split(" ")[index].split(",");
          return <circle key={`${point.date}-${index}`} cx={cx} cy={cy} r={index === series.length - 1 ? 6 : 3} fill="#0f172a" stroke="#60a5fa" strokeWidth="3" />;
        })}
      </svg>
    </div>
  );
};

const AllocationChart = ({ rows, currency, t }) => {
  const gradient = rows.length
    ? `conic-gradient(${rows.map((row, index) => {
        const previous = rows.slice(0, index).reduce((total, item) => total + item.percentage, 0);
        return `${allocationColors[index % allocationColors.length]} ${previous}% ${previous + row.percentage}%`;
      }).join(", ")})`
    : "rgba(148,163,184,.1)";

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[170px_minmax(0,1fr)]">
      <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-[#0b1220]">
          <span className="text-2xl font-semibold text-white">{rows.length}</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t("portfolioCenter.allocation.groups")}</span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.type} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: allocationColors[index % allocationColors.length] }} />
              <span className="truncate text-slate-300">{t(`portfolioCenter.assetTypes.${row.type}`, row.type)}</span>
            </div>
            <div className="text-right">
              <p className="font-medium text-slate-200">{formatPercentage(row.percentage)}</p>
              <p className="text-xs text-slate-600">{formatCurrency(row.value, currency)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PortfolioAnalytics = ({
  ownerName,
  availableBalance = 0,
  initialCapital = 0,
  positions = [],
  transactions = [],
  getCurrentPrice,
  symbols = [],
  currency = "USD",
  onOpenAsset,
  compactHeader = false,
  roomId,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("summary");
  const [positionFilter, setPositionFilter] = useState("all");
  const [positionQuery, setPositionQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [chartRange, setChartRange] = useState("all");

  const analytics = useMemo(
    () => getPortfolioAnalytics({ availableBalance, initialCapital, positions, transactions, getCurrentPrice, symbols }),
    [availableBalance, getCurrentPrice, initialCapital, positions, symbols, transactions]
  );

  const visiblePositions = useMemo(() => {
    const query = positionQuery.trim().toLowerCase();
    return analytics.positionRows.filter((position) => {
      const matchesQuery = !query || position.symbol.toLowerCase().includes(query) || position.assetName.toLowerCase().includes(query);
      const matchesState = positionFilter === "all" || (positionFilter === "profit" && position.unrealizedPnl >= 0) || (positionFilter === "loss" && position.unrealizedPnl < 0);
      return matchesQuery && matchesState;
    });
  }, [analytics.positionRows, positionFilter, positionQuery]);

  const newestTransactions = [...transactions].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const topPositions = [...analytics.positionRows].sort((first, second) => second.marketValue - first.marketValue).slice(0, 4);
  const concentratedPositions = [...analytics.positionRows].sort((first, second) => second.weight - first.weight);
  const chartValues = useMemo(() => {
    const days = { today: 1, week: 7, month: 30 }[chartRange];
    if (!days) return analytics.evolution;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = analytics.evolution.filter((point) => new Date(point.date || 0).getTime() >= cutoff);
    return filtered.length > 1 ? filtered : analytics.evolution.slice(-2);
  }, [analytics.evolution, chartRange]);
  const returnTone = analytics.tradingPnl >= 0 ? "positive" : "negative";
  const lastUpdate = newestTransactions[0]?.date;

  return (
    <div className="space-y-6">
      {!compactHeader ? (
        <div className="overflow-hidden rounded-3xl border border-blue-400/15 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.92),rgba(5,10,22,.96))] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">{t("portfolioCenter.myPortfolio")}</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{ownerName || t("portfolioCenter.myPortfolio")}</h3>
              <p className="mt-5 text-sm text-slate-500">{t("portfolioCenter.currentValue")}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-white md:text-5xl">{formatCurrency(analytics.portfolioValue, currency)}</p>
              <div className={`mt-3 flex flex-wrap items-center gap-3 text-sm font-medium ${toneClass(analytics.tradingPnl)}`}>
                <span>{signedCurrency(analytics.tradingPnl, currency)}</span>
                <span className="rounded-full bg-current/10 px-2.5 py-1">{signedPercentage(analytics.returnPercentage)}</span>
                <span className="font-normal text-slate-500">{t("portfolioCenter.sinceClassStart")}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3 text-sm text-slate-400">
              <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-400" /> {t("portfolioCenter.lastUpdate")}</div>
              <p className="mt-1 pl-6 text-xs text-slate-500">{lastUpdate ? formatDate(lastUpdate) : t("portfolioCenter.noActivity")}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Landmark} label={t("portfolioCenter.metrics.initialCapital")} value={formatCurrency(initialCapital, currency)} detail={t("portfolioCenter.metrics.classBase")} />
        <MetricCard icon={CircleDollarSign} label={t("portfolioCenter.metrics.available")} value={formatCurrency(availableBalance, currency)} detail={t("portfolioCenter.metrics.availableDetail")} />
        <MetricCard icon={Briefcase} label={t("portfolioCenter.metrics.invested")} value={formatCurrency(analytics.investedValue, currency)} detail={t("portfolioCenter.metrics.investedDetail", { count: positions.length })} />
        <MetricCard icon={Target} label={t("portfolioCenter.metrics.realized")} value={signedCurrency(analytics.realizedPnl, currency)} detail={t("portfolioCenter.metrics.realizedDetail")} tone={analytics.realizedPnl >= 0 ? "positive" : "negative"} />
        <MetricCard icon={Activity} label={t("portfolioCenter.metrics.unrealized")} value={signedCurrency(analytics.unrealizedPnl, currency)} detail={t("portfolioCenter.metrics.unrealizedDetail")} tone={returnTone} />
      </div>

      <div className="scrollbar-dashboard overflow-x-auto border-b border-white/[0.08]" role="tablist" aria-label={t("portfolioCenter.tabs.ariaLabel")}>
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`relative px-4 py-3 text-sm font-medium transition ${activeTab === tab ? "text-blue-400" : "text-slate-500 hover:text-slate-200"}`}>
              {t(`portfolioCenter.tabs.${tab}`)}
              {activeTab === tab ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-500" /> : null}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "summary" ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.85fr)]">
            <Card className="glass-card border-white/[0.08]"><CardContent className="p-5 md:p-6"><div className="mb-2 flex justify-end"><div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">{["today", "week", "month", "all"].map((range) => <button key={range} type="button" onClick={() => setChartRange(range)} className={`rounded-lg px-3 py-1.5 text-xs transition ${chartRange === range ? "bg-blue-500/15 text-blue-300" : "text-slate-500 hover:text-slate-300"}`}>{t(`portfolioCenter.ranges.${range}`)}</button>)}</div></div><EvolutionChart values={chartValues} initialCapital={initialCapital} currency={currency} label={t("portfolioCenter.summary.evolution")} /></CardContent></Card>
            <Card className="glass-card border-white/[0.08]"><CardHeader><CardTitle className="text-lg">{t("portfolioCenter.summary.allocation")}</CardTitle></CardHeader><CardContent>{analytics.allocation.length ? <AllocationChart rows={analytics.allocation} currency={currency} t={t} /> : <EmptyState icon={Coins} title={t("portfolioCenter.empty.noAllocationTitle")} description={t("portfolioCenter.empty.noAllocationDescription")} />}</CardContent></Card>
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]">
            <Card className="glass-card border-white/[0.08]">
              <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-lg">{t("portfolioCenter.summary.topPositions")}</CardTitle>{positions.length ? <Button variant="ghost" size="sm" onClick={() => setActiveTab("positions")}>{t("portfolioCenter.viewAll")}<ChevronRight className="ml-1 h-4 w-4" /></Button> : null}</CardHeader>
              <CardContent>
                {analytics.positionRows.length ? <div className="space-y-2">{topPositions.map((position) => <button type="button" key={position.id} onClick={() => setSelectedPosition(position)} className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-white/[0.07] hover:bg-white/[0.03]"><div><p className="font-semibold text-white">{position.symbol}</p><p className="text-xs text-slate-500">{position.assetName}</p></div><div className="text-right"><p className="text-sm font-medium text-slate-200">{formatCurrency(position.marketValue, currency)}</p><p className="text-xs text-slate-500">{formatPercentage(position.weight)}</p></div><p className={`min-w-[74px] text-right text-sm font-medium ${toneClass(position.unrealizedPnl)}`}>{signedPercentage(position.returnPercentage)}</p></button>)}</div> : <EmptyState title={t("portfolioCenter.empty.noPositionsTitle")} description={t("portfolioCenter.empty.noPositionsDescription")} />}
              </CardContent>
            </Card>
            <Card className="glass-card border-white/[0.08]">
              <CardHeader><CardTitle className="text-lg">{t("portfolioCenter.summary.recentActivity")}</CardTitle></CardHeader>
              <CardContent>{newestTransactions.length ? <div className="space-y-4">{newestTransactions.slice(0, 5).map((transaction) => { const isBuy = String(transaction.type).includes("BUY"); const isClose = String(transaction.type).includes("CLOSE"); return <div key={transaction.id} className="flex items-center gap-3"><span className={`rounded-xl p-2 ${isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{transaction.symbol} · {t(isClose ? "portfolioCenter.operations.closed" : "portfolioCenter.operations.opened")}</p><p className="text-xs text-slate-600">{formatDate(transaction.date)}</p></div><p className={`text-sm font-medium ${isClose ? toneClass(transaction.profitOrLoss || 0) : "text-slate-300"}`}>{isClose ? signedCurrency(transaction.profitOrLoss || 0, currency) : formatCurrency(transaction.amount, currency)}</p></div>; })}</div> : <EmptyState icon={Clock3} title={t("portfolioCenter.empty.noOperationsTitle")} description={t("portfolioCenter.empty.noOperationsDescription")} />}</CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "positions" ? (
        <Card className="glass-card border-white/[0.08]">
          <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>{t("portfolioCenter.positions.title")}</CardTitle><p className="mt-1 text-sm text-slate-500">{t("portfolioCenter.positions.description")}</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={positionQuery} onChange={(event) => setPositionQuery(event.target.value)} placeholder={t("portfolioCenter.positions.search")} className="w-full border-white/10 bg-white/[0.03] pl-9 sm:w-56" /></div><div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">{["all", "profit", "loss"].map((filter) => <button key={filter} type="button" onClick={() => setPositionFilter(filter)} className={`rounded-lg px-3 py-2 text-xs transition ${positionFilter === filter ? "bg-blue-500/15 text-blue-300" : "text-slate-500"}`}>{t(`portfolioCenter.positions.filters.${filter}`)}</button>)}</div></div></CardHeader>
          <CardContent className="p-0">{visiblePositions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-y border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-500"><tr>{["asset", "quantity", "averagePrice", "currentPrice", "value", "pnl", "return", "weight"].map((column) => <th key={column} className={`px-5 py-3 font-medium ${column === "asset" ? "text-left" : "text-right"}`}>{t(`portfolioCenter.positions.columns.${column}`)}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{visiblePositions.map((position) => <tr key={position.id} onClick={() => setSelectedPosition(position)} className="cursor-pointer transition hover:bg-white/[0.025]"><td className="px-5 py-4"><p className="font-semibold text-white">{position.symbol}</p><p className="text-xs text-slate-500">{position.assetName} · {position.type}</p></td><td className="px-5 py-4 text-right text-slate-300">{position.quantity.toLocaleString(i18n.language, { maximumFractionDigits: 6 })}</td><td className="px-5 py-4 text-right text-slate-300">{formatCurrency(position.entryPrice, position.currency)}</td><td className="px-5 py-4 text-right text-slate-300">{formatCurrency(position.currentPrice, position.currency)}{!position.hasLivePrice ? <p className="text-[10px] text-amber-400/80">{t("portfolioCenter.positions.lastEntryPrice")}</p> : null}</td><td className="px-5 py-4 text-right font-medium text-slate-100">{formatCurrency(position.marketValue, currency)}</td><td className={`px-5 py-4 text-right font-medium ${toneClass(position.unrealizedPnl)}`}>{signedCurrency(position.unrealizedPnl, currency)}</td><td className={`px-5 py-4 text-right font-medium ${toneClass(position.returnPercentage)}`}>{signedPercentage(position.returnPercentage)}</td><td className="px-5 py-4 text-right text-slate-300">{formatPercentage(position.weight)}</td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title={t("portfolioCenter.empty.noMatchingPositionsTitle")} description={t("portfolioCenter.empty.noMatchingPositionsDescription")} /></div>}</CardContent>
        </Card>
      ) : null}

      {activeTab === "operations" ? (
        <Card className="glass-card border-white/[0.08]"><CardHeader><CardTitle>{t("portfolioCenter.operations.title")}</CardTitle><p className="text-sm text-slate-500">{t("portfolioCenter.operations.description")}</p></CardHeader><CardContent className="p-0">{newestTransactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-y border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-500"><tr>{["date", "asset", "type", "amount", "price", "result"].map((column) => <th key={column} className={`px-5 py-3 font-medium ${["date", "asset", "type"].includes(column) ? "text-left" : "text-right"}`}>{t(`portfolioCenter.operations.columns.${column}`)}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{newestTransactions.map((transaction) => { const isClose = String(transaction.type).includes("CLOSE"); const isBuy = String(transaction.type).includes("BUY"); return <tr key={transaction.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4 text-slate-400">{formatDate(transaction.date)}</td><td className="px-5 py-4 font-semibold text-white">{transaction.symbol}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{t(isBuy ? "portfolioCenter.operations.buy" : "portfolioCenter.operations.sell")} · {t(isClose ? "portfolioCenter.operations.closed" : "portfolioCenter.operations.opened")}</span></td><td className="px-5 py-4 text-right text-slate-300">{formatCurrency(transaction.amount, currency)}</td><td className="px-5 py-4 text-right text-slate-300">{formatCurrency(transaction.price ?? transaction.closePrice ?? 0, currency)}</td><td className={`px-5 py-4 text-right font-medium ${isClose ? toneClass(transaction.profitOrLoss || 0) : "text-slate-600"}`}>{isClose ? signedCurrency(transaction.profitOrLoss || 0, currency) : "—"}</td></tr>; })}</tbody></table></div> : <div className="p-5"><EmptyState icon={Clock3} title={t("portfolioCenter.empty.noOperationsTitle")} description={t("portfolioCenter.empty.noOperationsDescription")} /></div>}</CardContent></Card>
      ) : null}

      {activeTab === "performance" ? (
        <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={BarChart3} label={t("portfolioCenter.performance.totalReturn")} value={signedPercentage(analytics.returnPercentage)} detail={signedCurrency(analytics.tradingPnl, currency)} tone={returnTone} /><MetricCard icon={TrendingUp} label={t("portfolioCenter.performance.winningOperations")} value={analytics.winners} detail={t("portfolioCenter.performance.winRate", { value: formatPercentage(analytics.winRate) })} tone="positive" /><MetricCard icon={TrendingDown} label={t("portfolioCenter.performance.losingOperations")} value={analytics.losers} detail={t("portfolioCenter.performance.averageLoss", { value: formatCurrency(analytics.averageLoss, currency) })} tone={analytics.losers ? "negative" : "neutral"} /><MetricCard icon={Target} label={t("portfolioCenter.performance.averageWin")} value={formatCurrency(analytics.averageWin, currency)} detail={t("portfolioCenter.performance.closedCount", { count: analytics.closedTransactions.length })} tone="positive" /></div><Card className="glass-card border-white/[0.08]"><CardHeader><CardTitle>{t("portfolioCenter.performance.byAsset")}</CardTitle></CardHeader><CardContent>{analytics.performanceByAsset.length ? <div className="space-y-3">{analytics.performanceByAsset.map((asset) => <div key={asset.symbol} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div><p className="font-semibold text-white">{asset.symbol}</p><p className="text-xs text-slate-500">{t("portfolioCenter.performance.operationsCount", { count: asset.operations })}</p></div><p className={`text-sm font-medium ${toneClass(asset.result)}`}>{signedCurrency(asset.result, currency)}</p><p className={`min-w-[76px] text-right text-sm font-medium ${toneClass(asset.returnPercentage)}`}>{signedPercentage(asset.returnPercentage)}</p></div>)}</div> : <EmptyState icon={BarChart3} title={t("portfolioCenter.empty.noPerformanceTitle")} description={t("portfolioCenter.empty.noPerformanceDescription")} />}</CardContent></Card></div>
      ) : null}

      {activeTab === "risk" ? (
        <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={Activity} label={t("portfolioCenter.risk.exposure")} value={formatPercentage(analytics.exposurePercentage)} detail={formatCurrency(analytics.grossExposure, currency)} /><MetricCard icon={CircleDollarSign} label={t("portfolioCenter.risk.cash")} value={formatPercentage(analytics.cashPercentage)} detail={formatCurrency(availableBalance, currency)} /><MetricCard icon={ShieldAlert} label={t("portfolioCenter.risk.largestPosition")} value={analytics.largestPosition?.symbol || "—"} detail={analytics.largestPosition ? formatPercentage(analytics.largestPosition.weight) : t("portfolioCenter.risk.noPosition")} /><MetricCard icon={Coins} label={t("portfolioCenter.risk.assetCount")} value={analytics.positionRows.length} detail={t("portfolioCenter.risk.openAssets")} /><MetricCard icon={TrendingDown} label={t("portfolioCenter.risk.maximumDrawdown")} value={formatPercentage(analytics.maximumDrawdown)} detail={t("portfolioCenter.risk.estimatedFromHistory")} tone={analytics.maximumDrawdown < 0 ? "negative" : "neutral"} /></div><Card className="glass-card border-white/[0.08]"><CardHeader><CardTitle>{t("portfolioCenter.risk.concentration")}</CardTitle><p className="text-sm text-slate-500">{t("portfolioCenter.risk.concentrationDescription")}</p></CardHeader><CardContent>{analytics.positionRows.length ? <div className="space-y-4">{concentratedPositions.map((position) => <div key={position.id}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-200">{position.symbol}</span><span className="text-slate-400">{formatPercentage(position.weight)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className={`h-full rounded-full ${position.weight > 35 ? "bg-rose-500" : position.weight > 20 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${Math.min(position.weight, 100)}%` }} /></div></div>)}</div> : <EmptyState icon={ShieldAlert} title={t("portfolioCenter.empty.noRiskTitle")} description={t("portfolioCenter.empty.noRiskDescription")} />}</CardContent></Card></div>
      ) : null}

      {activeTab === "ranking" && roomId ? <PortfolioRanking roomId={roomId} /> : null}

      <Dialog open={Boolean(selectedPosition)} onOpenChange={(open) => !open && setSelectedPosition(null)}>
        <DialogContent className="glass-card sm:max-w-[520px]">
          {selectedPosition ? <><DialogHeader><DialogTitle className="text-2xl">{selectedPosition.assetName}</DialogTitle><DialogDescription>{selectedPosition.symbol} · {t(`portfolioCenter.assetTypes.${selectedPosition.assetType}`, selectedPosition.assetType)} · {selectedPosition.exchange}</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-3">{[["quantity", selectedPosition.quantity.toLocaleString(i18n.language, { maximumFractionDigits: 6 })], ["averagePrice", formatCurrency(selectedPosition.entryPrice, selectedPosition.currency)], ["currentPrice", formatCurrency(selectedPosition.currentPrice, selectedPosition.currency)], ["value", formatCurrency(selectedPosition.marketValue, currency)], ["pnl", signedCurrency(selectedPosition.unrealizedPnl, currency)], ["weight", formatPercentage(selectedPosition.weight)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-xs uppercase tracking-[0.12em] text-slate-500">{t(`portfolioCenter.positions.columns.${label}`)}</p><p className={`mt-2 font-semibold ${label === "pnl" ? toneClass(selectedPosition.unrealizedPnl) : "text-slate-100"}`}>{value}</p></div>)}</div><DialogFooter>{onOpenAsset ? <Button onClick={() => onOpenAsset(selectedPosition.symbol)}>{t("portfolioCenter.positions.openAsset")}</Button> : null}<Button variant="outline" onClick={() => setSelectedPosition(null)}>{t("common.actions.close")}</Button></DialogFooter></> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioAnalytics;
