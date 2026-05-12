import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MINUTE_TIMEFRAMES } from "@/lib/market-timeframes";
import { getHistoryLimit, getRefreshInterval, loadOhlcHistory } from "./ohlcHistoryService";
import { ensureOhlcCacheScope } from "./ohlcHistoryCache";

const HOUR_TIMEFRAMES = new Set(["1H", "2H", "3H", "4H"]);
const PROGRESSIVE_TIMEFRAMES = new Set([...MINUTE_TIMEFRAMES, ...HOUR_TIMEFRAMES]);
const OLDER_HISTORY_OVERLAP_MS = 60 * 1000;
const INITIAL_LOAD_LIMIT = 500;
const OLDER_LOAD_LIMIT = 100;

function hasHistoryChanged(currentHistory, nextHistory) {
  if (currentHistory === nextHistory) {
    return false;
  }

  if (!Array.isArray(currentHistory) || !Array.isArray(nextHistory)) {
    return true;
  }

  if (currentHistory.length !== nextHistory.length) {
    return true;
  }

  const currentLast = currentHistory[currentHistory.length - 1];
  const nextLast = nextHistory[nextHistory.length - 1];

  if (!currentLast || !nextLast) {
    return Boolean(currentLast || nextLast);
  }

  return (
    currentLast.time !== nextLast.time ||
    currentLast.open !== nextLast.open ||
    currentLast.high !== nextLast.high ||
    currentLast.low !== nextLast.low ||
    currentLast.close !== nextLast.close
  );
}

function mergeCandles(existingHistory, incomingHistory) {
  const mergedByTime = new Map();

  if (Array.isArray(existingHistory)) {
    existingHistory.forEach((candle) => {
      if (Number.isFinite(candle?.time)) {
        mergedByTime.set(candle.time, candle);
      }
    });
  }

  if (Array.isArray(incomingHistory)) {
    incomingHistory.forEach((candle) => {
      if (Number.isFinite(candle?.time)) {
        mergedByTime.set(candle.time, candle);
      }
    });
  }

  return Array.from(mergedByTime.values()).sort((left, right) => left.time - right.time);
}

function buildCurrentMonthWindow() {
  const now = new Date();
  const monthStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  return {
    from: monthStartUtc.toISOString(),
    to: now.toISOString(),
  };
}

function buildTodayWindow() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  return {
    from: dayStart.toISOString(),
    to: now.toISOString(),
  };
}

function buildLastDaysWindow(days) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

function mergeHistoryOrKeepCurrent(currentHistory, nextHistory) {
  const mergedHistory = mergeCandles(currentHistory, nextHistory);
  return hasHistoryChanged(currentHistory, mergedHistory) ? mergedHistory : currentHistory;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeHistoryArray(value) {
  return Array.isArray(value) ? value : [];
}

function getFallbackWindowsForInitialLoad() {
  return [buildTodayWindow(), buildCurrentMonthWindow(), buildLastDaysWindow(7)];
}

function maybeUpdateLoadedWindowFromHistory({ nextHistory, oldestLoadedTimeRef, loadedWindowRef }) {
  const oldestCandleTime = getOldestCandleUnixTime(nextHistory);
  const currentOldestTime = oldestLoadedTimeRef.current;
  const resolvedOldestTime = [oldestCandleTime, currentOldestTime]
    .filter((value) => Number.isFinite(value))
    .reduce((oldest, value) => (value < oldest ? value : oldest), Number.POSITIVE_INFINITY);

  if (Number.isFinite(resolvedOldestTime)) {
    loadedWindowRef.current = { from: toIsoFromUnixSeconds(resolvedOldestTime) };
  }
}

function mergeNextHistoryIntoChart({ nextHistory, setChartHistory }) {
  setChartHistory((currentHistory) => mergeHistoryOrKeepCurrent(currentHistory, nextHistory));
}

function buildMonthlyCursorFromWindow(window) {
  if (!window?.from) {
    return null;
  }

  return { from: window.from };
}

function shouldStopOlderHistoryLoad({ currentOldestTime, olderWindowOldestTime }) {
  return (
    Number.isFinite(currentOldestTime) &&
    Number.isFinite(olderWindowOldestTime) &&
    olderWindowOldestTime >= currentOldestTime
  );
}

function resolveOlderWindowFromCursor({ loadedWindowRef, oldestLoadedTimeRef }) {
  const currentOldestTime = oldestLoadedTimeRef.current;
  const cursorFromIso = loadedWindowRef.current?.from ?? toIsoFromUnixSeconds(currentOldestTime);

  if (!cursorFromIso) {
    return null;
  }

  return buildOlderMonthlyWindow(cursorFromIso);
}

function resolveOlderWindowCursor({ olderWindowOldestTime, olderWindow }) {
  return {
    from: Number.isFinite(olderWindowOldestTime)
      ? toIsoFromUnixSeconds(olderWindowOldestTime)
      : olderWindow.from,
  };
}

function getOldestTimeFromHistory(history) {
  return history.reduce((oldest, candle) => {
    if (Number.isFinite(candle?.time)) {
      if (!Number.isFinite(oldest)) {
        return candle.time;
      }

      return candle.time < oldest ? candle.time : oldest;
    }

    return oldest;
  }, Number.NaN);
}

function isProgressiveTimeframe(timeframe) {
  return PROGRESSIVE_TIMEFRAMES.has(timeframe);
}

function getInitialLoadLimit(timeframe, fallbackLimit) {
  return Number.isFinite(INITIAL_LOAD_LIMIT) ? INITIAL_LOAD_LIMIT : fallbackLimit;
}

function getOlderLoadLimit(timeframe, fallbackLimit) {
  return Number.isFinite(OLDER_LOAD_LIMIT) ? OLDER_LOAD_LIMIT : fallbackLimit;
}

function getOldestCandleUnixTime(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  let oldest = Number.POSITIVE_INFINITY;

  history.forEach((candle) => {
    if (!Number.isFinite(candle?.time)) {
      return;
    }

    if (candle.time < oldest) {
      oldest = candle.time;
    }
  });

  return Number.isFinite(oldest) ? oldest : null;
}

function toIsoFromUnixSeconds(unixSeconds) {
  if (!Number.isFinite(unixSeconds)) {
    return null;
  }

  return new Date(unixSeconds * 1000).toISOString();
}

function buildOlderMonthlyWindow(cursorFromIso) {
  const cursorDate = new Date(cursorFromIso);
  if (!Number.isFinite(cursorDate.getTime())) {
    return null;
  }

  const nextTo = new Date(cursorDate.getTime() - OLDER_HISTORY_OVERLAP_MS);
  const monthStartUtc = new Date(
    Date.UTC(nextTo.getUTCFullYear(), nextTo.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  return {
    from: monthStartUtc.toISOString(),
    to: nextTo.toISOString(),
  };
}

function markOldestHistoryAsReached({
  oldestHistoryReachedRef,
  setHasReachedOldestHistory,
}) {
  oldestHistoryReachedRef.current = true;
  setHasReachedOldestHistory(true);
}

export function useOhlcHistory({ cacheScopeKey, selectedSymbol, timeframe }) {
  const [chartHistory, setChartHistory] = useState([]);
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
  const [hasReachedOldestHistory, setHasReachedOldestHistory] = useState(false);
  const historyLimit = getHistoryLimit(timeframe);
  const initialLoadLimit = useMemo(
    () => getInitialLoadLimit(timeframe, historyLimit),
    [historyLimit, timeframe]
  );
  const olderLoadLimit = useMemo(
    () => getOlderLoadLimit(timeframe, historyLimit),
    [historyLimit, timeframe]
  );
  const refreshInterval = getRefreshInterval(timeframe);
  const progressive = useMemo(() => isProgressiveTimeframe(timeframe), [timeframe]);
  const loadedWindowRef = useRef(null);
  const loadingOlderRef = useRef(false);
  const oldestHistoryReachedRef = useRef(false);
  const oldestLoadedTimeRef = useRef(null);

  useEffect(() => {
    ensureOhlcCacheScope(cacheScopeKey);
  }, [cacheScopeKey]);

  useEffect(() => {
    loadedWindowRef.current = null;
    loadingOlderRef.current = false;
    oldestHistoryReachedRef.current = false;
    oldestLoadedTimeRef.current = null;
    setChartHistory([]);
    setIsLoadingOlderHistory(false);
    setHasReachedOldestHistory(false);
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    if (!Array.isArray(chartHistory) || chartHistory.length === 0) {
      oldestLoadedTimeRef.current = null;
      return;
    }

    const oldestTime = chartHistory[0]?.time;
    oldestLoadedTimeRef.current = Number.isFinite(oldestTime) ? oldestTime : null;
  }, [chartHistory]);

  useEffect(() => {
    let isMounted = true;

    const loadLatestHistory = async (force = false) => {
      try {
        if (progressive) {
          let nextHistory = await loadOhlcHistory({
            symbol: selectedSymbol,
            timeframe,
            limit: initialLoadLimit,
            force,
          });

          if (!isNonEmptyArray(nextHistory)) {
            const fallbackWindows = getFallbackWindowsForInitialLoad();
            for (const fallbackWindow of fallbackWindows) {
              nextHistory = await loadOhlcHistory({
                symbol: selectedSymbol,
                timeframe,
                limit: initialLoadLimit,
                from: fallbackWindow.from,
                to: fallbackWindow.to,
                force,
              });

              if (isNonEmptyArray(nextHistory)) {
                loadedWindowRef.current = buildMonthlyCursorFromWindow(fallbackWindow);
                break;
              }
            }
          }

          if (!isMounted) {
            return;
          }

          nextHistory = normalizeHistoryArray(nextHistory);
          maybeUpdateLoadedWindowFromHistory({ nextHistory, oldestLoadedTimeRef, loadedWindowRef });

          if (force) {
            mergeNextHistoryIntoChart({ nextHistory, setChartHistory });
          } else {
            setChartHistory(nextHistory);
          }

          return;
        }

        const nextHistory = await loadOhlcHistory({
          symbol: selectedSymbol,
          timeframe,
          limit: initialLoadLimit,
          force,
        });

        if (isMounted) {
          setChartHistory((currentHistory) =>
            hasHistoryChanged(currentHistory, nextHistory) ? nextHistory : currentHistory
          );
        }
      } catch (error) {
        console.error("loadChartHistory error", error);

        if (isMounted) {
          setChartHistory([]);
        }
      }
    };

    loadLatestHistory();
    const intervalId = window.setInterval(() => {
      loadLatestHistory(true);
    }, refreshInterval);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [initialLoadLimit, progressive, refreshInterval, selectedSymbol, timeframe]);

  const loadOlderHistory = useCallback(async () => {
    if (!progressive || loadingOlderRef.current || oldestHistoryReachedRef.current) {
      return false;
    }

    const olderWindow = resolveOlderWindowFromCursor({ loadedWindowRef, oldestLoadedTimeRef });
    if (!olderWindow) {
      markOldestHistoryAsReached({
        oldestHistoryReachedRef,
        setHasReachedOldestHistory,
      });
      return false;
    }
    const currentOldestTime = oldestLoadedTimeRef.current;

    loadingOlderRef.current = true;
    setIsLoadingOlderHistory(true);

    try {
      const olderHistory = await loadOhlcHistory({
        symbol: selectedSymbol,
        timeframe,
        limit: olderLoadLimit,
        from: olderWindow.from,
        to: olderWindow.to,
      });

      if (!Array.isArray(olderHistory) || olderHistory.length === 0) {
        markOldestHistoryAsReached({
          oldestHistoryReachedRef,
          setHasReachedOldestHistory,
        });
        return false;
      }

      const olderWindowOldestTime = getOldestTimeFromHistory(olderHistory);

      if (shouldStopOlderHistoryLoad({ currentOldestTime, olderWindowOldestTime })) {
        markOldestHistoryAsReached({
          oldestHistoryReachedRef,
          setHasReachedOldestHistory,
        });
        return false;
      }

      loadedWindowRef.current = resolveOlderWindowCursor({ olderWindowOldestTime, olderWindow });

      let didAppendOlderCandles = false;
      setChartHistory((currentHistory) => {
        const mergedHistory = mergeCandles(currentHistory, olderHistory);
        didAppendOlderCandles = mergedHistory.length > currentHistory.length;
        return mergedHistory;
      });

      if (!didAppendOlderCandles) {
        markOldestHistoryAsReached({
          oldestHistoryReachedRef,
          setHasReachedOldestHistory,
        });
        return false;
      }

      setHasReachedOldestHistory(false);
      oldestHistoryReachedRef.current = false;
      return true;
    } catch (error) {
      console.error("loadOlderHistory error", error);
      return false;
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlderHistory(false);
    }
  }, [olderLoadLimit, progressive, selectedSymbol, timeframe]);

  return {
    chartHistory,
    hasReachedOldestHistory,
    historyLimit,
    isLoadingOlderHistory,
    loadOlderHistory,
    progressiveHistoryEnabled: progressive,
  };
}
