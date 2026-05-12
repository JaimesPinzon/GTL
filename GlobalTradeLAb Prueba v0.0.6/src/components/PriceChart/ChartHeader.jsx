import React from "react";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/market-data";

const ChartHeader = ({
  currentSymbolInfo,
  selectedSymbol,
  ohlc,
  hoverOhlc,
  priceChange,
  priceChangePercent,
  currency,
  chartAppearance,
  clearDrawings,
  hasDrawings,
}) => {
  const safeCurrency = currency || "USD";
  const primaryValues = ohlc ?? {};
  const secondaryValues = hoverOhlc ?? primaryValues;
  const isPrimaryPositive = (priceChange ?? 0) >= 0;
  const secondaryReference =
    hoverOhlc?.prevClose ??
    secondaryValues?.open ??
    0;
  const secondaryChange =
    secondaryReference && secondaryValues?.close != null
      ? secondaryValues.close - secondaryReference
      : 0;
  const secondaryPercent =
    secondaryReference
      ? (secondaryChange / secondaryReference) * 100
      : 0;
  const isSecondaryPositive = secondaryChange >= 0;
  const upColor = chartAppearance?.upColor ?? "#22c55e";
  const downColor = chartAppearance?.downColor ?? "#ef4444";

  const formatNumber = (value) => {
    const formatted = formatCurrency(Number.isFinite(value) ? value : 0, safeCurrency);
    return formatted.replace(/^[^\d-]+/, "");
  };

  const OhlcLine = ({ values, positive, changeValue, percentValue, subtle = false }) => (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 font-medium ${
        subtle ? "text-[11px]" : "text-xs"
      }`}
      style={{ color: positive ? upColor : downColor }}
    >
      <span>
        <span className="mr-1 text-white">O</span>
        {formatNumber(values?.open)}
      </span>
      <span>
        <span className="mr-1 text-white">H</span>
        {formatNumber(values?.high)}
      </span>
      <span>
        <span className="mr-1 text-white">L</span>
        {formatNumber(values?.low)}
      </span>
      <span>
        <span className="mr-1 text-white">C</span>
        {formatNumber(values?.close)}
      </span>
      <span>
        {positive ? "+" : "-"}
        {formatNumber(Math.abs(changeValue ?? 0))}
      </span>
      <span>
        ({positive ? "+" : ""}
        {(percentValue ?? 0).toFixed(2)}%)
      </span>
    </div>
  );

  return (
    <div className="mb-1 rounded-md border border-border bg-background/80 px-3 py-1.5 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold tracking-tight">{selectedSymbol}</p>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
              {currentSymbolInfo?.type || "asset"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {currentSymbolInfo?.name || selectedSymbol} / {safeCurrency} ·{" "}
            {currentSymbolInfo?.exchangeLabel || "Mercado global"}
          </p>
        </div>

        <div className="flex min-w-[340px] flex-col items-end gap-1">
          <OhlcLine
            values={primaryValues}
            positive={isPrimaryPositive}
            changeValue={priceChange ?? 0}
            percentValue={priceChangePercent ?? 0}
          />
          <OhlcLine
            values={secondaryValues}
            positive={isSecondaryPositive}
            changeValue={secondaryChange}
            percentValue={secondaryPercent}
            subtle
          />
        </div>
      </div>

      {hasDrawings ? (
        <div className="mt-1 border-t border-border pt-1">
          <button
            type="button"
            onClick={clearDrawings}
            className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-rose-400/40 hover:text-rose-400"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Limpiar dibujos
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ChartHeader;
