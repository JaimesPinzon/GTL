const toEpochSeconds = (value) => {
  if (typeof value === "number") return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
};

const markerColor = (sentiment) => ({
  positive: "#38bdf8",
  negative: "#a78bfa",
  mixed: "#fbbf24",
  neutral: "#94a3b8",
}[sentiment] || "#94a3b8");

export const buildNewsChartMarkers = (articles = [], candles = [], selectedNewsId = null) => {
  const times = candles.map((candle) => toEpochSeconds(candle.time)).filter(Number.isFinite).sort((left, right) => left - right);
  if (!times.length) return [];
  const first = times[0];
  const last = times[times.length - 1];

  return articles.map((article) => {
    const published = toEpochSeconds(article.publishedAt);
    if (!Number.isFinite(published) || published < first || published > last) return null;
    let nearest = times[0];
    for (const time of times) {
      if (Math.abs(time - published) < Math.abs(nearest - published)) nearest = time;
      if (time > published) break;
    }
    const selected = article.id === selectedNewsId;
    return {
      time: nearest,
      position: "aboveBar",
      color: selected ? "#22d3ee" : markerColor(article.sentiment?.label),
      shape: selected ? "arrowDown" : "circle",
      text: selected ? "NEWS" : "N",
      size: selected ? 2 : 1,
      id: article.id,
      title: article.title,
    };
  }).filter(Boolean).sort((left, right) => left.time - right.time);
};

