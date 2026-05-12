import { useCallback, useEffect, useRef, useState } from "react";
import { applyDrawingToChart } from "../utils";

export function useDrawings({ activeTool, chartRef, currency, setActiveTool }) {
  const [tempDrawingPoints, setTempDrawingPoints] = useState([]);
  const [drawingObjects, setDrawingObjects] = useState([]);
  const drawingSeriesRefs = useRef([]);

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

  const handleChartClick = useCallback(
    (param, seriesRef) => {
      if (!activeTool || !param.point || !param.time || !seriesRef.current) return;

      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price === null) return;

      const newPoint = { time: param.time, price, logical: param.logical };

      setTempDrawingPoints((previousPoints) => {
        const updatedPoints = [...previousPoints, newPoint];

        if (updatedPoints.length === 2 && activeTool === "trendline") {
          setDrawingObjects((previousDrawings) => [
            ...previousDrawings,
            { id: Date.now(), type: activeTool, points: [...updatedPoints] },
          ]);
          setActiveTool(null);
          return [];
        }

        return updatedPoints;
      });
    },
    [activeTool, setActiveTool]
  );

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
      if (!chartRef.current) return;
      const newSeries = applyDrawingToChart(chartRef.current, object, currency);
      if (newSeries) drawingSeriesRefs.current.push(newSeries);
    });
  }, [chartRef, currency, drawingObjects]);

  return {
    clearDrawingObjects,
    drawingObjects,
    handleChartClick,
    hasDrawings: drawingObjects.length > 0 || tempDrawingPoints.length > 0,
    tempDrawingPoints,
  };
}
