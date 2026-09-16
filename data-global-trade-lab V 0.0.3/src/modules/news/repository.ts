import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { demoNews, NewsArticle } from "@/modules/news/demo-data";
import { buildEventClusterId, classifyNewsSentiment } from "@/modules/news/analysis";

const missingSchemaCodes = new Set(["42P01", "PGRST205", "PGRST204"]);

type NewsQuery = {
  limit: number;
  cursor?: string | null;
  category?: string | null;
  region?: string | null;
  market?: string | null;
  symbol?: string | null;
  symbols?: string[];
  search?: string | null;
  sort?: "latest" | "trending";
  clustered?: boolean;
};

const normalizeSymbol = (value: unknown) => String(value || "").trim().toUpperCase().replace("/", "");

const mapRow = (row: Record<string, unknown>): NewsArticle => {
  const inferredSentiment = classifyNewsSentiment(String(row.title || ""), String(row.summary || ""));
  return ({
  id: String(row.id),
  title: String(row.title || ""),
  summary: String(row.summary || ""),
  bodyExcerpt: String(row.body_excerpt || ""),
  source: String(row.source_name || row.provider || ""),
  sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
  imageUrl: typeof row.image_url === "string" ? row.image_url : null,
  author: typeof row.author === "string" ? row.author : null,
  category: String(row.category || "markets"),
  region: String(row.region || "global"),
  country: typeof row.country === "string" ? row.country : null,
  publishedAt: String(row.published_at),
  updatedAt: String(row.updated_at || row.published_at),
  eventClusterId: typeof row.event_cluster_id === "string" ? row.event_cluster_id : buildEventClusterId(String(row.title || ""), String(row.published_at || "")),
  importanceScore: Number(row.importance_score || 0),
  isBreaking: Boolean(row.is_breaking),
  isDemo: Boolean(row.is_demo),
  sentiment: {
    label: (row.sentiment_updated_at ? row.sentiment_label : inferredSentiment.label) as NewsArticle["sentiment"]["label"],
    score: row.sentiment_updated_at ? (row.sentiment_score == null ? null : Number(row.sentiment_score)) : inferredSentiment.score,
  },
  assets: (Array.isArray(row.assets) ? row.assets : []).map((asset) => {
    const value = asset as Record<string, unknown>;
    return {
      symbol: normalizeSymbol(value.symbol),
      name: String(value.asset_name || value.symbol || ""),
      type: (value.asset_type || "stock") as NewsArticle["assets"][number]["type"],
      relationType: (value.relation_type || "related") as NewsArticle["assets"][number]["relationType"],
      change: null,
    };
  }),
  topics: (Array.isArray(row.topics) ? row.topics : []).map((topic) => String((topic as Record<string, unknown>).topic || "")).filter(Boolean),
  });
};

function filterDemo(query: NewsQuery) {
  const search = String(query.search || "").trim().toLocaleLowerCase("es");
  const wantedSymbols = new Set(
    [query.symbol, ...(query.symbols || [])].filter(Boolean).map(normalizeSymbol)
  );
  const filtered = demoNews.filter((article) => {
    if (query.category && article.category !== query.category) return false;
    if (query.region && article.region !== query.region) return false;
    if (query.market && !article.assets.some((asset) => asset.type === query.market)) return false;
    if (wantedSymbols.size && !article.assets.some((asset) => wantedSymbols.has(normalizeSymbol(asset.symbol)))) return false;
    if (search) {
      const haystack = [article.title, article.summary, article.source, article.country, ...article.topics, ...article.assets.flatMap((asset) => [asset.symbol, asset.name])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  const sorted = [...filtered]
    .sort((left, right) => query.sort === "trending"
      ? right.importanceScore - left.importanceScore
      : Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, query.limit);
  return query.clustered ? clusterArticles(sorted) : sorted;
}

function clusterArticles(articles: NewsArticle[]) {
  const grouped = new Map<string, NewsArticle>();
  const counts = new Map<string, number>();
  articles.forEach((article) => {
    const key = article.eventClusterId || article.id;
    counts.set(key, (counts.get(key) || 0) + 1);
    const current = grouped.get(key);
    if (!current || article.importanceScore > current.importanceScore) grouped.set(key, article);
  });
  return [...grouped.entries()].map(([key, article]) => ({ ...article, clusterSize: counts.get(key) || 1 }));
}

async function getNewsIdsForAssets(query: NewsQuery) {
  const wanted = [query.symbol, ...(query.symbols || [])].filter(Boolean).map(normalizeSymbol);
  if (!wanted.length && !query.market) return null;

  let assetsQuery = supabaseAdmin.from("news_assets").select("news_id").limit(1000);
  if (wanted.length) assetsQuery = assetsQuery.in("symbol", wanted);
  if (query.market) assetsQuery = assetsQuery.eq("asset_type", query.market);
  const result = await assetsQuery;
  if (result.error) return { error: result.error, ids: [] as string[] };
  return { error: null, ids: [...new Set((result.data || []).map((row) => row.news_id))] };
}

export async function listNews(query: NewsQuery) {
  const assetMatch = await getNewsIdsForAssets(query);
  if (assetMatch?.error && !missingSchemaCodes.has(assetMatch.error.code || "")) throw assetMatch.error;
  if (assetMatch?.error) return { articles: filterDemo(query), nextCursor: null, source: "demo" as const };
  if (assetMatch && assetMatch.ids.length === 0) return { articles: [], nextCursor: null, source: "database" as const };

  let builder = supabaseAdmin
    .from("news_articles")
    .select("*, assets:news_assets(symbol,asset_name,asset_type,relation_type,relevance_score), topics:news_topics(topic)")
    .limit(query.limit + 1);

  if (assetMatch) builder = builder.in("id", assetMatch.ids);
  if (query.category) builder = builder.eq("category", query.category);
  if (query.region) builder = builder.eq("region", query.region);
  if (query.search) builder = builder.textSearch("search_vector", query.search, { config: "spanish", type: "websearch" });
  if (query.cursor && query.sort !== "trending") builder = builder.lt("published_at", query.cursor);

  builder = query.sort === "trending"
    ? builder.order("importance_score", { ascending: false }).order("published_at", { ascending: false })
    : builder.order("published_at", { ascending: false }).order("id", { ascending: false });

  const result = await builder;
  if (result.error) {
    if (missingSchemaCodes.has(result.error.code || "")) return { articles: filterDemo(query), nextCursor: null, source: "demo" as const };
    throw result.error;
  }

  if (!result.data?.length) return { articles: filterDemo(query), nextCursor: null, source: "demo" as const };
  const hasMore = result.data.length > query.limit;
  const rows = result.data.slice(0, query.limit);
  const mapped = rows.map((row) => mapRow(row as Record<string, unknown>));
  return {
    articles: query.clustered ? clusterArticles(mapped) : mapped,
    nextCursor: hasMore ? String(rows.at(-1)?.published_at || "") : null,
    source: "database" as const,
  };
}

export async function getNewsArticle(id: string, userId: string) {
  if (id.startsWith("demo-")) {
    return demoNews.find((article) => article.id === id) || null;
  }

  const [articleResult, savedResult, readResult] = await Promise.all([
    supabaseAdmin.from("news_articles").select("*, assets:news_assets(symbol,asset_name,asset_type,relation_type,relevance_score), topics:news_topics(topic)").eq("id", id).maybeSingle(),
    supabaseAdmin.from("user_saved_news").select("news_id").eq("user_id", userId).eq("news_id", id).maybeSingle(),
    supabaseAdmin.from("user_news_read").select("news_id").eq("user_id", userId).eq("news_id", id).maybeSingle(),
  ]);
  if (articleResult.error) {
    if (missingSchemaCodes.has(articleResult.error.code || "")) return null;
    throw articleResult.error;
  }
  if (!articleResult.data) return null;
  return { ...mapRow(articleResult.data as Record<string, unknown>), saved: Boolean(savedResult.data), read: Boolean(readResult.data) };
}

export async function listSavedNews(userId: string) {
  const result = await supabaseAdmin
    .from("user_saved_news")
    .select("created_at, article:news_articles(*, assets:news_assets(symbol,asset_name,asset_type,relation_type,relevance_score), topics:news_topics(topic))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (result.error) {
    if (missingSchemaCodes.has(result.error.code || "")) return [];
    throw result.error;
  }
  return (result.data || []).map((row) => mapRow(row.article as unknown as Record<string, unknown>));
}

export async function setSavedNews(userId: string, newsId: string, saved: boolean) {
  if (newsId.startsWith("demo-")) return { saved, localOnly: true };
  const result = saved
    ? await supabaseAdmin.from("user_saved_news").upsert({ user_id: userId, news_id: newsId }, { onConflict: "user_id,news_id" })
    : await supabaseAdmin.from("user_saved_news").delete().eq("user_id", userId).eq("news_id", newsId);
  if (result.error) throw result.error;
  return { saved, localOnly: false };
}

export async function markNewsRead(userId: string, newsId: string) {
  if (newsId.startsWith("demo-")) return { read: true, localOnly: true };
  const result = await supabaseAdmin.from("user_news_read").upsert(
    { user_id: userId, news_id: newsId, read_at: new Date().toISOString() },
    { onConflict: "user_id,news_id" }
  );
  if (result.error) throw result.error;
  return { read: true, localOnly: false };
}
