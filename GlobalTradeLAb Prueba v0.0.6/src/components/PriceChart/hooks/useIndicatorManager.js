import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export const MAX_ACTIVE_INDICATORS = 10;

const DEFAULT_INSTANCES = [
  {
    id: "ema",
    indicatorType: "ema",
    name: "EMA",
    active: false,
    visible: true,
    pane: "main",
    order: 0,
    source: "close",
    status: "ready",
    parameters: { period: 20 },
    style: { color: "#f59e0b", lineWidth: 2 },
  },
  {
    id: "macd",
    indicatorType: "macd",
    name: "MACD",
    active: false,
    visible: true,
    pane: "macd",
    order: 1,
    source: "close",
    status: "ready",
    parameters: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 },
    style: {
      macdColor: "#2962ff",
      signalColor: "#f59e0b",
      positiveColor: "#009688",
      negativeColor: "#ff5252",
      lineWidth: 1,
    },
  },
];

const normalizeInstances = (instances) => {
  const stored = Array.isArray(instances) ? instances : [];

  return DEFAULT_INSTANCES.map((defaults) => {
    const saved = stored.find((item) => item?.id === defaults.id) ?? {};
    return {
      ...defaults,
      ...saved,
      parameters: { ...defaults.parameters, ...(saved.parameters ?? {}) },
      style: { ...defaults.style, ...(saved.style ?? {}) },
    };
  }).sort((left, right) => left.order - right.order);
};

export function useIndicatorManager(storageScope = "anonymous") {
  const [storedInstances, setStoredInstances] = useLocalStorage(
    `gtl:chart-indicators:v1:${storageScope}`,
    DEFAULT_INSTANCES
  );
  const [favorites, setFavorites] = useLocalStorage(
    `gtl:indicator-favorites:v1:${storageScope}`,
    ["ema", "macd"]
  );

  const instances = useMemo(() => normalizeInstances(storedInstances), [storedInstances]);
  const activeInstances = useMemo(
    () => instances.filter((instance) => instance.active).sort((left, right) => left.order - right.order),
    [instances]
  );

  const updateInstances = useCallback((recipe) => {
    setStoredInstances((current) => recipe(normalizeInstances(current)));
  }, [setStoredInstances]);

  const addIndicator = useCallback((id) => {
    updateInstances((current) => {
      if (current.filter((item) => item.active).length >= MAX_ACTIVE_INDICATORS) {
        return current;
      }

      return current.map((item) => item.id === id
        ? { ...item, active: true, visible: true, status: "ready" }
        : item);
    });
  }, [updateInstances]);

  const removeIndicator = useCallback((id) => {
    updateInstances((current) => current.map((item) => item.id === id
      ? { ...item, active: false, visible: true, status: "ready" }
      : item));
  }, [updateInstances]);

  const toggleVisibility = useCallback((id) => {
    updateInstances((current) => current.map((item) => item.id === id
      ? { ...item, visible: !item.visible }
      : item));
  }, [updateInstances]);

  const updateIndicator = useCallback((id, changes) => {
    updateInstances((current) => current.map((item) => item.id === id
      ? {
          ...item,
          ...changes,
          parameters: changes.parameters
            ? { ...item.parameters, ...changes.parameters }
            : item.parameters,
          style: changes.style ? { ...item.style, ...changes.style } : item.style,
        }
      : item));
  }, [updateInstances]);

  const resetIndicator = useCallback((id) => {
    const defaults = DEFAULT_INSTANCES.find((item) => item.id === id);
    if (!defaults) return;

    updateInstances((current) => current.map((item) => item.id === id
      ? { ...defaults, active: item.active, visible: item.visible, order: item.order }
      : item));
  }, [updateInstances]);

  const reorderIndicator = useCallback((sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    updateInstances((current) => {
      const active = current.filter((item) => item.active).sort((left, right) => left.order - right.order);
      const sourceIndex = active.findIndex((item) => item.id === sourceId);
      const targetIndex = active.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;

      const [moved] = active.splice(sourceIndex, 1);
      active.splice(targetIndex, 0, moved);
      const orderById = new Map(active.map((item, index) => [item.id, index]));
      return current.map((item) => orderById.has(item.id)
        ? { ...item, order: orderById.get(item.id) }
        : item);
    });
  }, [updateInstances]);

  const toggleFavorite = useCallback((id) => {
    setFavorites((current) => {
      const safeFavorites = Array.isArray(current) ? current : [];
      return safeFavorites.includes(id)
        ? safeFavorites.filter((favoriteId) => favoriteId !== id)
        : [...safeFavorites, id];
    });
  }, [setFavorites]);

  return {
    activeInstances,
    addIndicator,
    favorites: Array.isArray(favorites) ? favorites : [],
    instances,
    removeIndicator,
    reorderIndicator,
    resetIndicator,
    toggleFavorite,
    toggleVisibility,
    updateIndicator,
  };
}
