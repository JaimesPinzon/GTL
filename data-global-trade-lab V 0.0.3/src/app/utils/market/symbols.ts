export const trackedMarketSymbols = [
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
    "DJI",
    "SPX",
    "BTC/USD",
    "ETH/USD",
    "XRP/USD",
    "ADA/USD",
    "SOL/USD",
    "NU",
] as const;

export function parseTrackedSymbols(rawSymbols?: string | null) {
    const normalizedSymbols = rawSymbols
        ?.split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);

    return normalizedSymbols?.length ? normalizedSymbols : [...trackedMarketSymbols];
}


