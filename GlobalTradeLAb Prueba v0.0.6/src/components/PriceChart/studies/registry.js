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
    createInputs: ({ emaPeriod }) => ({
      length: emaPeriod,
      source: "close",
    }),
    calculate: ({ emaPeriod, processedData }) => ({
      "ema-line": buildEmaSeriesData({ emaPeriod, processedData }),
    }),
    createOutputOptions: ({ chartAppearance }) => ({
      "ema-line": getEmaSeriesOptions(chartAppearance?.lineColor),
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
    createInputs: () => ({
      shortPeriod: 12,
      longPeriod: 26,
      signalPeriod: 9,
      source: "close",
    }),
    calculate: ({ processedData }) => {
      const result = buildMacdSeriesData(processedData);

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
    createOutputOptions: () => ({
      "macd-line": getMacdLineSeriesOptions(),
      "macd-signal": getMacdSignalSeriesOptions(),
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
  processedData,
  resolvedIndicatorData,
}) {
  return definitions.map((definition) => {
    const inputs = definition.createInputs({ emaPeriod });
    const calculatedOutputs = definition.calculate({ emaPeriod, processedData });
    const resolvedOutputs = resolvedIndicatorData?.[definition.id] ?? {};
    const outputOptions = definition.createOutputOptions({ chartAppearance });

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
        data: resolvedOutputs[plot.id] ?? calculatedOutputs[plot.id] ?? [],
        options: outputOptions[plot.id] ?? {},
      })),
      calculate: (bars) => definition.calculate({ emaPeriod, processedData: bars }),
    };
  });
}
