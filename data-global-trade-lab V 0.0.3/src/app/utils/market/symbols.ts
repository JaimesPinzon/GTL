export const symbols = [
    "AAPL",
    "MSFT",
    "QQQ",
    "DIA",
    "SPY",
    "BTC/USD",
    "ETH/USD",
    "NU",
] as const;

export const trackedMarketSymbols = [...symbols];

export function normalizeMarketSymbols(inputSymbols: string[]) {
    return [...new Set(
        inputSymbols
            .map((symbol) => String(symbol || "").trim().toUpperCase())
            .filter(Boolean)
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
