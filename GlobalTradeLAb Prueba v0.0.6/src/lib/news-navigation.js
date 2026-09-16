import { ENABLED_MARKET_ASSETS } from "./market-assets.js";

export const normalizeNewsSymbol = (value) => String(value || "").trim().toUpperCase().replace("/", "");

export const getRequiredMarketForAssetType = (type) => ({
  stock: "stocks",
  etf: "indices",
  index: "indices",
  forex: "forex",
  crypto: "crypto",
  commodities: "commodities",
}[type] || type);

export const resolveNewsAssetAvailability = ({ symbol, classId, classes = [], assets = ENABLED_MARKET_ASSETS }) => {
  const normalizedSymbol = normalizeNewsSymbol(symbol);
  const targetClass = classes.find((room) => room.id === classId) || null;
  const asset = assets.find((entry) => entry.id === normalizedSymbol) || null;

  if (!targetClass) return { available: false, reason: "class-required", asset, targetClass };
  if (!asset) return { available: false, reason: "asset-unsupported", asset, targetClass };

  const requiredMarket = getRequiredMarketForAssetType(asset.type);
  const allowedMarkets = Array.isArray(targetClass.allowedMarkets) ? targetClass.allowedMarkets : [];
  const available = allowedMarkets.includes(requiredMarket);
  return {
    available,
    reason: available ? null : "market-disabled",
    requiredMarket,
    asset,
    targetClass,
  };
};
