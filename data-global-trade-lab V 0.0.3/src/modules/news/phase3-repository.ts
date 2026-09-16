import { createHash } from "node:crypto";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { listNews } from "@/modules/news/repository";
import { getArticleSnapshot } from "@/modules/news/phase2-repository";

const missingSchemaCodes = new Set(["42P01", "PGRST205", "PGRST204", "42703"]);
const normalizeSymbol = (value: unknown) => String(value || "").trim().toUpperCase().replace("/", "");
const asPercent = (before: number | null, after: number | null) => before && after ? ((after - before) / before) * 100 : null;

const educationalFallback = (article: Record<string, unknown>, language: string) => {
  const title = String(article.title || "");
  const category = String(article.category || "markets");
  const assets = Array.isArray(article.assets) ? article.assets as Record<string, unknown>[] : [];
  const symbols = assets.map((asset) => normalizeSymbol(asset.symbol)).filter(Boolean);
  if (language === "en") {
    return {
      summary: String(article.summary || title),
      whyRelevant: `This ${category} event may help explain changes in expectations, liquidity, volatility, or risk perception around ${symbols.join(", ") || "related markets"}.`,
      concepts: [category, "risk management", "market expectations"],
      questions: ["What changed relative to prior expectations?", "Which risks could produce a different market response?"],
      disclaimer: "Educational context only. It is not a forecast or investment recommendation.",
    };
  }
  return {
    summary: String(article.summary || title),
    whyRelevant: `Este acontecimiento de ${category} puede ayudar a interpretar cambios en expectativas, liquidez, volatilidad o percepción de riesgo alrededor de ${symbols.join(", ") || "los mercados relacionados"}.`,
    concepts: [category, "gestión de riesgo", "expectativas de mercado"],
    questions: ["¿Qué cambió frente a las expectativas previas?", "¿Qué riesgos podrían producir una reacción diferente del mercado?"],
    disclaimer: "Contexto exclusivamente educativo. No es una predicción ni una recomendación de inversión.",
  };
};

async function generateWithOpenAI(article: Record<string, unknown>, language: string, userId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_NEWS_MODEL || "gpt-5";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 900,
      safety_identifier: createHash("sha256").update(userId).digest("hex").slice(0, 64),
      instructions: `Explain financial news for an educational trading simulator. Answer in ${language === "en" ? "English" : "Spanish"}. Never predict price direction, recommend a trade, or claim causality. Distinguish facts from possible market mechanisms.`,
      input: JSON.stringify({ title: article.title, summary: article.summary, category: article.category, topics: article.topics, assets: article.assets }),
      text: {
        format: {
          type: "json_schema",
          name: "gtl_news_explanation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "whyRelevant", "concepts", "questions", "disclaimer"],
            properties: {
              summary: { type: "string" },
              whyRelevant: { type: "string" },
              concepts: { type: "array", items: { type: "string" }, maxItems: 6 },
              questions: { type: "array", items: { type: "string" }, maxItems: 4 },
              disclaimer: { type: "string" },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI response ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  let outputText = typeof payload.output_text === "string" ? payload.output_text : "";
  if (!outputText && Array.isArray(payload.output)) {
    outputText = payload.output.flatMap((item) => {
      const content = (item as Record<string, unknown>).content;
      return Array.isArray(content) ? content.map((entry) => String((entry as Record<string, unknown>).text || "")) : [];
    }).join("");
  }
  if (!outputText) return null;
  return { explanation: JSON.parse(outputText), provider: "openai", model };
}

export async function getEducationalExplanation(userId: string, newsId: string, language = "es") {
  const snapshot = await getArticleSnapshot(newsId);
  if (!snapshot) return null;
  const idColumn = snapshot.databaseId ? "news_id" : "external_news_id";
  const cached = await supabaseAdmin
    .from("news_ai_explanations")
    .select("explanation,provider,model,created_at,expires_at")
    .eq("user_id", userId)
    .eq(idColumn, snapshot.databaseId || newsId)
    .eq("language", language)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cached.error && cached.data) return cached.data;
  if (cached.error && !missingSchemaCodes.has(cached.error.code || "")) throw cached.error;

  let generated: { explanation: Record<string, unknown>; provider: string; model: string | null };
  try {
    generated = await generateWithOpenAI(snapshot.article as Record<string, unknown>, language, userId)
      || { explanation: educationalFallback(snapshot.article as Record<string, unknown>, language), provider: "gtl-rules", model: null };
  } catch (error) {
    console.warn("news explanation provider fallback", error instanceof Error ? error.message : error);
    generated = { explanation: educationalFallback(snapshot.article as Record<string, unknown>, language), provider: "gtl-rules", model: null };
  }
  const insert = await supabaseAdmin.from("news_ai_explanations").insert({
    user_id: userId,
    news_id: snapshot.databaseId,
    external_news_id: snapshot.databaseId ? null : newsId,
    language,
    provider: generated.provider,
    model: generated.model,
    explanation: generated.explanation,
  });
  if (insert.error && !missingSchemaCodes.has(insert.error.code || "")) throw insert.error;
  return { ...generated, created_at: new Date().toISOString() };
}

async function getNearestStoredCandle(symbols: string[], target: number, direction: "before" | "after") {
  let query = supabaseAdmin
    .from("candles")
    .select("open_time,close_price,timeframe")
    .in("instrument_id", symbols)
    .in("timeframe", ["1m", "5m", "15m", "60m", "1h", "1d"])
    .order("open_time", { ascending: direction === "after" })
    .limit(20);
  query = direction === "before"
    ? query.lte("open_time", new Date(target).toISOString()).gte("open_time", new Date(target - 8 * 86_400_000).toISOString())
    : query.gte("open_time", new Date(target).toISOString()).lte("open_time", new Date(target + 8 * 86_400_000).toISOString());
  const result = await query;
  if (result.error) throw result.error;
  return (result.data?.[0] || null) as Record<string, unknown> | null;
}

export async function getHistoricalImpact(newsId: string, symbolInput: string) {
  const snapshot = await getArticleSnapshot(newsId);
  if (!snapshot) return null;
  const article = snapshot.article as Record<string, unknown>;
  const symbol = normalizeSymbol(symbolInput);
  const publishedAt = String(article.publishedAt || article.published_at || "");
  const published = Date.parse(publishedAt);
  if (!symbol || !Number.isFinite(published)) return null;
  const candidates = [symbol, symbol.endsWith("USD") ? `${symbol.slice(0, -3)}/USD` : symbol];
  const uniqueCandidates = [...new Set(candidates)];
  const [before, after1h, after24h, after7d] = await Promise.all([
    getNearestStoredCandle(uniqueCandidates, published, "before"),
    getNearestStoredCandle(uniqueCandidates, published + 3_600_000, "after"),
    getNearestStoredCandle(uniqueCandidates, published + 86_400_000, "after"),
    getNearestStoredCandle(uniqueCandidates, published + 7 * 86_400_000, "after"),
  ]);
  const beforePrice = before ? Number(before.close_price) : null;
  const impact = {
    newsId,
    symbol,
    publishedAt,
    beforePrice,
    after1hPrice: after1h ? Number(after1h.close_price) : null,
    after24hPrice: after24h ? Number(after24h.close_price) : null,
    after7dPrice: after7d ? Number(after7d.close_price) : null,
    sampleSize: [before, after1h, after24h, after7d].filter(Boolean).length,
    methodology: "nearest-stored-candle-v1",
  };
  const enriched = {
    ...impact,
    return1h: asPercent(impact.beforePrice, impact.after1hPrice),
    return24h: asPercent(impact.beforePrice, impact.after24hPrice),
    return7d: asPercent(impact.beforePrice, impact.after7dPrice),
  };
  const save = await supabaseAdmin.from("news_impact_snapshots").upsert({
    news_id: snapshot.databaseId,
    external_news_id: snapshot.databaseId ? null : newsId,
    symbol,
    published_at: publishedAt,
    timeframe: "mixed",
    before_price: enriched.beforePrice,
    after_1h_price: enriched.after1hPrice,
    after_24h_price: enriched.after24hPrice,
    after_7d_price: enriched.after7dPrice,
    return_1h: enriched.return1h,
    return_24h: enriched.return24h,
    return_7d: enriched.return7d,
    sample_size: enriched.sampleSize,
  }, { onConflict: "news_id,external_news_id,symbol,timeframe" });
  if (save.error && !missingSchemaCodes.has(save.error.code || "")) throw save.error;
  return enriched;
}

export async function getClassPortfolioNews(userId: string, roomId: string, includeWholeClass = false) {
  let positionsQuery = supabaseAdmin.from("positions").select("symbol").eq("room_id", roomId);
  let transactionsQuery = supabaseAdmin.from("transactions").select("symbol").eq("room_id", roomId).order("date", { ascending: false }).limit(100);
  if (!includeWholeClass) {
    positionsQuery = positionsQuery.eq("user_id", userId);
    transactionsQuery = transactionsQuery.eq("user_id", userId);
  }
  const [positions, transactions] = await Promise.all([
    positionsQuery,
    transactionsQuery,
  ]);
  if (positions.error) throw positions.error;
  if (transactions.error) throw transactions.error;
  const symbols = [...new Set([...(positions.data || []), ...(transactions.data || [])].map((row) => normalizeSymbol(row.symbol)).filter(Boolean))].slice(0, 30);
  const news = symbols.length ? await listNews({ limit: 30, symbols, sort: "latest" }) : { articles: [], source: "database" as const };
  return { symbols, articles: news.articles, source: news.source };
}

export async function getDailyDigest(userId: string, roomId: string, includeWholeClass = false) {
  const date = new Date().toISOString().slice(0, 10);
  const cached = await supabaseAdmin.from("user_news_daily_digests").select("content,generated_at").eq("user_id", userId).eq("room_id", roomId).eq("digest_date", date).maybeSingle();
  if (!cached.error && cached.data) return cached.data;
  if (cached.error && !missingSchemaCodes.has(cached.error.code || "")) throw cached.error;
  const portfolio = await getClassPortfolioNews(userId, roomId, includeWholeClass);
  const top = portfolio.articles.slice(0, 6);
  const content = {
    date,
    symbols: portfolio.symbols,
    headline: top[0]?.title || "",
    items: top.map((article) => ({ id: article.id, title: article.title, symbol: article.assets.find((asset) => portfolio.symbols.includes(asset.symbol))?.symbol || null, sentiment: article.sentiment?.label || "neutral" })),
    counts: { news: portfolio.articles.length, assets: portfolio.symbols.length },
  };
  const save = await supabaseAdmin.from("user_news_daily_digests").upsert({ user_id: userId, room_id: roomId, digest_date: date, symbols: portfolio.symbols, content, generated_at: new Date().toISOString() }, { onConflict: "user_id,room_id,digest_date" });
  if (save.error && !missingSchemaCodes.has(save.error.code || "")) throw save.error;
  return { content, generated_at: new Date().toISOString() };
}

export async function createLabEventFromNews(userId: string, roomId: string, newsId: string, input: Record<string, unknown>) {
  const snapshot = await getArticleSnapshot(newsId);
  if (!snapshot) return null;
  const article = snapshot.article as Record<string, unknown>;
  const assets = Array.isArray(article.assets) ? article.assets as Record<string, unknown>[] : [];
  const symbol = normalizeSymbol(input.symbol || assets[0]?.symbol);
  const impact = symbol ? await getHistoricalImpact(newsId, symbol) : null;
  const sentiment = (article.sentiment || {}) as Record<string, unknown>;
  const direction = sentiment.label === "positive" ? "positive" : sentiment.label === "negative" ? "negative" : "mixed";
  const observedReturn = impact?.return24h ?? impact?.return1h ?? Number(sentiment.score || 0) * 3;
  const impactPercent = Math.max(-0.2, Math.min(0.2, Number(observedReturn || 0) / 100));
  const result = await supabaseAdmin.from("lab_events").insert({
    created_by: userId,
    event_kind: impact?.sampleSize ? "historical" : "historical_inspired",
    name: String(input.name || article.title || "Evento basado en noticia").trim().slice(0, 140),
    description: String(input.description || article.summary || "").trim().slice(0, 3000),
    category: String(article.category || "market").slice(0, 80),
    difficulty: "intermediate",
    academic_objective: String(input.academicObjective || "Analizar mecanismos de transmisión, reacción del mercado y gestión de riesgo.").slice(0, 1000),
    activation_type: "temporal",
    default_period: Math.trunc(Math.max(0, Number(input.defaultPeriod || 10))),
    direction,
    impact_percent: impactPercent,
    volatility_multiplier: Math.min(4, Math.max(1, 1 + Math.abs(impactPercent) * 10)),
    duration_periods: Math.trunc(Math.min(20, Math.max(1, Number(input.durationPeriods || 3)))),
    headline: String(article.title || "Noticia histórica").slice(0, 220),
    message: String(article.summary || article.title || "").slice(0, 5000),
    simulated_source: "Referencia histórica GTL",
    status: "published",
    source_news_id: snapshot.databaseId,
    source_news_external_id: snapshot.databaseId ? null : newsId,
    source_news_snapshot: { ...article, historicalImpact: impact },
  }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}
