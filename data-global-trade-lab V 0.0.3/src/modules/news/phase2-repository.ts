import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { demoEconomicEvents, demoNews, EconomicEvent, NewsArticle } from "@/modules/news/demo-data";

const missingSchemaCodes = new Set(["42P01", "PGRST205", "PGRST204", "42703"]);
const normalizeSymbol = (value: unknown) => String(value || "").trim().toUpperCase().replace("/", "");

const isMissingSchema = (error: { code?: string } | null) => Boolean(error && missingSchemaCodes.has(error.code || ""));

export async function listEconomicEvents(filters: { from: string; to: string; region?: string | null; impact?: string | null }) {
  let query = supabaseAdmin
    .from("economic_events")
    .select("*")
    .gte("scheduled_at", filters.from)
    .lte("scheduled_at", filters.to)
    .order("scheduled_at", { ascending: true })
    .limit(200);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.impact) query = query.eq("impact", filters.impact);
  const result = await query;
  if (result.error) {
    if (!isMissingSchema(result.error)) throw result.error;
    return demoEconomicEvents.filter((event) => (!filters.region || event.region === filters.region) && (!filters.impact || event.impact === filters.impact));
  }
  if (!result.data?.length) return demoEconomicEvents.filter((event) => (!filters.region || event.region === filters.region) && (!filters.impact || event.impact === filters.impact));
  return result.data.map((row): EconomicEvent => ({
    id: row.id,
    title: row.title,
    description: row.description || "",
    country: row.country,
    region: row.region,
    currency: row.currency,
    category: row.category,
    impact: row.impact,
    scheduledAt: row.scheduled_at,
    previousValue: row.previous_value,
    forecastValue: row.forecast_value,
    actualValue: row.actual_value,
    status: row.status,
    sourceUrl: row.source_url,
    isDemo: false,
  }));
}

export async function listNewsAlerts(userId: string) {
  const result = await supabaseAdmin.from("user_news_alerts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (result.error) {
    if (isMissingSchema(result.error)) return [];
    throw result.error;
  }
  return result.data || [];
}

export async function createNewsAlert(userId: string, input: Record<string, unknown>) {
  const row = {
    user_id: userId,
    name: String(input.name || "").trim().slice(0, 120),
    symbols: Array.isArray(input.symbols) ? input.symbols.map(normalizeSymbol).filter(Boolean).slice(0, 30) : [],
    topics: Array.isArray(input.topics) ? input.topics.map((value) => String(value).trim().toLowerCase()).filter(Boolean).slice(0, 30) : [],
    categories: Array.isArray(input.categories) ? input.categories.map((value) => String(value).trim().toLowerCase()).filter(Boolean).slice(0, 10) : [],
    regions: Array.isArray(input.regions) ? input.regions.map((value) => String(value).trim().toLowerCase()).filter(Boolean).slice(0, 10) : [],
    min_importance: Math.min(100, Math.max(0, Number(input.minImportance || 0))),
    enabled: input.enabled !== false,
  };
  if (!row.name) throw new Error("El nombre de la alerta es obligatorio.");
  if (!row.symbols.length && !row.topics.length && !row.categories.length && !row.regions.length) throw new Error("Agrega al menos un activo, tema, categoría o región.");
  const result = await supabaseAdmin.from("user_news_alerts").insert(row).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function updateNewsAlert(userId: string, alertId: string, input: Record<string, unknown>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.enabled === "boolean") updates.enabled = input.enabled;
  if (typeof input.name === "string" && input.name.trim()) updates.name = input.name.trim().slice(0, 120);
  const result = await supabaseAdmin.from("user_news_alerts").update(updates).eq("id", alertId).eq("user_id", userId).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function deleteNewsAlert(userId: string, alertId: string) {
  const result = await supabaseAdmin.from("user_news_alerts").delete().eq("id", alertId).eq("user_id", userId);
  if (result.error) throw result.error;
  return { id: alertId };
}

export async function getUnreadNewsBySymbol(userId: string, symbols: string[]) {
  const normalized = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))].slice(0, 50);
  if (!normalized.length) return {};
  const assetsResult = await supabaseAdmin.from("news_assets").select("news_id,symbol").in("symbol", normalized);
  if (assetsResult.error) {
    if (isMissingSchema(assetsResult.error)) {
      return Object.fromEntries(normalized.map((symbol) => [symbol, demoNews.filter((article) => article.assets.some((asset) => asset.symbol === symbol)).length]));
    }
    throw assetsResult.error;
  }
  const ids = [...new Set((assetsResult.data || []).map((row) => row.news_id))];
  if (!ids.length) return {};
  const readResult = await supabaseAdmin.from("user_news_read").select("news_id").eq("user_id", userId).in("news_id", ids);
  if (readResult.error) throw readResult.error;
  const readIds = new Set((readResult.data || []).map((row) => row.news_id));
  return (assetsResult.data || []).reduce<Record<string, number>>((counts, row) => {
    if (!readIds.has(row.news_id)) counts[row.symbol] = (counts[row.symbol] || 0) + 1;
    return counts;
  }, {});
}

export async function getArticleSnapshot(newsId: string) {
  const demo = demoNews.find((article) => article.id === newsId);
  if (demo) return { article: demo, databaseId: null };
  const result = await supabaseAdmin
    .from("news_articles")
    .select("id,title,summary,source_name,source_url,published_at,category,country,assets:news_assets(symbol,asset_name,asset_type)")
    .eq("id", newsId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const row = result.data;
  const article = {
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    source: row.source_name,
    sourceUrl: row.source_url,
    publishedAt: row.published_at,
    category: row.category,
    country: row.country,
    assets: row.assets || [],
  };
  return { article, databaseId: row.id };
}

export async function shareNewsWithClass(userId: string, roomId: string, newsId: string, note: string) {
  const snapshot = await getArticleSnapshot(newsId);
  if (!snapshot) throw new Error("La noticia no existe.");
  const result = await supabaseAdmin.from("news_class_shares").insert({
    room_id: roomId,
    news_id: snapshot.databaseId,
    external_news_id: snapshot.databaseId ? null : newsId,
    shared_by: userId,
    note: note.trim().slice(0, 2000),
    news_snapshot: snapshot.article,
  }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function createActivityFromNews(userId: string, roomId: string, newsId: string, input: Record<string, unknown>) {
  const snapshot = await getArticleSnapshot(newsId);
  if (!snapshot) throw new Error("La noticia no existe.");
  const article = snapshot.article as Pick<NewsArticle, "title" | "summary" | "assets">;
  const prompt = String(input.prompt || "").trim().slice(0, 3000);
  const type = ["asset_analysis", "open_task", "graded_discussion"].includes(String(input.activityType)) ? input.activityType : "asset_analysis";
  const result = await supabaseAdmin.from("activities").insert({
    room_id: roomId,
    created_by: userId,
    title: String(input.title || `Análisis: ${article.title}`).trim().slice(0, 180),
    description: prompt || article.summary,
    activity_type: type,
    state: "published",
    is_gradable: Boolean(input.isGradable),
    max_score: input.isGradable ? Math.min(1000, Math.max(1, Number(input.maxScore || 100))) : null,
    close_at: input.closeAt ? new Date(String(input.closeAt)).toISOString() : null,
    referenced_asset_symbol: article.assets?.[0]?.symbol || null,
    source_news_id: snapshot.databaseId,
    source_news_external_id: snapshot.databaseId ? null : newsId,
    source_news_snapshot: snapshot.article,
  }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listClassNewsShares(roomId: string) {
  const result = await supabaseAdmin.from("news_class_shares").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50);
  if (result.error) {
    if (isMissingSchema(result.error)) return [];
    throw result.error;
  }
  return result.data || [];
}
