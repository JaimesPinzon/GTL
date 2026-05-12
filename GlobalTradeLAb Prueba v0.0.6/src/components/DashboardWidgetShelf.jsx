import React, { useEffect, useMemo } from "react";
import {
  BarChart2,
  BarChart3,
  Briefcase,
  Clock3,
  Newspaper,
  RadioTower,
  Sparkles,
} from "lucide-react";

import PositionsList from "@/components/PositionsList";
import TransactionHistory from "@/components/TransactionHistory";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatPercentage } from "@/lib/market-data";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";

const WIDGETS_STORAGE_KEY = "gtl.dashboard.widgets";
const VISITED_SYMBOLS_STORAGE_KEY = "gtl.dashboard.visited-symbols";
const MAX_VISITED_SYMBOLS = 8;

const DEFAULT_WIDGETS = {
  positions: true,
  history: true,
  portfolio: true,
  ranking: true,
  news: true,
  watchlist: true,
};

const WIDGET_ITEMS = [
  { id: "positions", label: "Posiciones abiertas", icon: Briefcase, span: "wide" },
  { id: "history", label: "Historial", icon: Clock3, span: "wide" },
  { id: "portfolio", label: "Resumen portafolio", icon: BarChart3, span: "compact" },
  { id: "ranking", label: "Ranking", icon: BarChart2, span: "compact" },
  { id: "news", label: "Noticias", icon: Newspaper, span: "compact" },
  { id: "watchlist", label: "Pares visitados", icon: RadioTower, span: "compact" },
];

const DashboardCard = ({ title, description, children, className }) => (
  <section className={cn("glass-card min-h-[240px] rounded-lg p-4", className)}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary/80" />
    </div>
    {children}
  </section>
);

const PortfolioSummaryCard = ({ balance, currentPortfolioPnl, currentPortfolioValue, positions, transactions }) => (
  <DashboardCard
    title="Resumen de portafolio"
    description="Balance, valor estimado y rendimiento acumulado del entorno actual."
  >
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Valor total" value={formatCurrency(currentPortfolioValue, "USD")} />
      <MetricTile label="Balance disponible" value={formatCurrency(balance, "USD")} />
      <MetricTile
        label="PnL"
        value={formatCurrency(currentPortfolioPnl, "USD")}
        valueClassName={currentPortfolioPnl >= 0 ? "text-success" : "text-destructive"}
      />
      <MetricTile
        label="Operaciones"
        value={`${positions.length} abiertas / ${transactions.length} registradas`}
        compact
      />
    </div>
  </DashboardCard>
);

const RankingCard = ({ rankingRows, currentUserId }) => (
  <DashboardCard
    title="Ranking"
    description="Comparativo por valor de portafolio dentro de la sala activa."
  >
    {rankingRows.length ? (
      <div className="space-y-3">
        {rankingRows.slice(0, 5).map((row) => (
          <div
            key={row.userId}
            className={cn(
              "flex items-center justify-between rounded-md border border-border/70 px-3 py-3",
              row.userId === currentUserId ? "bg-primary/10" : "bg-background/30"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                #{row.rank} {row.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.operationsCount} operaciones · {formatPercentage(row.pnlPercentage)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{formatCurrency(row.portfolioValue, "USD")}</p>
              <p className={cn("text-xs", row.pnl >= 0 ? "text-success" : "text-destructive")}>
                {row.pnl >= 0 ? "+" : ""}
                {formatCurrency(row.pnl, "USD")}
              </p>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState
        title="Aun no hay ranking disponible"
        description="Se activara cuando existan estudiantes y portafolios en la sala actual."
      />
    )}
  </DashboardCard>
);

const NewsCard = ({ selectedSymbol, recentTransactions }) => (
  <DashboardCard
    title="Noticias"
    description="Panel preparado para feed de mercado y eventos relacionados con el activo observado."
  >
    <div className="space-y-3">
      <div className="rounded-md border border-border/70 bg-background/30 px-3 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Activo monitoreado</p>
        <p className="mt-2 text-lg font-semibold text-foreground">{selectedSymbol}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Este bloque ya puede activarse y desactivarse. Si luego conectamos un backend o API, aqui podemos listar titulares en tiempo real.
        </p>
      </div>

      {recentTransactions.length ? (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Ultima actividad registrada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {recentTransactions[0].symbol} · {formatDate(recentTransactions[0].date)}
          </p>
        </div>
      ) : (
        <EmptyState
          title="Sin actividad reciente"
          description="Cuando se registren operaciones, este bloque puede servir para cruzar noticias con ejecuciones recientes."
        />
      )}
    </div>
  </DashboardCard>
);

const VisitedPairsCard = ({ visitedSymbols, selectedSymbol, setSelectedSymbol, symbolsById }) => (
  <DashboardCard
    title="Pares visitados anteriormente"
    description="Accesos rapidos a los simbolos consultados recientemente desde el chart."
  >
    {visitedSymbols.length ? (
      <div className="flex flex-wrap gap-2">
        {visitedSymbols.map((symbolId) => {
          const symbolInfo = symbolsById.get(symbolId);
          const isActive = symbolId === selectedSymbol;

          return (
            <Button
              key={symbolId}
              type="button"
              variant={isActive ? "default" : "outline"}
              className="h-auto rounded-full px-4 py-2 text-left"
              onClick={() => setSelectedSymbol(symbolId)}
            >
              <span className="block text-sm font-semibold">{symbolId}</span>
              <span className="block text-[11px] opacity-80">{symbolInfo?.exchangeLabel || symbolInfo?.type || "Mercado"}</span>
            </Button>
          );
        })}
      </div>
    ) : (
      <EmptyState
        title="Todavia no hay pares recientes"
        description="Se iran guardando automaticamente a medida que navegues entre activos."
      />
    )}
  </DashboardCard>
);

const MetricTile = ({ label, value, valueClassName, compact = false }) => (
  <div className="rounded-md border border-border/70 bg-background/30 px-3 py-3">
    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className={cn("mt-2 font-semibold text-foreground", compact ? "text-sm" : "text-lg", valueClassName)}>{value}</p>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center">
    <p className="text-sm font-semibold text-foreground">{title}</p>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </div>
);

const DashboardWidgetShelf = ({ selectedSymbol }) => {
  const {
    balance,
    positions,
    transactions,
    getCurrentPrice,
    roomMembers,
    roomAccounts,
    roomPortfolios,
    user,
    activeRoom,
    setSelectedSymbol,
    symbols,
  } = useTradingWorkspace();
  const [widgetState, setWidgetState] = useLocalStorage(WIDGETS_STORAGE_KEY, DEFAULT_WIDGETS);
  const [visitedSymbols, setVisitedSymbols] = useLocalStorage(VISITED_SYMBOLS_STORAGE_KEY, selectedSymbol ? [selectedSymbol] : []);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    setVisitedSymbols((previousSymbols = []) => {
      const nextSymbols = [selectedSymbol, ...previousSymbols.filter((item) => item !== selectedSymbol)];
      return nextSymbols.slice(0, MAX_VISITED_SYMBOLS);
    });
  }, [selectedSymbol, setVisitedSymbols]);

  const normalizedWidgetState = useMemo(
    () => ({ ...DEFAULT_WIDGETS, ...(widgetState || {}) }),
    [widgetState]
  );
  const activeWidgets = useMemo(
    () => WIDGET_ITEMS.filter((widget) => normalizedWidgetState[widget.id]),
    [normalizedWidgetState]
  );
  const symbolsById = useMemo(
    () => new Map((symbols || []).map((symbol) => [symbol.id, symbol])),
    [symbols]
  );

  const calculatePortfolioValue = useMemo(
    () => (balanceValue, openPositions = []) => {
      const positionsValue = openPositions.reduce((sum, position) => {
        const currentPrice = getCurrentPrice(position.symbol);
        const entryPrice = position.entryPrice || 0;
        const priceDiff = position.type === "BUY" ? currentPrice - entryPrice : entryPrice - currentPrice;
        const profit = entryPrice !== 0 ? position.amount * (priceDiff / entryPrice) : 0;
        return sum + position.amount + profit;
      }, 0);

      return (balanceValue || 0) + positionsValue;
    },
    [getCurrentPrice]
  );

  const currentPortfolioValue = calculatePortfolioValue(balance || 0, positions || []);
  const portfolioInitialBalance = user?.initialBalance || activeRoom?.defaultBalance || 100000;
  const currentPortfolioPnl = currentPortfolioValue - portfolioInitialBalance;
  const rankingRows = useMemo(
    () =>
      (roomMembers || [])
        .filter((member) => member.roleInRoom === "student")
        .map((member) => {
          const account = (roomAccounts || []).find((entry) => entry.userId === member.userId);
          const portfolio = roomPortfolios?.[member.userId];
          const initialBalance = account?.totalBalance || activeRoom?.defaultBalance || 100000;
          const portfolioValue = calculatePortfolioValue(account?.availableBalance ?? 0, portfolio?.positions || []);
          const pnl = portfolioValue - initialBalance;
          const pnlPercentage = initialBalance !== 0 ? (pnl / initialBalance) * 100 : 0;

          return {
            userId: member.userId,
            name: member.profile?.name || member.profile?.email || "Estudiante",
            portfolioValue,
            pnl,
            pnlPercentage,
            operationsCount: portfolio?.transactions?.length || 0,
          };
        })
        .sort((left, right) => right.portfolioValue - left.portfolioValue)
        .map((row, index) => ({ ...row, rank: index + 1 })),
    [activeRoom?.defaultBalance, calculatePortfolioValue, roomAccounts, roomMembers, roomPortfolios]
  );
  const recentTransactions = useMemo(
    () => [...(transactions || [])].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 6),
    [transactions]
  );

  const toggleWidget = (widgetId) => {
    setWidgetState((previousState) => ({
      ...DEFAULT_WIDGETS,
      ...(previousState || {}),
      [widgetId]: !((previousState || {})[widgetId] ?? DEFAULT_WIDGETS[widgetId]),
    }));
  };

  if (!activeWidgets.length) {
    return (
      <div className="space-y-4 px-4 md:px-6">
        <WidgetToggleBar normalizedWidgetState={normalizedWidgetState} onToggleWidget={toggleWidget} />
        <div className="glass-card rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">No hay widgets activos</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Usa la barra de abajo del chart para volver a mostrar posiciones, historial, ranking, noticias o watchlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-6">
      <WidgetToggleBar normalizedWidgetState={normalizedWidgetState} onToggleWidget={toggleWidget} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {activeWidgets.map((widget) => {
          if (widget.id === "positions") {
            return (
              <div key={widget.id} className="min-w-0 xl:col-span-7">
                <PositionsList />
              </div>
            );
          }

          if (widget.id === "history") {
            return (
              <div key={widget.id} className="min-w-0 xl:col-span-5">
                <TransactionHistory />
              </div>
            );
          }

          if (widget.id === "portfolio") {
            return (
              <div key={widget.id} className="min-w-0 xl:col-span-6">
                <PortfolioSummaryCard
                  balance={balance}
                  currentPortfolioPnl={currentPortfolioPnl}
                  currentPortfolioValue={currentPortfolioValue}
                  positions={positions}
                  transactions={transactions}
                />
              </div>
            );
          }

          if (widget.id === "ranking") {
            return (
              <div key={widget.id} className="min-w-0 xl:col-span-6">
                <RankingCard rankingRows={rankingRows} currentUserId={user?.id} />
              </div>
            );
          }

          if (widget.id === "news") {
            return (
              <div key={widget.id} className="min-w-0 xl:col-span-6">
                <NewsCard selectedSymbol={selectedSymbol} recentTransactions={recentTransactions} />
              </div>
            );
          }

          return (
            <div key={widget.id} className="min-w-0 xl:col-span-6">
              <VisitedPairsCard
                visitedSymbols={visitedSymbols}
                selectedSymbol={selectedSymbol}
                setSelectedSymbol={setSelectedSymbol}
                symbolsById={symbolsById}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WidgetToggleBar = ({ normalizedWidgetState, onToggleWidget }) => (
  <div className="glass-card rounded-lg p-3">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">Barra de widgets del dashboard</p>
        <p className="text-xs text-muted-foreground">
          Activa o desactiva cada bloque que aparece debajo del pricechart.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {WIDGET_ITEMS.map((widget) => {
          const Icon = widget.icon;
          const isActive = normalizedWidgetState[widget.id];

          return (
            <button
              key={widget.id}
              type="button"
              onClick={() => onToggleWidget(widget.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                isActive
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/70 bg-background/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{widget.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default DashboardWidgetShelf;
