export type SyntheticAsset = {
  id: string;
  initial_price: number | string;
};

export type SyntheticMarket = {
  start_at: string;
  timeframe_minutes: number;
  duration_periods: number;
  expected_return: number | string;
  volatility: number | string;
  average_volume: number | string;
  jump_probability: number | string;
  jump_magnitude: number | string;
  mean_reversion: number | string;
  max_period_change: number | string;
  trend: string;
};

export type ScenarioEvent = {
  activation_period: number;
  impact_override?: number | string | null;
  event?: {
    impact_percent?: number | string;
    volatility_multiplier?: number | string;
    duration_periods?: number;
  } | null;
};

export type GeneratedTick = {
  session_id: string;
  asset_id: string;
  period: number;
  tick_at: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
};

const numberOf = (value: number | string | null | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const seededRandom = (seed: number, channel: string, period: number, draw: number) => {
  let state = (seed >>> 0) ^ hashText(channel) ^ Math.imul(period + 1, 0x9e3779b1) ^ Math.imul(draw + 7, 0x85ebca6b);
  state ^= state >>> 16;
  state = Math.imul(state, 0x7feb352d);
  state ^= state >>> 15;
  state = Math.imul(state, 0x846ca68b);
  state ^= state >>> 16;
  return (state >>> 0) / 4294967296;
};

const gaussian = (seed: number, channel: string, period: number) => {
  const first = Math.max(seededRandom(seed, channel, period, 0), 1e-12);
  const second = seededRandom(seed, channel, period, 1);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
};

const round = (value: number, decimals = 6) => Number(value.toFixed(decimals));

const eventEffectAtPeriod = (events: ScenarioEvent[], period: number) =>
  events.reduce(
    (effect, item) => {
      const duration = Math.max(1, Number(item.event?.duration_periods || 1));
      const age = period - Number(item.activation_period || 0);
      if (age < 0 || age >= duration) return effect;
      const decay = 1 - age / duration;
      return {
        impact:
          effect.impact +
          numberOf(item.impact_override, numberOf(item.event?.impact_percent)) * decay,
        volatility: Math.max(
          effect.volatility,
          1 + (numberOf(item.event?.volatility_multiplier, 1) - 1) * decay
        ),
      };
    },
    { impact: 0, volatility: 1 }
  );

export function generateSyntheticTicks({
  sessionId,
  seed,
  market,
  assets,
  events,
}: {
  sessionId: string;
  seed: number;
  market: SyntheticMarket;
  assets: SyntheticAsset[];
  events: ScenarioEvent[];
}): GeneratedTick[] {
  const ticks: GeneratedTick[] = [];
  const start = new Date(market.start_at).getTime();
  const intervalMs = Number(market.timeframe_minutes) * 60_000;
  const volatility = numberOf(market.volatility, 0.012);
  const configuredReturn = numberOf(market.expected_return);
  const trendBias = market.trend === "bullish" ? volatility * 0.12 : market.trend === "bearish" ? -volatility * 0.12 : 0;
  const drift = configuredReturn + trendBias;
  const maxChange = Math.max(0.0001, numberOf(market.max_period_change, 0.2));
  const meanReversion = numberOf(market.mean_reversion);
  const jumpProbability = numberOf(market.jump_probability);
  const jumpMagnitude = numberOf(market.jump_magnitude);
  const averageVolume = numberOf(market.average_volume, 100000);

  assets.forEach((asset) => {
    const initialPrice = numberOf(asset.initial_price, 100);
    let previousClose = initialPrice;

    for (let period = 0; period < Number(market.duration_periods); period += 1) {
      const effect = eventEffectAtPeriod(events, period);
      const shock = gaussian(seed, asset.id, period) * volatility * effect.volatility;
      const jump =
        seededRandom(seed, asset.id, period, 2) < jumpProbability
          ? (seededRandom(seed, asset.id, period, 3) < 0.5 ? -1 : 1) * jumpMagnitude
          : 0;
      const reversion = meanReversion * ((initialPrice - previousClose) / initialPrice);
      const rawReturn = drift + shock + jump + effect.impact + reversion;
      const periodReturn = Math.max(-maxChange, Math.min(maxChange, rawReturn));
      const open = previousClose;
      const close = Math.max(0.000001, open * (1 + periodReturn));
      const wick = Math.abs(gaussian(seed + 31, asset.id, period)) * volatility * effect.volatility * 0.45;
      const high = Math.max(open, close) * (1 + wick);
      const low = Math.max(0.000001, Math.min(open, close) * (1 - wick));
      const volumeFactor = 0.65 + seededRandom(seed, asset.id, period, 5) * 0.7 + Math.abs(periodReturn) * 5;

      ticks.push({
        session_id: sessionId,
        asset_id: asset.id,
        period,
        tick_at: new Date(start + intervalMs * period).toISOString(),
        open_price: round(open),
        high_price: round(high),
        low_price: round(low),
        close_price: round(close),
        volume: round(averageVolume * volumeFactor, 2),
      });
      previousClose = close;
    }
  });

  return ticks;
}

