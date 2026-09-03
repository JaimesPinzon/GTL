const SNAPSHOT_SYMBOL_METADATA = {
  AAPL: { type: "stock", localSymbol: "AAPL", nameKey: "trading.assets.apple", currency: "USD" },
  MSFT: { type: "stock", localSymbol: "MSFT", nameKey: "trading.assets.microsoft", currency: "USD" },
  AMZN: { type: "stock", localSymbol: "AMZN", nameKey: "trading.assets.amazon", currency: "USD" },
  GOOGL: { type: "stock", localSymbol: "GOOGL", nameKey: "trading.assets.alphabet", currency: "USD" },
  NVDA: { type: "stock", localSymbol: "NVDA", nameKey: "trading.assets.nvidia", currency: "USD" },
  TSLA: { type: "stock", localSymbol: "TSLA", nameKey: "trading.assets.tesla", currency: "USD" },
  META: { type: "stock", localSymbol: "META", nameKey: "trading.assets.meta", currency: "USD" },
  "BRK.B": { type: "stock", localSymbol: "BRK.B", nameKey: "trading.assets.berkshire", currency: "USD" },
  JPM: { type: "stock", localSymbol: "JPM", nameKey: "trading.assets.jpmorgan", currency: "USD" },
  JNJ: { type: "stock", localSymbol: "JNJ", nameKey: "trading.assets.johnson", currency: "USD" },
  QQQ: { type: "etf", localSymbol: "QQQ", nameKey: "trading.assets.qqq", currency: "USD" },
  DIA: { type: "etf", localSymbol: "DIA", nameKey: "trading.assets.dia", currency: "USD" },
  SPY: { type: "etf", localSymbol: "SPY", nameKey: "trading.assets.spy", currency: "USD" },
  "BTC/USD": { type: "crypto", localSymbol: "BTCUSD", nameKey: "trading.assets.bitcoin", currency: "USD" },
  "ETH/USD": { type: "crypto", localSymbol: "ETHUSD", nameKey: "trading.assets.ethereum", currency: "USD" },
  "XRP/USD": { type: "crypto", localSymbol: "XRPUSD", nameKey: "trading.assets.ripple", currency: "USD" },
  "ADA/USD": { type: "crypto", localSymbol: "ADAUSD", nameKey: "trading.assets.cardano", currency: "USD" },
  "SOL/USD": { type: "crypto", localSymbol: "SOLUSD", nameKey: "trading.assets.solana", currency: "USD" },
  NU: { type: "stock", localSymbol: "NU", nameKey: "trading.assets.nuHoldings", currency: "USD" },
};

const CRYPTO_BASE_SYMBOLS = new Set(["BTC", "ETH", "XRP", "ADA", "SOL"]);
export const SNAPSHOT_REFRESH_INTERVAL_MS = 20000;

export const normalizeSnapshotSymbol = (value) => String(value || "").trim().toUpperCase();

export const inferSnapshotType = (symbol) => {
  if (!symbol) {
    return "stock";
  }

  if (symbol.includes("/")) {
    const [base] = symbol.split("/");
    return CRYPTO_BASE_SYMBOLS.has(base) ? "crypto" : "forex";
  }

  return "stock";
};

export const mapSnapshotRowsToSymbols = (rows, t) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const normalizedSymbol = normalizeSnapshotSymbol(row?.symbol || row?.providerSymbol);
      if (!normalizedSymbol) {
        return null;
      }

      const metadata = SNAPSHOT_SYMBOL_METADATA[normalizedSymbol];
      const numericPrice = Number.parseFloat(String(row?.price ?? ""));
      const numericChange = Number.parseFloat(String(row?.percentChange ?? ""));
      const rawMarketStatus = String(row?.marketStatus ?? "").trim().toLowerCase();
      const isMarketOpenRaw = row?.isMarketOpen;
      const isMarketOpen =
        typeof isMarketOpenRaw === "boolean"
          ? isMarketOpenRaw
          : typeof isMarketOpenRaw === "string"
            ? ["true", "1", "yes", "open"].includes(isMarketOpenRaw.trim().toLowerCase())
              ? true
              : ["false", "0", "no", "closed"].includes(isMarketOpenRaw.trim().toLowerCase())
                ? false
                : null
            : null;
      const localSymbol = metadata?.localSymbol || normalizedSymbol.replace("/", "");
      const marketStatus =
        rawMarketStatus === "open" || rawMarketStatus === "closed" || rawMarketStatus === "unknown"
          ? rawMarketStatus
          : isMarketOpen === true
            ? "open"
            : isMarketOpen === false
              ? "closed"
              : "unknown";

      return {
        id: localSymbol,
        name: row?.assetName?.trim() || (metadata?.nameKey ? t(metadata.nameKey) : normalizedSymbol),
        type: metadata?.type || inferSnapshotType(normalizedSymbol),
        currency: row?.currency || metadata?.currency || "USD",
        price: Number.isFinite(numericPrice) ? numericPrice : 0,
        change: Number.isFinite(numericChange) ? numericChange : 0,
        isMarketOpen,
        marketStatus,
        marketSymbol: normalizedSymbol,
      };
    })
    .filter(Boolean);
};
