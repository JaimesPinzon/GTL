export const trackedMarketSymbols = [
    "AAPL",
    "MSFT",
    "QQQ",
    "DJI",
    "SPX",
    "BTC/USD",
    "ETH/USD",
    "NU",
] as const;

export function parseTrackedSymbols(rawSymbols?: string | null) {
    const normalizedSymbols = rawSymbols
        ?.split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);

    return normalizedSymbols?.length ? normalizedSymbols : [...trackedMarketSymbols];
}
/*    "AMZN",
"GOOGL",
"NVDA",
"TSLA",
"META",
"BRK.B",
"JPM",
"JNJ",
"XRP/USD",
"ADA/USD",
"SOL/USD",
*/
