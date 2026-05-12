import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Eye,
  FileText,
  Image as ImageIcon,
  Landmark,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { useTranslation } from "react-i18next";

const StudentTransactionDetails = ({ student, isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!student) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{t("teacherPortfolio.transactionsTitle", { name: student.name })}</DialogTitle>
          <DialogDescription>{t("teacherPortfolio.transactionsDescription", { name: student.name })}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
          {student.transactions?.length ? (
            [...student.transactions]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-white/8 bg-background/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">
                        {transaction.type.includes("OPEN") ? t("teacherPortfolio.actions.open") : t("teacherPortfolio.actions.close")} {transaction.symbol} (
                      {transaction.type.includes("BUY") ? t("trading.sides.buy") : t("trading.sides.sell")})
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {t("teacherPortfolio.amountLabel", { value: formatCurrency(transaction.amount, transaction.currency || "USD") })}
                  </p>
                  {transaction.price != null ? (
                    <p className="text-xs text-slate-300">
                      {t("teacherPortfolio.priceLabel", { value: formatCurrency(transaction.price, transaction.currency || "USD") })}
                    </p>
                  ) : null}
                  {transaction.type.includes("CLOSE") ? (
                    <p
                      className={`text-xs font-medium ${
                        (transaction.profitOrLoss || 0) >= 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {t("teacherPortfolio.pnlLabel", { value: formatCurrency(transaction.profitOrLoss || 0, transaction.currency || "USD") })}
                    </p>
                  ) : null}
                  {transaction.justification ? (
                    <div className="mt-2 border-t border-border/50 pt-2">
                      <p className="flex items-center text-xs text-slate-300">
                        <FileText className="mr-1 h-3 w-3 text-primary/70" />
                        {t("common.labels.justification")}:
                      </p>
                      <p className="ml-1 text-xs italic text-muted-foreground">{transaction.justification}</p>
                    </div>
                  ) : null}
                  {transaction.attachmentName ? (
                    <p className="mt-1 flex items-center text-xs text-slate-300">
                      <ImageIcon className="mr-1 h-3 w-3 text-primary/70" />
                      {t("common.labels.attachment")}: {transaction.attachmentName}
                    </p>
                  ) : null}
                </div>
              ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("classes.studentDetail.noTransactions")}</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            {t("common.actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BalanceAdjustmentDialog = ({
  student,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
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

  if (!student) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("teacherPortfolio.adjustDialogTitle", { name: student.name })}</DialogTitle>
          <DialogDescription>{t("teacherPortfolio.adjustDialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("teacherPortfolio.adjustTypeLabel")}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "top_up", label: t("classes.adjustment.types.topUp") },
                { value: "discount", label: t("classes.adjustment.types.discount") },
                { value: "reset", label: t("classes.adjustment.types.reset") },
                { value: "correction", label: t("classes.adjustment.types.correction") },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-2xl border px-3 py-2 text-sm transition ${
                    adjustmentType === option.value
                      ? "border-primary/35 bg-primary/12 text-primary"
                      : "border-white/10 bg-white/[0.03] text-slate-300"
                  }`}
                  onClick={() => setAdjustmentType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {adjustmentType === "reset" ? t("classes.adjustment.newBalancePlaceholder") : t("classes.adjustment.amountPlaceholder")}
            </label>
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t("teacherPortfolio.adjustAmountPlaceholder")}
              className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("teacherPortfolio.reasonLabel")}</label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder={t("teacherPortfolio.reasonPlaceholder")}
              className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                adjustmentType,
                amount,
                reason,
              })
            }
            disabled={isSubmitting}
          >
            {isSubmitting ? t("classes.common.saving") : t("classes.adjustment.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TeacherPortfolio = () => {
  const { t } = useTranslation();
  const {
    activeRoom,
    adjustStudentBalance,
    getCurrentPrice,
    refreshActiveRoomData,
    studentsInClass,
  } = useTradingWorkspace();
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [balanceAdjustments, setBalanceAdjustments] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAdjustments = async () => {
      if (!activeRoom?.id) {
        setBalanceAdjustments([]);
        return;
      }

      setIsLoadingAudit(true);
      try {
        const auditRows = await fetchRoomBalanceAdjustments(activeRoom.id);
        if (isMounted) {
          setBalanceAdjustments(auditRows);
        }
      } catch (error) {
        console.error("loadAdjustments error", error);
        if (isMounted) {
          toast({
            title: t("teacherPortfolio.loadAuditErrorTitle"),
            description: t("teacherPortfolio.loadAuditErrorDescription"),
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingAudit(false);
        }
      }
    };

    loadAdjustments();

    return () => {
      isMounted = false;
    };
  }, [activeRoom?.id, t, toast]);

  const calculatePortfolioValue = (student) => {
    let positionsValue = 0;

    if (student.positions?.length) {
      student.positions.forEach((position) => {
        const currentPrice = getCurrentPrice(position.symbol);
        const entryPrice = position.entryPrice || 0;
        const priceDiff = position.type === "BUY" ? currentPrice - entryPrice : entryPrice - currentPrice;

        let profit = 0;
        if (entryPrice !== 0) {
          profit = position.amount * (priceDiff / entryPrice);
        }
        positionsValue += position.amount + profit;
      });
    }

    return (student.balance || 0) + positionsValue;
  };

  const rows = useMemo(() => {
    return studentsInClass.map((student) => {
      const portfolioValue = calculatePortfolioValue(student);
      const initialBalance = student.roomAccount?.totalBalance || student.initialBalance || 100000;
      const pnl = portfolioValue - initialBalance;
      const pnlPercentage = initialBalance !== 0 ? (pnl / initialBalance) * 100 : 0;

      return {
        ...student,
        portfolioValue,
        pnl,
        pnlPercentage,
      };
    });
  }, [studentsInClass]);

  const handleViewDetails = (student) => {
    setSelectedStudent(student);
    setIsDetailOpen(true);
  };

  const handleOpenAdjustDialog = (student) => {
    setSelectedStudent(student);
    setIsAdjustDialogOpen(true);
  };

  const handleSubmitAdjustment = async ({ adjustmentType, amount, reason }) => {
    if (!selectedStudent) {
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast({
        title: t("classes.toasts.invalidAmountTitle"),
        description: t("classes.toasts.invalidAmountDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingAdjustment(true);

    try {
      await adjustStudentBalance({
        studentUserId: selectedStudent.id,
        adjustmentType,
        adjustmentAmount: adjustmentType === "discount" ? -numericAmount : numericAmount,
        reason,
      });

      await refreshActiveRoomData();
      const auditRows = activeRoom?.id ? await fetchRoomBalanceAdjustments(activeRoom.id) : [];
      setBalanceAdjustments(auditRows);
      setIsAdjustDialogOpen(false);

      toast({
        title: t("classes.toasts.balanceUpdatedTitle"),
        description: t("teacherPortfolio.balanceUpdatedDescription", { name: selectedStudent.name }),
      });
    } catch (error) {
      console.error("handleSubmitAdjustment error", error);
      toast({
        title: t("classes.toasts.balanceUpdateErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  if (!activeRoom?.id) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-6 w-6 text-primary" />
              {t("teacherPortfolio.panelTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t("teacherPortfolio.selectRoomDescription")}</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("teacherPortfolio.studentsTitle", { room: activeRoom.name })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground">
              {t("teacher.students.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("teacherPortfolio.columns.student")}</TableHead>
                    <TableHead className="text-right">{t("teacherPortfolio.columns.availableBalance")}</TableHead>
                    <TableHead className="text-right">{t("teacherPortfolio.columns.portfolioValue")}</TableHead>
                    <TableHead className="text-right">{t("teacherPortfolio.columns.pnl")}</TableHead>
                    <TableHead className="text-center">{t("classes.common.positions")}</TableHead>
                    <TableHead className="text-center">{t("teacherPortfolio.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.email}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(student.balance || 0, "USD")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(student.portfolioValue, "USD")}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          student.pnl >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        <div className="flex items-center justify-end">
                          {student.pnl >= 0 ? (
                            <TrendingUp className="mr-1 h-4 w-4" />
                          ) : (
                            <TrendingDown className="mr-1 h-4 w-4" />
                          )}
                          {formatPercentage(student.pnlPercentage)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{student.positions?.length || 0}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(student)}>
                            <Eye className="mr-1 h-4 w-4" />
                            {t("classes.actions.viewDetails")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenAdjustDialog(student)}>
                            <WalletCards className="mr-1 h-4 w-4" />
                            {t("classes.actions.adjustBalance")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t("teacherPortfolio.auditTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingAudit ? (
            <p className="text-muted-foreground">{t("teacherPortfolio.loadingAudit")}</p>
          ) : balanceAdjustments.length > 0 ? (
            <div className="space-y-3">
              {balanceAdjustments.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/8 bg-background/30 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {entry.student?.name || t("classes.common.student")} - {t(`classes.adjustment.types.${entry.adjustmentType}`, entry.adjustmentType)}
                      </p>
                      <p className="text-sm text-slate-400">
                        {entry.reason || t("teacherPortfolio.noReason")}
                      </p>
                    </div>
                    <div className="text-sm text-slate-400">
                      <p>{formatDate(entry.createdAt)}</p>
                      <p>{entry.teacher?.name || t("auth.register.role.teacher")}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("teacherPortfolio.previousBalance")}</p>
                      <p className="mt-2 font-medium text-slate-200">
                        {formatCurrency(entry.previousBalance, "USD")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("teacherPortfolio.adjustment")}</p>
                      <p className="mt-2 font-medium text-slate-200">
                        {formatCurrency(entry.adjustmentAmount, "USD")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("teacherPortfolio.newBalance")}</p>
                      <p className="mt-2 font-medium text-slate-200">
                        {formatCurrency(entry.newBalance, "USD")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {t("teacherPortfolio.emptyAudit")}
            </p>
          )}
        </CardContent>
      </Card>

      <StudentTransactionDetails
        student={selectedStudent}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
      <BalanceAdjustmentDialog
        student={selectedStudent}
        isOpen={isAdjustDialogOpen}
        onClose={() => setIsAdjustDialogOpen(false)}
        onSubmit={handleSubmitAdjustment}
        isSubmitting={isSubmittingAdjustment}
      />
    </motion.div>
  );
};

export default TeacherPortfolio;
