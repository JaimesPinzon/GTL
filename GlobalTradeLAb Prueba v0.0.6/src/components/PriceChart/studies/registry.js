import { buildEmaSeriesData, getEmaSeriesOptions } from "../Indicators/ema";
import {
  buildMacdSeriesData,
  getMacdHistogramSeriesOptions,
  getMacdLineSeriesOptions,
  getMacdSignalSeriesOptions,
} from "../Indicators/macd";

export const MAIN_PRICE_SERIES_ID = "main-price";
export const STUDY_PANES = {
  MAIN: "main",
  MACD: "macd",
};

const studyDefinitions = {
  ema: {
    id: "ema",
    name: "EMA",
    description: "Media movil exponencial",
    shortDescription: "EMA",
    isPriceStudy: true,
    paneId: STUDY_PANES.MAIN,
    priceScaleId: "right",
    sourceSeriesId: MAIN_PRICE_SERIES_ID,
    plots: [{ id: "ema-line", type: "line" }],
    createInputs: ({ emaPeriod, instance }) => ({
      length: instance?.parameters?.period ?? emaPeriod,
      source: "close",
    }),
    calculate: ({ inputs, processedData }) => ({
      "ema-line": buildEmaSeriesData({ emaPeriod: inputs.length, processedData }),
    }),
    createOutputOptions: ({ chartAppearance, instance }) => ({
      "ema-line": getEmaSeriesOptions(
        instance?.style?.color ?? chartAppearance?.lineColor,
        instance?.style?.lineWidth
      ),
    }),
  },
  macd: {
    id: "macd",
    name: "MACD",
    description: "Moving Average Convergence Divergence",
    shortDescription: "MACD",
    isPriceStudy: false,
    paneId: STUDY_PANES.MACD,
    priceScaleId: "macd-right",
    sourceSeriesId: MAIN_PRICE_SERIES_ID,
    plots: [
      { id: "macd-line", type: "line" },
      { id: "macd-signal", type: "line" },
      { id: "macd-histogram", type: "histogram" },
    ],
    createInputs: ({ instance }) => ({
      shortPeriod: instance?.parameters?.shortPeriod ?? 12,
      longPeriod: instance?.parameters?.longPeriod ?? 26,
      signalPeriod: instance?.parameters?.signalPeriod ?? 9,
      source: "close",
    }),
    calculate: ({ inputs, instance, processedData }) => {
      const result = buildMacdSeriesData(
        processedData,
        inputs.shortPeriod,
        inputs.longPeriod,
        inputs.signalPeriod,
        instance?.style
      );

      if (!result) {
        return {
          "macd-line": [],
          "macd-signal": [],
          "macd-histogram": [],
        };
      }

      return {
        "macd-line": result.macdLine,
        "macd-signal": result.signalLine,
        "macd-histogram": result.histogramData,
      };
    },
    createOutputOptions: ({ instance }) => ({
      "macd-line": getMacdLineSeriesOptions(instance?.style),
      "macd-signal": getMacdSignalSeriesOptions(instance?.style),
      "macd-histogram": getMacdHistogramSeriesOptions(),
    }),
  },
};

export function getActiveStudyDefinitions({ showEMA, showMACD }) {
  return [
    showEMA ? studyDefinitions.ema : null,
    showMACD ? studyDefinitions.macd : null,
  ].filter(Boolean);
}

export function buildStudyInstances({
  chartAppearance,
  definitions,
  emaPeriod,
  indicatorInstances,
  processedData,
  resolvedIndicatorData,
}) {
  return definitions.map((definition) => {
    const instance = indicatorInstances?.find((item) => item.id === definition.id);
    const inputs = definition.createInputs({ emaPeriod, instance });
    const calculatedOutputs = definition.calculate({ inputs, instance, processedData });
    const resolvedOutputs = resolvedIndicatorData?.[definition.id] ?? {};
    const outputOptions = definition.createOutputOptions({ chartAppearance, instance });
    const latestTime = processedData[processedData.length - 1]?.time;

    const resolveOutput = (plotId) => {
      const backendOutput = resolvedOutputs[plotId];
      const backendLatestTime = backendOutput?.[backendOutput.length - 1]?.time;
      const output = backendOutput?.length && backendLatestTime === latestTime
        ? backendOutput
        : calculatedOutputs[plotId] ?? [];

      if (definition.id === "macd" && plotId === "macd-histogram") {
        return output.map((entry) => ({
          ...entry,
          color: entry.value >= 0
            ? (instance?.style?.positiveColor ?? entry.color)
            : (instance?.style?.negativeColor ?? entry.color),
        }));
      }

      return output;
    };

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      shortDescription: definition.shortDescription,
      sourceSeriesId: definition.sourceSeriesId,
      inputs,
      paneId: definition.paneId,
      priceScaleId: definition.priceScaleId,
      isPriceStudy: definition.isPriceStudy,
      visible: true,
      plots: definition.plots.map((plot) => ({
        id: plot.id,
        type: plot.type,
        data: resolveOutput(plot.id),
        options: outputOptions[plot.id] ?? {},
      })),
      calculate: (bars) => definition.calculate({ inputs, instance, processedData: bars }),
    };
  });
}
