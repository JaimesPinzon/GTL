import React from "react";
import { useTranslation } from "react-i18next";

import PortfolioAnalytics from "@/features/classes/components/PortfolioAnalytics";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";

const StudentPortfolioPage = () => {
  const { t } = useTranslation();
  const {
    activeRoom,
    activeRoomAccount,
    activeRoomAccountStatus,
    balance,
    getCurrentPrice,
    openAssetInClass,
    positions,
    symbols,
    transactions,
    user,
  } = useTradingWorkspace();

  if (!user || activeRoomAccountStatus === "loading") {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
        {t("common.states.loading")}
      </div>
    );
  }

  const currency = activeRoomAccount?.currency || activeRoom?.defaultCurrency || "USD";
  const initialCapital = Number(activeRoom?.defaultBalance ?? user.initialBalance ?? 0);
  const availableBalance = Number(activeRoomAccount?.availableBalance ?? balance ?? 0);

  return (
    <PortfolioAnalytics
      ownerName={user.name}
      availableBalance={availableBalance}
      initialCapital={initialCapital}
      positions={positions || []}
      transactions={transactions || []}
      getCurrentPrice={getCurrentPrice}
      symbols={symbols || []}
      currency={currency}
      onOpenAsset={openAssetInClass}
    />
  );
};

export default StudentPortfolioPage;
