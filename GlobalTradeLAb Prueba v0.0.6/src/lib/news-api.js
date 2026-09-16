import { fetchWithAuth } from "@/lib/auth-api";

const NEWS_CACHE_KEY = "gtl.news.cache.v1";

const readCache = () => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(NEWS_CACHE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeCache = (articles) => {
  if (typeof window === "undefined" || !Array.isArray(articles) || !articles.length) return;
  try {
    const merged = [...articles, ...readCache()].filter(
      (article, index, collection) => collection.findIndex((entry) => entry.id === article.id) === index
    ).slice(0, 100);
    window.localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(merged));
  } catch {
    // A full or disabled cache must not make News unusable.
  }
};

export const getCachedNews = () => readCache();

export const fetchNews = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  const payload = await fetchWithAuth(`/api/news?${params.toString()}`, { method: "GET", credentials: "omit" });
  writeCache(payload.articles);
  return payload;
};

export const fetchNewsArticle = async (newsId) => {
  const payload = await fetchWithAuth(`/api/news/${encodeURIComponent(newsId)}`, { method: "GET", credentials: "omit" });
  writeCache(payload.article ? [payload.article] : []);
  return payload.article;
};

export const fetchSavedNews = async () => {
  const payload = await fetchWithAuth("/api/news/saved", { method: "GET", credentials: "omit" });
  writeCache(payload.articles);
  return payload.articles || [];
};

export const updateSavedNews = (newsId, saved) => fetchWithAuth("/api/news/saved", {
  method: "POST",
  credentials: "omit",
  body: { newsId, saved },
});

export const fetchEconomicCalendar = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
  const payload = await fetchWithAuth(`/api/news/calendar?${params.toString()}`, { method: "GET", credentials: "omit" });
  return payload.events || [];
};

export const fetchNewsAlerts = async () => {
  const payload = await fetchWithAuth("/api/news/alerts", { method: "GET", credentials: "omit" });
  return payload.alerts || [];
};

export const createNewsAlert = (input) => fetchWithAuth("/api/news/alerts", { method: "POST", credentials: "omit", body: input });
export const updateNewsAlert = (alertId, updates) => fetchWithAuth("/api/news/alerts", { method: "PATCH", credentials: "omit", body: { alertId, ...updates } });
export const deleteNewsAlert = (alertId) => fetchWithAuth(`/api/news/alerts?alertId=${encodeURIComponent(alertId)}`, { method: "DELETE", credentials: "omit" });

export const fetchUnreadNewsCounts = async (symbols) => {
  if (!symbols?.length) return {};
  const payload = await fetchWithAuth(`/api/news/unread?symbols=${encodeURIComponent(symbols.join(","))}`, { method: "GET", credentials: "omit" });
  return payload.counts || {};
};

export const performNewsClassAction = (input) => fetchWithAuth("/api/news/class-actions", { method: "POST", credentials: "omit", body: input });

export const fetchClassNewsShares = async (roomId) => {
  const payload = await fetchWithAuth(`/api/news/class-actions?roomId=${encodeURIComponent(roomId)}`, { method: "GET", credentials: "omit" });
  return payload.shares || [];
};

export const fetchNewsImpact = async (newsId, symbol) => {
  const params = new URLSearchParams({ mode: "impact", newsId, symbol });
  const payload = await fetchWithAuth(`/api/news/insights?${params}`, { method: "GET", credentials: "omit" });
  return payload.impact;
};

export const fetchClassPortfolioNews = async (roomId) => {
  const params = new URLSearchParams({ mode: "portfolio", roomId });
  const payload = await fetchWithAuth(`/api/news/insights?${params}`, { method: "GET", credentials: "omit" });
  return payload.data;
};

export const fetchDailyNewsDigest = async (roomId) => {
  const params = new URLSearchParams({ mode: "daily", roomId });
  const payload = await fetchWithAuth(`/api/news/insights?${params}`, { method: "GET", credentials: "omit" });
  return payload.data;
};

export const explainNews = (newsId, language) => fetchWithAuth("/api/news/insights", {
  method: "POST",
  credentials: "omit",
  body: { action: "explain", newsId, language },
});

export const createLabEventFromNews = (input) => fetchWithAuth("/api/news/insights", {
  method: "POST",
  credentials: "omit",
  body: { action: "create_lab_event", ...input },
});
