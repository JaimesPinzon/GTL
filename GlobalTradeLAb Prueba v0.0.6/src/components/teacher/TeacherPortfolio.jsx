import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Eye,
  RefreshCcw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import PortfolioAnalytics from "@/features/classes/components/PortfolioAnalytics";
import { getClassPortfolioAnalytics, getPortfolioAnalytics } from "@/features/classes/lib/portfolio-analytics";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/market-data";
import { fetchRoomBalanceAdjustments } from "@/lib/trading-db";

const metricTone = (value) => (value >= 0 ? "text-emerald-400" : "text-rose-400");
const signedCurrency = (value, currency) => `${value > 0 ? "+" : ""}${formatCurrency(value, currency)}`;
const signedPercentage = (value) => `${value > 0 ? "+" : ""}${formatPercentage(value)}`;

const SummaryMetric = ({ icon: Icon, label, value, detail, tone }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <Icon className="h-4 w-4 text-blue-400" />
    </div>
    <p className={`mt-4 text-2xl font-semibold ${tone || "text-white"}`}>{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>
);

const BalanceAdjustmentDialog = ({ student, isOpen, onClose, onSubmit, isSubmitting }) => {
  const { t } = useTranslation();
  const [adjustmentType, setAdjustmentType] = useState("top_up");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAdjustmentType("top_up");
      setAmount("");
      setReason("");
    }
  }, [isOpen]);

  if (!student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("teacherPortfolio.adjustDialogTitle", { name: student.name })}</DialogTitle>
          <DialogDescription>{t("teacherPortfolio.adjustDialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("teacherPortfolio.adjustTypeLabel")}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["top_up", "discount", "reset", "correction"].map((type) => (
                <button key={type} type="button" onClick={() => setAdjustmentType(type)} className={`rounded-xl border px-3 py-2 text-sm transition ${adjustmentType === type ? "border-blue-400/30 bg-blue-500/10 text-blue-300" : "border-white/10 bg-white/[0.02] text-slate-400"}`}>
                  {t(`classes.adjustment.types.${type === "top_up" ? "topUp" : type}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-slate-500">{adjustmentType === "reset" ? t("classes.adjustment.newBalancePlaceholder") : t("classes.adjustment.amountPlaceholder")}</label>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder={t("teacherPortfolio.adjustAmountPlaceholder")} className="mt-2 border-white/10 bg-white/[0.03]" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("teacherPortfolio.reasonLabel")}</label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder={t("teacherPortfolio.reasonPlaceholder")} className="mt-2 border-white/10 bg-white/[0.03]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("common.actions.cancel")}</Button>
          <Button onClick={() => onSubmit({ adjustmentType, amount, reason })} disabled={isSubmitting}>{isSubmitting ? t("classes.common.saving") : t("classes.adjustment.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TeacherPortfolio = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    activeRoom,
    activeRoomAccount,
    adjustStudentBalance,
    balance,
    getCurrentPrice,
    openAssetInClass,
    positions,
    refreshActiveRoomData,
    studentsInClass,
    symbols,
    transactions,
    user,
  } = useTradingWorkspace();
  const [selectedStudentId, setSelectedStudentId] = useState("class");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("return");
  const [adjustmentStudent, setAdjustmentStudent] = useState(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [balanceAdjustments, setBalanceAdjustments] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadAdjustments = async () => {
      if (!activeRoom?.id) return;
      setIsLoadingAudit(true);
      try {
        const rows = await fetchRoomBalanceAdjustments(activeRoom.id);
        if (mounted) setBalanceAdjustments(rows);
      } catch (error) {
        console.error("loadAdjustments error", error);
        if (mounted) toast({ title: t("teacherPortfolio.loadAuditErrorTitle"), description: t("teacherPortfolio.loadAuditErrorDescription"), variant: "destructive" });
      } finally {
        if (mounted) setIsLoadingAudit(false);
      }
    };
    void loadAdjustments();
    return () => { mounted = false; };
  }, [activeRoom?.id, t, toast]);

  const currency = activeRoom?.defaultCurrency || "USD";
  const initialCapital = Number(activeRoom?.defaultBalance || 0);
  const rows = useMemo(() => studentsInClass.map((student) => {
    const analytics = getPortfolioAnalytics({
      availableBalance: student.balance || 0,
      initialCapital,
      positions: student.positions || [],
      transactions: student.transactions || [],
      getCurrentPrice,
      symbols,
    });
    const lastActivity = [...(student.transactions || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0]?.date || null;
    return { ...student, analytics, lastActivity };
  }), [getCurrentPrice, initialCapital, studentsInClass, symbols]);

  const classAnalytics = useMemo(() => getClassPortfolioAnalytics(rows.map((row) => row.analytics)), [rows]);
  const selectedStudent = rows.find((student) => student.id === selectedStudentId) || null;
  const isViewingOwnPortfolio = selectedStudentId === "me";
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows
      .filter((student) => !normalized || student.name?.toLowerCase().includes(normalized) || student.email?.toLowerCase().includes(normalized))
      .sort((a, b) => {
        if (sortBy === "value") return b.analytics.portfolioValue - a.analytics.portfolioValue;
        if (sortBy === "activity") return new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0);
        if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
        return b.analytics.returnPercentage - a.analytics.returnPercentage;
      });
  }, [query, rows, sortBy]);

  const riskAlerts = rows.filter((row) => row.analytics.concentration > 35 || row.analytics.returnPercentage < -5);
  const maxAbsoluteReturn = Math.max(1, ...rows.map((row) => Math.abs(row.analytics.returnPercentage)));

  const handleOpenAdjustment = (student) => {
    setAdjustmentStudent(student);
    setIsAdjustDialogOpen(true);
  };

  const handleSubmitAdjustment = async ({ adjustmentType, amount, reason }) => {
    const numericAmount = Number(amount);
    if (!adjustmentStudent || !Number.isFinite(numericAmount) || numericAmount < 0) {
      toast({ title: t("classes.toasts.invalidAmountTitle"), description: t("classes.toasts.invalidAmountDescription"), variant: "destructive" });
      return;
    }
    setIsSubmittingAdjustment(true);
    try {
      await adjustStudentBalance({
        studentUserId: adjustmentStudent.id,
        adjustmentType,
        adjustmentAmount: adjustmentType === "discount" ? -numericAmount : numericAmount,
        reason,
      });
      await refreshActiveRoomData();
      setBalanceAdjustments(activeRoom?.id ? await fetchRoomBalanceAdjustments(activeRoom.id) : []);
      setIsAdjustDialogOpen(false);
      toast({ title: t("classes.toasts.balanceUpdatedTitle"), description: t("teacherPortfolio.balanceUpdatedDescription", { name: adjustmentStudent.name }) });
    } catch (error) {
      console.error("handleSubmitAdjustment error", error);
      toast({ title: t("classes.toasts.balanceUpdateErrorTitle"), description: t("classes.toasts.tryAgain"), variant: "destructive" });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  if (!activeRoom?.id) {
    return <Card className="glass-card"><CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center"><Users className="h-8 w-8 text-slate-600" /><p className="mt-4 text-slate-400">{t("teacherPortfolio.selectRoomDescription")}</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label htmlFor="portfolio-selector" className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{t("portfolioCenter.teacher.portfolioSelector")}</label>
          <p className="mt-1 text-sm text-slate-400">{t("portfolioCenter.teacher.selectorDescription")}</p>
        </div>
        <select id="portfolio-selector" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="min-w-[260px] rounded-xl border border-white/10 bg-[#0b1220] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50">
          <option value="class">{t("portfolioCenter.teacher.classView")}</option>
          <option value="me">{t("portfolioCenter.myPortfolio")}</option>
          {rows.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
        </select>
      </div>

      {selectedStudent || isViewingOwnPortfolio ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-3xl border border-blue-400/15 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,.16),transparent_42%),rgba(15,23,42,.65)] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4"><Button variant="outline" size="icon" onClick={() => setSelectedStudentId("class")} aria-label={t("portfolioCenter.teacher.backToClass")}><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">{t(isViewingOwnPortfolio ? "portfolioCenter.myPortfolio" : "portfolioCenter.teacher.individualView")}</p><h3 className="mt-1 text-2xl font-semibold text-white">{isViewingOwnPortfolio ? user?.name : selectedStudent?.name}</h3><p className="text-sm text-slate-500">{isViewingOwnPortfolio ? user?.email : selectedStudent?.email}</p></div></div>
            {!isViewingOwnPortfolio ? <Button variant="outline" onClick={() => handleOpenAdjustment(selectedStudent)}><WalletCards className="mr-2 h-4 w-4" />{t("classes.actions.adjustBalance")}</Button> : null}
          </div>
          <PortfolioAnalytics ownerName={isViewingOwnPortfolio ? user?.name : selectedStudent?.name} availableBalance={isViewingOwnPortfolio ? activeRoomAccount?.availableBalance ?? balance ?? 0 : selectedStudent?.balance || 0} initialCapital={initialCapital} positions={isViewingOwnPortfolio ? positions || [] : selectedStudent?.positions || []} transactions={isViewingOwnPortfolio ? transactions || [] : selectedStudent?.transactions || []} getCurrentPrice={getCurrentPrice} symbols={symbols} currency={isViewingOwnPortfolio ? activeRoomAccount?.currency || currency : selectedStudent?.roomAccount?.currency || currency} onOpenAsset={openAssetInClass} compactHeader={!isViewingOwnPortfolio} roomId={activeRoom?.id} />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryMetric icon={Users} label={t("portfolioCenter.teacher.students")} value={classAnalytics.studentCount} detail={t("portfolioCenter.teacher.activePortfolios")} />
            <SummaryMetric icon={WalletCards} label={t("portfolioCenter.teacher.totalValue")} value={formatCurrency(classAnalytics.totalValue, currency)} detail={t("portfolioCenter.teacher.managedCapital")} />
            <SummaryMetric icon={BarChart3} label={t("portfolioCenter.teacher.averageReturn")} value={signedPercentage(classAnalytics.averageReturn)} detail={signedCurrency(classAnalytics.totalPnl, currency)} tone={metricTone(classAnalytics.averageReturn)} />
            <SummaryMetric icon={TrendingUp} label={t("portfolioCenter.teacher.profitable")} value={`${classAnalytics.profitable}/${classAnalytics.studentCount}`} detail={formatPercentage(classAnalytics.profitablePercentage)} tone="text-emerald-400" />
            <SummaryMetric icon={Activity} label={t("portfolioCenter.teacher.activeAssets")} value={classAnalytics.activeAssets} detail={t("portfolioCenter.teacher.uniqueAssets")} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.7fr)]">
            <Card className="glass-card border-white/[0.08]"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-400" />{t("portfolioCenter.teacher.performanceDistribution")}</CardTitle><p className="text-sm text-slate-500">{t("portfolioCenter.teacher.performanceDistributionDescription")}</p></CardHeader><CardContent>{rows.length ? <div className="space-y-4">{[...rows].sort((a, b) => b.analytics.returnPercentage - a.analytics.returnPercentage).slice(0, 8).map((student) => { const value = student.analytics.returnPercentage; return <button key={student.id} type="button" onClick={() => setSelectedStudentId(student.id)} className="grid w-full grid-cols-[120px_minmax(0,1fr)_70px] items-center gap-3 text-left"><span className="truncate text-sm text-slate-300">{student.name}</span><span className="relative h-2 overflow-hidden rounded-full bg-white/[0.05]"><span className={`absolute top-0 h-full rounded-full ${value >= 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-rose-500"}`} style={{ width: `${Math.max(2, (Math.abs(value) / maxAbsoluteReturn) * 50)}%` }} /></span><span className={`text-right text-sm font-medium ${metricTone(value)}`}>{signedPercentage(value)}</span></button>; })}</div> : <p className="py-12 text-center text-sm text-slate-500">{t("teacher.students.empty")}</p>}</CardContent></Card>
            <Card className="glass-card border-white/[0.08]"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-400" />{t("portfolioCenter.teacher.riskAlerts")}</CardTitle><p className="text-sm text-slate-500">{t("portfolioCenter.teacher.riskAlertsDescription")}</p></CardHeader><CardContent>{riskAlerts.length ? <div className="space-y-3">{riskAlerts.slice(0, 6).map((student) => <button key={student.id} type="button" onClick={() => setSelectedStudentId(student.id)} className="w-full rounded-2xl border border-amber-400/10 bg-amber-400/[0.04] p-3 text-left"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-200">{student.name}</p><span className="text-xs text-amber-300">{student.analytics.concentration > 35 ? t("portfolioCenter.teacher.highConcentration") : t("portfolioCenter.teacher.negativeReturn")}</span></div><p className="mt-1 text-xs text-slate-500">{student.analytics.concentration > 35 ? t("portfolioCenter.teacher.concentrationValue", { value: formatPercentage(student.analytics.concentration) }) : signedPercentage(student.analytics.returnPercentage)}</p></button>)}</div> : <div className="py-10 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-emerald-500/60" /><p className="mt-3 text-sm text-slate-400">{t("portfolioCenter.teacher.noRiskAlerts")}</p></div>}</CardContent></Card>
          </div>

          <Card className="glass-card border-white/[0.08]">
            <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between"><div><CardTitle>{t("portfolioCenter.teacher.studentPortfolios")}</CardTitle><p className="mt-1 text-sm text-slate-500">{t("portfolioCenter.teacher.studentPortfoliosDescription")}</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("portfolioCenter.teacher.searchStudent")} className="w-full border-white/10 bg-white/[0.03] pl-9 sm:w-60" /></div><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2 text-sm text-slate-300"><option value="return">{t("portfolioCenter.teacher.sort.return")}</option><option value="value">{t("portfolioCenter.teacher.sort.value")}</option><option value="activity">{t("portfolioCenter.teacher.sort.activity")}</option><option value="name">{t("portfolioCenter.teacher.sort.name")}</option></select></div></CardHeader>
            <CardContent className="p-0">{visibleRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-y border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-500"><tr>{["student", "value", "return", "pnl", "positions", "activity", "actions"].map((column) => <th key={column} className={`px-5 py-3 font-medium ${column === "student" ? "text-left" : column === "actions" ? "text-center" : "text-right"}`}>{t(`portfolioCenter.teacher.columns.${column}`)}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{visibleRows.map((student) => <tr key={student.id} className="transition hover:bg-white/[0.025]"><td className="px-5 py-4"><p className="font-medium text-white">{student.name}</p><p className="text-xs text-slate-500">{student.email}</p></td><td className="px-5 py-4 text-right font-medium text-slate-200">{formatCurrency(student.analytics.portfolioValue, currency)}</td><td className={`px-5 py-4 text-right font-medium ${metricTone(student.analytics.returnPercentage)}`}>{signedPercentage(student.analytics.returnPercentage)}</td><td className={`px-5 py-4 text-right font-medium ${metricTone(student.analytics.tradingPnl)}`}>{signedCurrency(student.analytics.tradingPnl, currency)}</td><td className="px-5 py-4 text-right text-slate-300">{student.analytics.positionRows.length}</td><td className="px-5 py-4 text-right text-slate-500">{student.lastActivity ? formatDate(student.lastActivity) : t("portfolioCenter.noActivity")}</td><td className="px-5 py-4"><div className="flex justify-center gap-2"><Button variant="outline" size="sm" onClick={() => setSelectedStudentId(student.id)}><Eye className="mr-1.5 h-4 w-4" />{t("classes.actions.viewDetails")}</Button><Button variant="ghost" size="sm" onClick={() => handleOpenAdjustment(student)}><WalletCards className="h-4 w-4" aria-label={t("classes.actions.adjustBalance")} /></Button></div></td></tr>)}</tbody></table></div> : <p className="py-16 text-center text-sm text-slate-500">{t("portfolioCenter.teacher.noStudentsMatch")}</p>}</CardContent>
          </Card>

          <Card className="glass-card border-white/[0.08]"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-blue-400" />{t("teacherPortfolio.auditTitle")}</CardTitle><p className="mt-1 text-sm text-slate-500">{t("portfolioCenter.teacher.auditDescription")}</p></div><Button variant="ghost" size="icon" onClick={async () => { if (!activeRoom?.id) return; setIsLoadingAudit(true); try { setBalanceAdjustments(await fetchRoomBalanceAdjustments(activeRoom.id)); } finally { setIsLoadingAudit(false); } }} aria-label={t("portfolioCenter.teacher.refreshAudit")}><RefreshCcw className={`h-4 w-4 ${isLoadingAudit ? "animate-spin" : ""}`} /></Button></CardHeader><CardContent>{balanceAdjustments.length ? <div className="grid gap-3 lg:grid-cols-2">{balanceAdjustments.slice(0, 6).map((entry) => <div key={entry.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-slate-200">{entry.student?.name || t("classes.common.student")}</p><p className="mt-1 text-xs text-slate-500">{entry.reason || t("teacherPortfolio.noReason")}</p></div><p className={`text-sm font-medium ${metricTone(entry.adjustmentAmount)}`}>{signedCurrency(entry.adjustmentAmount, currency)}</p></div><div className="mt-3 flex justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-600"><span>{formatDate(entry.createdAt)}</span><span>{formatCurrency(entry.previousBalance, currency)} → {formatCurrency(entry.newBalance, currency)}</span></div></div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">{isLoadingAudit ? t("teacherPortfolio.loadingAudit") : t("teacherPortfolio.emptyAudit")}</p>}</CardContent></Card>
        </>
      )}

      <BalanceAdjustmentDialog student={adjustmentStudent} isOpen={isAdjustDialogOpen} onClose={() => setIsAdjustDialogOpen(false)} onSubmit={handleSubmitAdjustment} isSubmitting={isSubmittingAdjustment} />
    </div>
  );
};

export default TeacherPortfolio;
