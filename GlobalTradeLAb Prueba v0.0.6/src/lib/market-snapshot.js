import { ENABLED_MARKET_ASSETS } from "@/lib/market-assets";

const SNAPSHOT_SYMBOL_METADATA = Object.fromEntries(
  ENABLED_MARKET_ASSETS.map(({ backendSymbol, id, nameKey, type, currency }) => [
    backendSymbol,
    { type, localSymbol: id, nameKey, currency },
  ])
);

const CRYPTO_BASE_SYMBOLS = new Set(["BTC", "ETH"]);
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
      if (!metadata) {
        return null;
      }

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
