export const timeframeConfigs = {
    "1M": { providerInterval: "1m", range: "max", aggregateSize: 1, baseInterval: "1m" },
    "2M": { providerInterval: "2m", range: "max", aggregateSize: 1, baseInterval: "1m" },
    "3M": { providerInterval: "1m", range: "max", aggregateSize: 3, baseInterval: "1m" },
    "5M": { providerInterval: "5m", range: "max", aggregateSize: 1, baseInterval: "5m" },
    "10M": { providerInterval: "5m", range: "max", aggregateSize: 2, baseInterval: "5m" },
    "15M": { providerInterval: "15m", range: "max", aggregateSize: 1, baseInterval: "15m" },
    "30M": { providerInterval: "30m", range: "max", aggregateSize: 1, baseInterval: "15m" },
    "45M": { providerInterval: "15m", range: "max", aggregateSize: 3, baseInterval: "15m" },
    "1H": { providerInterval: "60m", range: "max", aggregateSize: 1, baseInterval: "1h" },
    "2H": { providerInterval: "60m", range: "max", aggregateSize: 2, baseInterval: "1h" },
    "3H": { providerInterval: "60m", range: "max", aggregateSize: 3, baseInterval: "1h" },
    "4H": { providerInterval: "60m", range: "max", aggregateSize: 4, baseInterval: "1h" },
    "1D": { providerInterval: "1d", range: "max", aggregateSize: 1, baseInterval: "1d" },
    "1W": { providerInterval: "1wk", range: "max", aggregateSize: 1, baseInterval: "1wk" },
    "1MO": { providerInterval: "1mo", range: "max", aggregateSize: 1, baseInterval: "1mo" },
    "3MO": { providerInterval: "3mo", range: "max", aggregateSize: 1, baseInterval: "1mo" },
    "6MO": { providerInterval: "1mo", range: "max", aggregateSize: 6, baseInterval: "1mo" },
    "12MO": { providerInterval: "1mo", range: "max", aggregateSize: 12, baseInterval: "1y" },
    "1Y": { providerInterval: "1mo", range: "max", aggregateSize: 12, baseInterval: "1y" },
    "5Y": { providerInterval: "1mo", range: "max", aggregateSize: 60, baseInterval: "1y" },
} as const;

export const timeframeAliases: Record<string, keyof typeof timeframeConfigs> = {
    "1m": "1M",
    "2m": "2M",
    "3m": "3M",
    "4m": "3M",
    "5m": "5M",
    "10m": "10M",
    "15m": "15M",
    "30m": "30M",
    "45m": "45M",
    "1H": "1H",
    "2H": "2H",
    "3H": "3H",
    "4H": "4H",
    "1D": "1D",
    "3D": "1D",
    "5D": "1D",
    "1W": "1W",
    "1M": "1MO",
    "3M": "3MO",
    "6M": "6MO",
    "1Y": "1Y",
    "3Y": "1Y",
    "5Y": "5Y",
};

export const yahooBaseTimeframeConfigs = {
    "1m": { providerInterval: "1m", range: "max", tableName: "candles" },
    "5m": { providerInterval: "5m", range: "max", tableName: "candles" },
    "15m": { providerInterval: "15m", range: "max", tableName: "candles" },
    "1h": { providerInterval: "60m", range: "max", tableName: "candles" },
    "1d": { providerInterval: "1d", range: "max", tableName: "candles" },
    "1wk": { providerInterval: "1wk", range: "max", tableName: "candles" },
    "1mo": { providerInterval: "1mo", range: "max", tableName: "candles" },
    "1y": { providerInterval: "1mo", range: "max", tableName: "candles" },
} as const;

export type SupportedTimeframe = keyof typeof timeframeConfigs;
export type YahooBaseTimeframe = keyof typeof yahooBaseTimeframeConfigs;

export function normalizeTimeframeKey(timeframe: string) {
    const trimmedTimeframe = timeframe.trim();
    return timeframeAliases[trimmedTimeframe] ?? trimmedTimeframe;
}

export function getConfigForTimeframe(timeframe: string) {
    const normalizedTimeframe = normalizeTimeframeKey(timeframe);
    return (
        timeframeConfigs[normalizedTimeframe as SupportedTimeframe] ??
        timeframeConfigs["1M"]
    );
}

export function getYahooBaseConfig(timeframe: string) {
    const normalizedTimeframe = timeframe.trim().toLowerCase();
    return yahooBaseTimeframeConfigs[
        normalizedTimeframe as YahooBaseTimeframe
    ] ?? null;
}

export function getProviderFreshnessMs(providerInterval: string) {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const freshnessByInterval: Record<string, number> = {
        "1m": FIVE_MINUTES_MS,
        "2m": FIVE_MINUTES_MS,
        "5m": FIVE_MINUTES_MS,
        "15m": FIVE_MINUTES_MS,
        "30m": FIVE_MINUTES_MS,
        "60m": FIVE_MINUTES_MS,
        "1d": FIVE_MINUTES_MS,
        "1wk": FIVE_MINUTES_MS,
        "1mo": FIVE_MINUTES_MS,
        "3mo": FIVE_MINUTES_MS,
    };

    return freshnessByInterval[providerInterval] ?? FIVE_MINUTES_MS;
}



