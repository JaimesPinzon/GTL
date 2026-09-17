import React, { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClassContext } from "@/features/classes/context/ClassContext";
import { fetchRoomBalanceAdjustments } from "@/lib/trading-db";
import { formatCurrency, formatDate } from "@/lib/market-data";

const ClassAuditPage = () => {
  const { t } = useTranslation();
  const { activeClass } = useClassContext() || {};
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    setStatus("loading");

    fetchRoomBalanceAdjustments(activeClass.id)
      .then((rows) => {
        if (!mounted) return;
        setEntries(rows);
        setStatus("loaded");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => { mounted = false; };
  }, [activeClass?.id]);

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1520px] p-4 md:p-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <ClipboardList className="h-4 w-4" /> {t("classes.workspace.administration")}
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{t("classes.workspace.audit")}</h2>
        <p className="mt-2 text-sm text-slate-400">{t("classes.workspace.auditDescription")}</p>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.025]">
          {status === "loading" ? <div className="p-8 text-sm text-slate-400">{t("common.states.loading")}</div> : null}
          {status === "error" ? <div className="p-8 text-sm text-rose-300">{t("classes.workspace.auditError")}</div> : null}
          {status === "loaded" && entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">{t("classes.workspace.auditEmpty")}</div>
          ) : null}
          {status === "loaded" && entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-white/8 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">{t("classes.workspace.auditColumns.date")}</th>
                    <th className="px-5 py-4">{t("classes.workspace.auditColumns.user")}</th>
                    <th className="px-5 py-4">{t("classes.workspace.auditColumns.action")}</th>
                    <th className="px-5 py-4">{t("classes.workspace.auditColumns.previous")}</th>
                    <th className="px-5 py-4">{t("classes.workspace.auditColumns.new")}</th>
                    <th className="px-5 py-4">{t("classes.workspace.auditColumns.reason")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-4 text-slate-400">{formatDate(entry.createdAt)}</td>
                      <td className="px-5 py-4 font-medium text-white">{entry.student?.name || entry.student?.email || t("classes.common.student")}</td>
                      <td className="px-5 py-4 text-slate-300">{entry.adjustmentType}</td>
                      <td className="px-5 py-4 text-slate-400">{formatCurrency(entry.previousBalance, activeClass.defaultCurrency || "USD")}</td>
                      <td className="px-5 py-4 text-primary">{formatCurrency(entry.newBalance, activeClass.defaultCurrency || "USD")}</td>
                      <td className="px-5 py-4 text-slate-400">{entry.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClassAuditPage;
