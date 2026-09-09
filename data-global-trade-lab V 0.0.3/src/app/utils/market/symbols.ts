export const symbols = [
    "AAPL",
    "MSFT",
    "AMZN",
    "GOOGL",
    "NVDA",
    "TSLA",
    "META",
    "BRK.B",
    "JPM",
    "JNJ",
    "QQQ",
    "DIA",
    "SPY",
    "BTC/USD",
    "ETH/USD",
    "NU",
    "XRP/USD",
    "ADA/USD",
    "SOL/USD",
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
