import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMarketDrawingsFromBackend,
  saveMarketDrawingsToBackend,
} from "@/lib/backend-market";
import {
  cloneDrawing,
  cloneDrawings,
  createDrawingId,
  drawingIsReadOnly,
  normalizeDrawing,
} from "../drawings/drawingDefaults";

const HISTORY_LIMIT = 75;
const PERSISTENCE_TIMEFRAME = "all";

const updateTimestamp = (drawing) => ({
  ...drawing,
  version: (Number(drawing.version) || 0) + 1,
  updatedAt: new Date().toISOString(),
});

export function useDrawings({ selectedSymbol, currentTimeframe, ownerId, classId = null }) {
  const [drawingObjects, setDrawingObjects] = useState([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const [persistenceState, setPersistenceState] = useState("loading");
  const [persistenceError, setPersistenceError] = useState(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const hydratedKeyRef = useRef(null);
  const activeKeyRef = useRef(null);
  const drawingObjectsRef = useRef([]);
  const historyRef = useRef({ past: [], future: [] });
  const loadSucceededKeyRef = useRef(null);
  const transactionRef = useRef(null);
  const isTransactionActiveRef = useRef(false);
  const copiedStyleRef = useRef(null);
  const [hasCopiedStyle, setHasCopiedStyle] = useState(false);

  const persistenceKey = `${ownerId || "anonymous"}:${classId || "personal"}:${selectedSymbol || "none"}`;

  useEffect(() => {
    drawingObjectsRef.current = drawingObjects;
  }, [drawingObjects]);

  const pushHistory = useCallback((previousObjects) => {
    historyRef.current.past = [
      ...historyRef.current.past.slice(-(HISTORY_LIMIT - 1)),
      cloneDrawings(previousObjects),
    ];
    historyRef.current.future = [];
    setHistoryVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestKey = persistenceKey;
    activeKeyRef.current = requestKey;
    hydratedKeyRef.current = null;
    loadSucceededKeyRef.current = null;
    historyRef.current = { past: [], future: [] };
    transactionRef.current = null;
    isTransactionActiveRef.current = false;
    setHistoryVersion((value) => value + 1);
    setSelectedDrawingId(null);
    setDrawingObjects([]);
    setPersistenceError(null);
    setPersistenceState("loading");

    if (!selectedSymbol || !ownerId) {
      hydratedKeyRef.current = requestKey;
      setPersistenceState(ownerId ? "saved" : "unavailable");
      return () => {
        cancelled = true;
      };
    }

    getMarketDrawingsFromBackend({
      symbol: selectedSymbol,
      timeframe: PERSISTENCE_TIMEFRAME,
      classId,
    })
      .then((objects) => {
        if (cancelled || activeKeyRef.current !== requestKey) return;
        const normalized = (Array.isArray(objects) ? objects : [])
          .map((drawing) => normalizeDrawing(drawing, {
            symbol: selectedSymbol,
            timeframe: currentTimeframe,
            ownerId,
          }))
          .filter((drawing) => drawing.anchors.length > 0);
        setDrawingObjects(normalized);
        hydratedKeyRef.current = requestKey;
        loadSucceededKeyRef.current = requestKey;
        setPersistenceState("saved");
      })
      .catch((error) => {
        if (cancelled || activeKeyRef.current !== requestKey) return;
        console.error("drawing load error", error);
        hydratedKeyRef.current = requestKey;
        setPersistenceError(error);
        setPersistenceState("error");
      });

    return () => {
      cancelled = true;
      if (loadSucceededKeyRef.current === requestKey && selectedSymbol && ownerId) {
        void saveMarketDrawingsToBackend({
          symbol: selectedSymbol,
          timeframe: PERSISTENCE_TIMEFRAME,
          classId,
          objects: drawingObjectsRef.current,
        }).catch((error) => console.error("drawing flush error", error));
      }
    };
  }, [classId, ownerId, persistenceKey, selectedSymbol]);

  useEffect(() => {
    if (
      !selectedSymbol ||
      !ownerId ||
      hydratedKeyRef.current !== persistenceKey ||
      isTransactionActiveRef.current
    ) {
      return undefined;
    }

    setPersistenceState("saving");
    const timeoutId = window.setTimeout(() => {
      saveMarketDrawingsToBackend({
        symbol: selectedSymbol,
        timeframe: PERSISTENCE_TIMEFRAME,
        classId,
        objects: drawingObjects,
      })
        .then(() => {
          if (activeKeyRef.current !== persistenceKey) return;
          setPersistenceError(null);
          setPersistenceState("saved");
        })
        .catch((error) => {
          if (activeKeyRef.current !== persistenceKey) return;
          console.error("drawing save error", error);
          setPersistenceError(error);
          setPersistenceState("error");
        });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [classId, drawingObjects, ownerId, persistenceKey, selectedSymbol]);

  const commitObjects = useCallback((producer, { recordHistory = true } = {}) => {
    setDrawingObjects((previous) => {
      const next = typeof producer === "function" ? producer(previous) : producer;
      if (next === previous) return previous;
      if (recordHistory) pushHistory(previous);
      return next;
    });
  }, [pushHistory]);

  const addDrawing = useCallback((drawing) => {
    commitObjects((previous) => [...previous, drawing]);
    setSelectedDrawingId(drawing.id);
  }, [commitObjects]);

  const updateDrawing = useCallback((drawingId, patchOrProducer, options) => {
    commitObjects((previous) => previous.map((drawing) => {
      if (drawing.id !== drawingId) return drawing;
      if (drawingIsReadOnly(drawing, ownerId)) return drawing;
      const patch = typeof patchOrProducer === "function" ? patchOrProducer(drawing) : patchOrProducer;
      return updateTimestamp({ ...drawing, ...patch });
    }), options);
  }, [commitObjects, ownerId]);

  const setDrawingHidden = useCallback((drawingId, hidden) => {
    commitObjects((previous) => previous.map((drawing) => drawing.id === drawingId
      ? updateTimestamp({ ...drawing, state: { ...drawing.state, hidden: Boolean(hidden) } })
      : drawing
    ));
    setSelectedDrawingId(drawingId);
  }, [commitObjects]);

  const setDrawingExplanationVisible = useCallback((drawingId, visible) => {
    commitObjects((previous) => previous.map((drawing) => drawing.id === drawingId
      ? {
          ...drawing,
          education: { ...drawing.education, showExplanation: Boolean(visible) },
        }
      : drawing
    ), { recordHistory: false });
  }, [commitObjects]);

  const copyDrawingStyle = useCallback((drawingId) => {
    const drawing = drawingObjectsRef.current.find((item) => item.id === drawingId);
    if (!drawing) return;
    copiedStyleRef.current = cloneDrawing({
      style: drawing.style,
      fibonacci: drawing.fibonacci
        ? {
            labelMode: drawing.fibonacci.labelMode,
            levels: drawing.fibonacci.levels,
          }
        : null,
    });
    setHasCopiedStyle(true);
  }, []);

  const pasteDrawingStyle = useCallback((drawingId) => {
    const copied = copiedStyleRef.current;
    if (!copied) return;
    updateDrawing(drawingId, (drawing) => ({
      style: { ...drawing.style, ...cloneDrawing(copied.style) },
      fibonacci: drawing.fibonacci && copied.fibonacci
        ? {
            ...drawing.fibonacci,
            labelMode: copied.fibonacci.labelMode,
            levels: cloneDrawing(copied.fibonacci.levels),
          }
        : drawing.fibonacci,
    }));
  }, [updateDrawing]);

  const removeDrawing = useCallback((drawingId) => {
    commitObjects((previous) => previous.filter((drawing) => (
      drawing.id !== drawingId || drawingIsReadOnly(drawing, ownerId)
    )));
    setSelectedDrawingId((selectedId) => selectedId === drawingId ? null : selectedId);
  }, [commitObjects, ownerId]);

  const clearDrawingObjects = useCallback(() => {
    commitObjects((previous) => previous.filter((drawing) => drawingIsReadOnly(drawing, ownerId)));
    setSelectedDrawingId(null);
  }, [commitObjects, ownerId]);

  const duplicateDrawing = useCallback((drawingId) => {
    let duplicateId = null;
    commitObjects((previous) => {
      const source = previous.find((drawing) => drawing.id === drawingId);
      if (!source) return previous;
      duplicateId = createDrawingId();
      const now = new Date().toISOString();
      const duplicate = {
        ...cloneDrawing(source),
        id: duplicateId,
        name: source.name ? `${source.name} copy` : "",
        anchors: source.anchors.map((anchor) => ({
          ...anchor,
          price: Number(anchor.price) * 1.002,
          logical: Number.isFinite(anchor.logical) ? anchor.logical + 2 : anchor.logical,
          candleIndex: Number.isFinite(anchor.candleIndex) ? anchor.candleIndex + 2 : anchor.candleIndex,
        })),
        state: { ...source.state, locked: false, hidden: false, selected: false },
        ownership: { ...source.ownership, ownerId, visibility: "private", classId: null },
        education: { ...source.education, readOnly: false },
        zIndex: Math.max(0, ...previous.map((drawing) => Number(drawing.zIndex) || 0)) + 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      return [...previous, duplicate];
    });
    if (duplicateId) setSelectedDrawingId(duplicateId);
  }, [commitObjects, ownerId]);

  const reorderDrawing = useCallback((drawingId, direction) => {
    commitObjects((previous) => {
      const ordered = [...previous].sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0));
      const index = ordered.findIndex((drawing) => drawing.id === drawingId);
      if (index >= 0 && drawingIsReadOnly(ordered[index], ownerId)) return previous;
      const swapIndex = direction === "front" ? index + 1 : index - 1;
      if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return previous;
      const currentZ = ordered[index].zIndex;
      ordered[index] = updateTimestamp({ ...ordered[index], zIndex: ordered[swapIndex].zIndex });
      ordered[swapIndex] = updateTimestamp({ ...ordered[swapIndex], zIndex: currentZ });
      return ordered;
    });
  }, [commitObjects, ownerId]);

  const beginTransaction = useCallback(() => {
    if (transactionRef.current) return;
    setDrawingObjects((current) => {
      transactionRef.current = cloneDrawings(current);
      isTransactionActiveRef.current = true;
      return current;
    });
  }, []);

  const updateDrawingTransient = useCallback((drawingId, producer) => {
    setDrawingObjects((previous) => previous.map((drawing) =>
      drawing.id === drawingId ? producer(drawing) : drawing
    ));
  }, []);

  const commitTransaction = useCallback(() => {
    const original = transactionRef.current;
    transactionRef.current = null;
    isTransactionActiveRef.current = false;
    if (!original) return;
    pushHistory(original);
    const originalById = new Map(original.map((drawing) => [drawing.id, drawing]));
    setDrawingObjects((previous) => previous.map((drawing) => {
      const before = originalById.get(drawing.id);
      return before && JSON.stringify(before.anchors) === JSON.stringify(drawing.anchors)
        ? drawing
        : updateTimestamp(drawing);
    }));
  }, [pushHistory]);

  const cancelTransaction = useCallback(() => {
    const original = transactionRef.current;
    transactionRef.current = null;
    isTransactionActiveRef.current = false;
    if (original) setDrawingObjects(original);
  }, []);

  const undo = useCallback(() => {
    const previousSnapshot = historyRef.current.past.pop();
    if (!previousSnapshot) return;
    setDrawingObjects((current) => {
      historyRef.current.future = [cloneDrawings(current), ...historyRef.current.future].slice(0, HISTORY_LIMIT);
      return cloneDrawings(previousSnapshot);
    });
    setSelectedDrawingId(null);
    setHistoryVersion((value) => value + 1);
  }, []);

  const redo = useCallback(() => {
    const nextSnapshot = historyRef.current.future.shift();
    if (!nextSnapshot) return;
    setDrawingObjects((current) => {
      historyRef.current.past = [...historyRef.current.past, cloneDrawings(current)].slice(-HISTORY_LIMIT);
      return cloneDrawings(nextSnapshot);
    });
    setSelectedDrawingId(null);
    setHistoryVersion((value) => value + 1);
  }, []);

  const selectedDrawing = useMemo(
    () => drawingObjects.find((drawing) => drawing.id === selectedDrawingId) ?? null,
    [drawingObjects, selectedDrawingId]
  );

  return {
    addDrawing,
    beginTransaction,
    canRedo: historyRef.current.future.length > 0,
    canUndo: historyRef.current.past.length > 0,
    cancelTransaction,
    clearDrawingObjects,
    commitTransaction,
    copyDrawingStyle,
    drawingObjects,
    duplicateDrawing,
    historyVersion,
    hasCopiedStyle,
    pasteDrawingStyle,
    persistenceError,
    persistenceState,
    redo,
    removeDrawing,
    reorderDrawing,
    selectedDrawing,
    selectedDrawingId,
    setDrawingHidden,
    setDrawingExplanationVisible,
    setSelectedDrawingId,
    undo,
    updateDrawing,
    updateDrawingTransient,
  };
}
