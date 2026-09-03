import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLastCandleMarketFromBackend } from "@/lib/backend-market";
import { formatCurrency, formatPercentage } from "@/lib/market-data";
import { supabase } from "@/lib/supabase";
import {
  mapSnapshotRowsToSymbols,
  SNAPSHOT_REFRESH_INTERVAL_MS,
} from "@/lib/market-snapshot";
import { resolvePreferredHomePage } from "@/lib/routes";
import { useTradingContext } from "@/contexts/TradingContext";
import { getMarketItems, getMarketTypeLabels } from "./landingData";

export const MarketsSection = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user, preferencesState, setSelectedSymbol } = useTradingContext();
  const [snapshotRows, setSnapshotRows] = useState([]);
  const [page, setPage] = useState(1);
  const marketItems = useMemo(() => getMarketItems(t), [t, i18n.resolvedLanguage]);
  const marketTypeLabels = useMemo(() => getMarketTypeLabels(t), [t, i18n.resolvedLanguage]);
  const marketTableRows = useMemo(() => mapSnapshotRowsToSymbols(snapshotRows, t), [snapshotRows, t]);
  const getMarketStatusLabel = useCallback(
    (status) => {
      if (status === "open") {
        return t("marketSearch.marketStatus.open", { defaultValue: "Abierto" });
      }
      if (status === "closed") {
        return t("marketSearch.marketStatus.closed", { defaultValue: "Cerrado" });
      }

      return t("marketSearch.marketStatus.unknown", { defaultValue: "N/D" });
    },
    [t]
  );
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(marketTableRows.length / pageSize));
  const visibleRows = marketTableRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    let isMounted = true;
    let isRefreshing = false;

    const loadSnapshotRows = async () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      try {
        const rows = await getLastCandleMarketFromBackend({ limit: 500 });
        if (!isMounted) {
          return;
        }
        setSnapshotRows(rows);
      } catch (error) {
        console.error("loadMarketsSectionSnapshot error", error);
        if (isMounted) {
          setSnapshotRows([]);
        }
      } finally {
        isRefreshing = false;
      }
    };

    void loadSnapshotRows();
    const interval = window.setInterval(loadSnapshotRows, SNAPSHOT_REFRESH_INTERVAL_MS);
    const channel = supabase
      .channel("landing-markets-last-candle")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "last_candle_market",
        },
        () => {
          void loadSnapshotRows();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [marketTableRows.length]);

  const handleRowClick = (symbolId) => {
    setSelectedSymbol?.(symbolId);
    navigate(isAuthenticated ? resolvePreferredHomePage(user, preferencesState) : "/login");
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="landing-section-label">{t("landing.markets.label")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            {t("landing.markets.title")}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {marketItems.map((item) => (
            <article key={item.name} className="landing-card rounded-[28px] p-6">
              <Landmark className="h-5 w-5 text-blue-300" />
              <h3 className="mt-5 text-xl font-semibold text-white">{item.name}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="market-table-shell mt-12 rounded-[32px] border border-white/10 p-5 shadow-[0_24px_64px_rgba(2,8,24,0.34)] lg:p-6">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="market-table-kicker text-xs uppercase tracking-[0.24em]">{t("landing.markets.table.title")}</p>
          </div>
          <div className="market-table-badge rounded-full border px-4 py-2 text-sm font-medium">
            {t("landing.markets.table.pageStatus", { page, totalPages })}
          </div>
        </div>

        <div className="market-table mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-white/5">
          <div className="market-table-head grid grid-cols-[1.15fr_0.8fr_0.9fr_0.8fr_0.75fr_0.75fr] gap-3 border-b px-4 py-4 text-xs uppercase tracking-[0.2em]">
            <span>{t("landing.markets.table.columns.asset")}</span>
            <span>{t("landing.markets.table.columns.currency")}</span>
            <span>{t("landing.markets.table.columns.type")}</span>
            <span>{t("landing.markets.table.columns.price")}</span>
            <span>{t("landing.markets.table.columns.change")}</span>
            <span>{t("marketSearch.columns.marketStatus", { defaultValue: "Mercado" })}</span>
          </div>

          <div>
            {visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => handleRowClick(row.id)}
                  className="market-table-row grid w-full grid-cols-[1.15fr_0.8fr_0.9fr_0.8fr_0.75fr_0.75fr] gap-3 border-b border-white/8 px-4 py-4 text-left transition hover:bg-blue-500/10"
                >
                  <span className="market-table-symbol font-semibold">{row.name || row.id}</span>
                  <span className="market-table-cell">{row.currency || "USD"}</span>
                  <span className="market-table-cell">{marketTypeLabels[row.type] || row.type || t("landing.markets.assetFallback")}</span>
                  <span className="market-table-price">{formatCurrency(row.price || 0, row.currency || "USD")}</span>
                  <span
                    className={
                      (row.change || 0) < 0
                        ? "market-table-change market-table-change-negative"
                        : "market-table-change market-table-change-positive"
                    }
                  >
                    {formatPercentage(row.change || 0)}
                  </span>
                  <span className="market-table-cell">{getMarketStatusLabel(row.marketStatus)}</span>
                </button>
              ))
            ) : (
              <div className="px-6 py-10 text-sm text-slate-300">{t("marketSearch.empty")}</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="market-table-footnote text-sm leading-7">{t("landing.markets.table.footnote")}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="market-table-pagination rounded-xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("landing.markets.table.previous")}
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`market-table-pagination rounded-xl px-3 py-2 text-sm transition ${
                  pageNumber === page ? "market-table-pagination-active bg-blue-500 text-white" : ""
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="market-table-pagination rounded-xl border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("landing.markets.table.next")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
