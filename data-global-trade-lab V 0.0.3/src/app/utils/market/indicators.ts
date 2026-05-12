export function calculateEMA(data: number[], period: number) {
    if (!data || data.length < period) {
        return [];
    }

    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    let sum = 0;

    for (let index = 0; index < period; index += 1) {
        sum += data[index];
    }

    emaArray.push(sum / period);

    for (let index = period; index < data.length; index += 1) {
        const ema = data[index] * k + emaArray[emaArray.length - 1] * (1 - k);
        emaArray.push(ema);
    }

    return emaArray;
}

export function calculateMACD(
    data: number[],
    shortPeriod = 12,
    longPeriod = 26,
    signalPeriod = 9
) {
    if (!data || data.length < longPeriod + signalPeriod - 1) {
        return { macdLine: [], signalLine: [], histogram: [] };
    }

    const emaShort = calculateEMA(data, shortPeriod);
    const emaLong = calculateEMA(data, longPeriod);
    const shortEmaAligned = emaShort.slice(longPeriod - shortPeriod);
    const macdLine = emaLong.map((value, index) => shortEmaAligned[index] - value);
    const signalLine = calculateEMA(macdLine, signalPeriod);
    const macdLineAligned = macdLine.slice(signalPeriod - 1);
    const histogram = signalLine.map((value, index) => macdLineAligned[index] - value);

    return { macdLine, signalLine, histogram };
}

export function buildEmaSeries(candleTimes: string[], closes: number[], emaPeriod: number) {
    return calculateEMA(closes, emaPeriod).map((value, index) => ({
        time: candleTimes[index + emaPeriod - 1],
        value,
    }));
}

export function buildMacdSeries(candleTimes: string[], closes: number[]) {
    const macdResult = calculateMACD(closes);

    const macdLine = macdResult.macdLine.map((value, index) => ({
        time: candleTimes[index + 25],
        value,
    }));

    const signalLine = macdResult.signalLine.map((value, index) => ({
        time: candleTimes[index + 33],
        value,
    }));

    const histogram = macdResult.histogram.map((value, index) => ({
        time: candleTimes[index + 33],
        value,
        color: value >= 0 ? "rgba(0, 150, 136, 0.5)" : "rgba(255, 82, 82, 0.5)",
    }));

    return { macdLine, signalLine, histogram };
}
