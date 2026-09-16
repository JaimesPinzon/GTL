export const symbols = [
    "BTC/USD",
    "ETH/USD",
    "QQQ",
    "DIA",
    "SPY",
    "NU",
    "NVDA",
] as const;

export const trackedMarketSymbols = [...symbols];
const trackedMarketSymbolSet = new Set<string>(trackedMarketSymbols);

export function normalizeMarketSymbols(inputSymbols: string[]) {
    return [...new Set(
        inputSymbols
            .map((symbol) => String(symbol || "").trim().toUpperCase())
            .filter((symbol) => trackedMarketSymbolSet.has(symbol))
    )];
}

export function parseTrackedSymbols(rawSymbols?: string | null) {
    const normalizedSymbols = rawSymbols
        ?.split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);

    return normalizedSymbols?.length
        ? normalizeMarketSymbols(normalizedSymbols)
        : normalizeMarketSymbols(trackedMarketSymbols);
}
