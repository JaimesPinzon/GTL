import React, { useEffect, useMemo, useState } from "react";
import { Crown, Download, Medal, RefreshCcw, Search, Trophy, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchPortfolioRanking } from "@/lib/room-trades";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/market-data";

const metricOptions = ["return_pct", "total_pnl", "portfolio_value"];
const periodOptions = ["today", "7d", "30d", "class"];

const signedCurrency = (value, currency) => `${Number(value) > 0 ? "+" : ""}${formatCurrency(Number(value || 0), currency)}`;
const signedPercentage = (value) => `${Number(value) > 0 ? "+" : ""}${formatPercentage(Number(value || 0))}`;
const toneClass = (value) => Number(value) >= 0 ? "text-emerald-400" : "text-rose-400";

const initialsFor = (name) => String(name || "?")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("") || "?";

const metricValue = (row, metric, currency) => {
  if (metric === "return_pct") return signedPercentage(row.metricValue);
  return signedCurrency(row.metricValue, currency);
};

const relativeActivity = (date, language, t) => {
  if (!date) return t("portfolioCenter.ranking.noActivity");
  const differenceMs = new Date(date).getTime() - Date.now();
  if (!Number.isFinite(differenceMs)) return t("portfolioCenter.ranking.noActivity");
  const absoluteMs = Math.abs(differenceMs);
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (absoluteMs < 60_000) return t("portfolioCenter.ranking.justNow");
  if (absoluteMs < 3_600_000) return formatter.format(Math.round(differenceMs / 60_000), "minute");
  if (absoluteMs < 86_400_000) return formatter.format(Math.round(differenceMs / 3_600_000), "hour");
  if (absoluteMs < 604_800_000) return formatter.format(Math.round(differenceMs / 86_400_000), "day");
  return formatDate(date);
};

const podiumStyle = {
  1: {
    order: "lg:order-2",
    lift: "lg:-translate-y-8",
    border: "border-amber-300/40",
    glow: "shadow-[0_30px_80px_rgba(245,158,11,.16)]",
    base: "from-amber-300/25 via-yellow-500/15 to-amber-700/10",
    accent: "text-amber-300",
    icon: Crown,
  },
  2: {
    order: "lg:order-1",
    lift: "",
    border: "border-slate-300/25",
    glow: "shadow-[0_25px_70px_rgba(148,163,184,.10)]",
    base: "from-slate-200/20 via-slate-400/10 to-slate-700/10",
    accent: "text-slate-300",
    icon: Medal,
  },
  3: {
    order: "lg:order-3",
    lift: "",
    border: "border-orange-500/25",
    glow: "shadow-[0_25px_70px_rgba(194,65,12,.10)]",
    base: "from-orange-400/20 via-amber-700/10 to-orange-950/10",
    accent: "text-orange-400",
    icon: Medal,
  },
};

const PodiumCard = ({ row, metric, currency, t }) => {
  const style = podiumStyle[row.rank] || podiumStyle[3];
  const Icon = style.icon;
  return (
    <article className={`${style.order} ${style.lift} ${style.border} ${style.glow} overflow-hidden rounded-3xl border bg-slate-950/65 transition-transform`}>
      <div className="p-5 text-center md:p-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-lg font-bold text-white">
          {row.avatarUrl ? <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsFor(row.displayName)}
        </div>
        <div className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${style.accent}`}>
          <Icon className="h-4 w-4" /> {t("portfolioCenter.ranking.position", { rank: row.rank })}
        </div>
        <h4 className="mt-2 truncate text-lg font-semibold text-white">{row.displayName}</h4>
        {row.groupName ? <p className="mt-1 truncate text-xs text-slate-500">{row.groupName}</p> : null}
        <p className={`mt-5 text-3xl font-bold tracking-tight ${metric === "portfolio_value" ? "text-white" : toneClass(row.metricValue)}`}>
          {metricValue(row, metric, currency)}
        </p>
      </div>
      <div className={`grid grid-cols-3 gap-px border-t border-white/[0.08] bg-gradient-to-br ${style.base}`}>
        <div className="p-3 text-center"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("portfolioCenter.ranking.value")}</p><p className="mt-1 truncate text-xs font-semibold text-slate-200">{formatCurrency(row.portfolioValue, currency)}</p></div>
        <div className="border-x border-white/[0.07] p-3 text-center"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("portfolioCenter.ranking.pnl")}</p><p className={`mt-1 truncate text-xs font-semibold ${toneClass(row.totalPnl)}`}>{signedCurrency(row.totalPnl, currency)}</p></div>
        <div className="p-3 text-center"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t("portfolioCenter.ranking.operationsShort")}</p><p className="mt-1 text-xs font-semibold text-slate-200">{row.operationsCount}</p></div>
      </div>
    </article>
  );
};

const RankingSkeleton = () => (
  <div className="space-y-6" aria-hidden="true">
    <div className="grid animate-pulse gap-4 lg:grid-cols-3 lg:items-end">
      {[0, 1, 2].map((item) => <div key={item} className={`h-72 rounded-3xl bg-white/[0.04] ${item === 1 ? "lg:h-80" : ""}`} />)}
    </div>
    <div className="h-72 animate-pulse rounded-3xl bg-white/[0.04]" />
  </div>
);

const PortfolioRanking = ({ roomId }) => {
  const { t, i18n } = useTranslation();
  const [metric, setMetric] = useState("return_pct");
  const [period, setPeriod] = useState("class");
  const [groupId, setGroupId] = useState("all");
  const [query, setQuery] = useState("");
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchPortfolioRanking(roomId, { metric, period, groupId })
      .then((payload) => {
        if (active) setRanking(payload);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || t("portfolioCenter.ranking.errorDescription"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [groupId, metric, period, refreshKey, roomId, t]);

  const allRows = useMemo(() => [...(ranking?.topThree || []), ...(ranking?.rows || [])], [ranking]);
  const normalizedQuery = query.trim().toLowerCase();
  const tableRows = useMemo(() => {
    const source = normalizedQuery ? allRows : ranking?.rows || [];
    return source.filter((row) => !normalizedQuery
      || row.displayName?.toLowerCase().includes(normalizedQuery)
      || row.email?.toLowerCase().includes(normalizedQuery)
      || row.groupName?.toLowerCase().includes(normalizedQuery));
  }, [allRows, normalizedQuery, ranking?.rows]);
  const currency = ranking?.currency || "USD";

  const exportRanking = () => {
    const header = ["position", "student", "metric", "portfolio_value", "pnl", "operations", "last_activity"];
    const lines = allRows.map((row) => [
      row.rank,
      row.displayName,
      row.metricValue,
      row.portfolioValue,
      row.totalPnl,
      row.operationsCount,
      row.lastActivityAt || "",
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `portfolio-ranking-${roomId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card border-white/[0.08]">
        <CardHeader className="gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-400"><Trophy className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">{t("portfolioCenter.ranking.eyebrow")}</span></div>
            <CardTitle className="mt-3 text-2xl">{t("portfolioCenter.ranking.title")}</CardTitle>
            <p className="mt-2 text-sm text-slate-500">{t("portfolioCenter.ranking.description")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-slate-500"><span className="mb-1.5 block">{t("portfolioCenter.ranking.metric")}</span><select value={metric} onChange={(event) => setMetric(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/50">{metricOptions.map((option) => <option key={option} value={option}>{t(`portfolioCenter.ranking.metrics.${option}`)}</option>)}</select></label>
            <label className="text-xs text-slate-500"><span className="mb-1.5 block">{t("portfolioCenter.ranking.period")}</span><select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/50">{periodOptions.map((option) => <option key={option} value={option}>{t(`portfolioCenter.ranking.periods.${option}`)}</option>)}</select></label>
            <label className="text-xs text-slate-500"><span className="mb-1.5 block">{t("portfolioCenter.ranking.group")}</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/50"><option value="all">{t("portfolioCenter.ranking.allGroups")}</option>{(ranking?.groups || []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="text-xs text-slate-500"><span className="mb-1.5 block">{t("portfolioCenter.ranking.search")}</span><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("portfolioCenter.ranking.searchPlaceholder")} className="h-10 border-white/10 bg-[#0b1220] pl-9" /></span></label>
          </div>
        </CardHeader>
      </Card>

      {loading ? <RankingSkeleton /> : null}
      {!loading && error ? (
        <Card className="glass-card border-rose-400/15"><CardContent className="flex min-h-[240px] flex-col items-center justify-center text-center"><Trophy className="h-8 w-8 text-rose-400/70" /><p className="mt-4 font-medium text-white">{t("portfolioCenter.ranking.errorTitle")}</p><p className="mt-2 max-w-md text-sm text-slate-500">{error}</p><Button variant="outline" className="mt-5" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCcw className="mr-2 h-4 w-4" />{t("common.actions.retry")}</Button></CardContent></Card>
      ) : null}
      {!loading && !error && allRows.length === 0 ? (
        <Card className="glass-card border-white/[0.08]"><CardContent className="flex min-h-[280px] flex-col items-center justify-center text-center"><span className="rounded-2xl bg-white/[0.04] p-4 text-slate-500"><Users className="h-7 w-7" /></span><p className="mt-4 font-medium text-white">{t("portfolioCenter.ranking.emptyTitle")}</p><p className="mt-2 max-w-md text-sm text-slate-500">{t("portfolioCenter.ranking.emptyDescription")}</p></CardContent></Card>
      ) : null}

      {!loading && !error && allRows.length > 0 ? (
        <>
          <section className="grid gap-4 pt-8 lg:grid-cols-3 lg:items-end" aria-label={t("portfolioCenter.ranking.podiumAriaLabel")}>
            {(ranking?.topThree || []).map((row) => <PodiumCard key={row.userId} row={row} metric={metric} currency={currency} t={t} />)}
          </section>

          <Card className="glass-card overflow-hidden border-white/[0.08]">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>{normalizedQuery ? t("portfolioCenter.ranking.searchResults") : t("portfolioCenter.ranking.restTitle")}</CardTitle><p className="mt-1 text-xs text-slate-600">{t("portfolioCenter.ranking.updatedAt", { date: formatDate(ranking.generatedAt) })}</p></div>
              <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCcw className="mr-2 h-4 w-4" />{t("portfolioCenter.ranking.refresh")}</Button>{ranking.isStaff ? <Button variant="outline" size="sm" onClick={exportRanking}><Download className="mr-2 h-4 w-4" />{t("portfolioCenter.ranking.export")}</Button> : null}</div>
            </CardHeader>
            <CardContent className="p-0">
              {tableRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="border-y border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-500"><tr>{["position", "student", "metric", "portfolioValue", "pnl", "operations", "lastActivity"].map((column) => <th key={column} className={`px-5 py-3 font-medium ${["position", "student"].includes(column) ? "text-left" : "text-right"}`}>{t(`portfolioCenter.ranking.columns.${column}`)}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{tableRows.map((row) => <tr key={row.userId} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4"><span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/[0.05] px-2 font-semibold text-slate-300">#{row.rank}</span></td><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-xs font-semibold text-blue-300">{initialsFor(row.displayName)}</span><div><p className="font-medium text-white">{row.displayName}</p><p className="text-xs text-slate-600">{row.groupName || row.email}</p></div></div></td><td className={`px-5 py-4 text-right font-semibold ${metric === "portfolio_value" ? "text-white" : toneClass(row.metricValue)}`}>{metricValue(row, metric, currency)}</td><td className="px-5 py-4 text-right text-slate-300">{formatCurrency(row.portfolioValue, currency)}</td><td className={`px-5 py-4 text-right font-medium ${toneClass(row.totalPnl)}`}>{signedCurrency(row.totalPnl, currency)}</td><td className="px-5 py-4 text-right text-slate-300">{row.operationsCount}</td><td className="px-5 py-4 text-right text-slate-500">{relativeActivity(row.lastActivityAt, i18n.language, t)}</td></tr>)}</tbody></table></div> : <div className="px-6 py-14 text-center text-sm text-slate-500">{t(normalizedQuery ? "portfolioCenter.ranking.noSearchResults" : "portfolioCenter.ranking.noRemainingRows")}</div>}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default PortfolioRanking;
