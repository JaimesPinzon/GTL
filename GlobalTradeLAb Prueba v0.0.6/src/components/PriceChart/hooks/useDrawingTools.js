import { useCallback, useEffect, useRef, useState } from "react";
import { applyDrawingToChart } from "../utils";

export function useDrawingTools({ activeTool, chartRef, currency, seriesRef, setActiveTool }) {
  const [tempDrawingPoints, setTempDrawingPoints] = useState([]);
  const [drawingObjects, setDrawingObjects] = useState([]);
  const drawingSeriesRefs = useRef([]);
  const activeToolRef = useRef(activeTool);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const clearDrawingObjects = useCallback(() => {
    drawingSeriesRefs.current.forEach((series) => {
      if (chartRef.current && series) {
        try {
          chartRef.current.removeSeries(series);
        } catch {}
      }
    });

    drawingSeriesRefs.current = [];
    setDrawingObjects([]);
    setActiveTool(null);
    setTempDrawingPoints([]);
  }, [chartRef, setActiveTool]);

  const handleChartClick = useCallback((param) => {
    const currentActiveTool = activeToolRef.current;

    if (!currentActiveTool || !param.point || !param.time || !seriesRef.current) {
      return;
    }

    const price = seriesRef.current.coordinateToPrice(param.point.y);
    if (price === null) {
      return;
    }

    const newPoint = { time: param.time, price, logical: param.logical };

    setTempDrawingPoints((previousPoints) => {
      const updatedPoints = [...previousPoints, newPoint];

      if (updatedPoints.length === 2 && currentActiveTool === "trendline") {
        setDrawingObjects((previousDrawings) => [
          ...previousDrawings,
          { id: Date.now(), type: currentActiveTool, points: [...updatedPoints] },
        ]);
        setActiveTool(null);
        return [];
      }

      return updatedPoints;
    });
  }, [seriesRef, setActiveTool]);

  useEffect(() => {
    drawingSeriesRefs.current.forEach((series) => {
      if (chartRef.current && series) {
        try {
          chartRef.current.removeSeries(series);
        } catch {}
      }
    });
    drawingSeriesRefs.current = [];

    drawingObjects.forEach((object) => {
      if (!chartRef.current) {
        return;
      }

      try {
        const newSeries = applyDrawingToChart(chartRef.current, object, currency);
        if (newSeries) {
          drawingSeriesRefs.current.push(newSeries);
        }
      } catch (error) {
        console.error("applyDrawingToChart error", error, object);
      }
    });
  }, [chartRef, currency, drawingObjects]);

  return {
    clearDrawingObjects,
    drawingObjects,
    drawingSeriesRefs,
    handleChartClick,
    hasDrawings: drawingObjects.length > 0 || tempDrawingPoints.length > 0,
    setDrawingObjects,
    tempDrawingPoints,
  };
}
