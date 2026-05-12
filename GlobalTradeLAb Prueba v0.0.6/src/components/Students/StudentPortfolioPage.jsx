import React from "react";
import { useTranslation } from "react-i18next";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import TransactionHistory from "@/components/TransactionHistory";
import { formatCurrency } from "@/lib/market-data";
import { motion } from "framer-motion";

const StudentPortfolioPage = () => {
  const { t } = useTranslation();
  const { user, positions, getCurrentPrice } = useTradingWorkspace();

  if (!user) {
    return <p>{t("common.states.loading")}</p>;
  }

  const initialBalance = user.initialBalance || 10000;

  const openPositionsValue = positions.reduce((acc, pos) => {
    const currentPrice = getCurrentPrice(pos.symbol);
    const shares = pos.amount / pos.entryPrice;
    const currentValue = shares * currentPrice;

    if (pos.type === "BUY") {
      return acc + (currentValue - pos.amount);
    }

    return acc + (pos.amount - currentValue);
  }, 0);

  const totalPortfolioValue = user.balance + openPositionsValue + positions.reduce((sum, p) => sum + p.amount, 0);
  const totalProfitOrLoss = totalPortfolioValue - initialBalance;
  const totalProfitOrLossPercentage = initialBalance !== 0 ? (totalProfitOrLoss / initialBalance) * 100 : 0;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="container mx-auto space-y-8 p-4 md:p-6 lg:p-8">
      <motion.div initial="hidden" animate="visible" variants={cardVariants}>
        <motion.h1 variants={itemVariants} className="mb-6 text-3xl font-bold tracking-tight text-foreground">
          {t("studentPortfolio.title")}
        </motion.h1>

        <motion.div variants={cardVariants} className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("studentPortfolio.cards.totalValue.title")}</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPortfolioValue, "USD")}</div>
                <p className="text-xs text-muted-foreground">{t("studentPortfolio.cards.totalValue.description")}</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("studentPortfolio.cards.availableBalance.title")}</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(user.balance, "USD")}</div>
                <p className="text-xs text-muted-foreground">{t("studentPortfolio.cards.availableBalance.description")}</p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("studentPortfolio.cards.pnl.title")}</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalProfitOrLoss >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(totalProfitOrLoss, "USD")}
                </div>
                <p className={`text-xs ${totalProfitOrLoss >= 0 ? "text-success" : "text-destructive"}`}>
                  {t("studentPortfolio.cards.pnl.description", { value: totalProfitOrLossPercentage.toFixed(2) })}
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("studentPortfolio.cards.openPositions.title")}</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{positions.length}</div>
                <p className="text-xs text-muted-foreground">{t("studentPortfolio.cards.openPositions.description")}</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Card className="glass-card w-full">
          <CardHeader>
            <CardTitle>{t("studentPortfolio.history.title")}</CardTitle>
            <CardDescription>{t("studentPortfolio.history.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full">
              <TransactionHistory limit={Infinity} showTitle={false} />
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default StudentPortfolioPage;
