const STOP_WORDS = new Set(["para", "como", "ante", "sobre", "entre", "desde", "with", "from", "that", "this"]);

const normalizeWords = (value: string) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .split(/\s+/)
  .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

export function buildEventClusterId(title: string, publishedAt: string) {
  const day = new Date(publishedAt).toISOString().slice(0, 10).replaceAll("-", "");
  const keywords = [...new Set(normalizeWords(title))].slice(0, 5).join("-") || "market-event";
  return `${day}-${keywords}`.slice(0, 120);
}

const POSITIVE_TERMS = new Set(["sube", "crece", "mejora", "expansion", "ganancia", "record", "beats", "growth", "rises"]);
const NEGATIVE_TERMS = new Set(["cae", "baja", "riesgo", "perdida", "crisis", "desempleo", "falls", "decline", "loss"]);

export function classifyNewsSentiment(title: string, summary = "") {
  const words = normalizeWords(`${title} ${summary}`);
  const positive = words.filter((word) => POSITIVE_TERMS.has(word)).length;
  const negative = words.filter((word) => NEGATIVE_TERMS.has(word)).length;
  const total = positive + negative;
  if (!total) return { label: "neutral" as const, score: 0 };
  const score = (positive - negative) / total;
  if (positive && negative) return { label: "mixed" as const, score };
  return score > 0 ? { label: "positive" as const, score } : { label: "negative" as const, score };
}
