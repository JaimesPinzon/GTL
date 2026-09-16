import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { fetchSavedNews, getCachedNews, updateSavedNews } from "@/lib/news-api";

const SAVED_STORAGE_KEY = "gtl.news.saved.v1";
const READ_STORAGE_KEY = "gtl.news.read.v1";
const NewsContext = createContext(null);

const readLocalSaved = () => {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const useNewsContext = () => useContext(NewsContext);

export const NewsProvider = ({ children }) => {
  const [savedIds, setSavedIds] = useState(() => new Set(readLocalSaved()));
  const [savedArticles, setSavedArticles] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(window.localStorage.getItem(READ_STORAGE_KEY) || "[]")); } catch { return new Set(); }
  });

  useEffect(() => {
    let mounted = true;
    fetchSavedNews()
      .then((articles) => {
        if (!mounted) return;
        setSavedArticles(articles);
        setSavedIds((current) => new Set([...current, ...articles.map((article) => article.id)]));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify([...savedIds]));
    }
  }, [savedIds]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...readIds]));
  }, [readIds]);

  const markRead = useCallback((newsId) => {
    if (!newsId) return;
    setReadIds((current) => new Set([...current, newsId]));
  }, []);

  const toggleSaved = useCallback(async (article) => {
    const willSave = !savedIds.has(article.id);
    setSavedIds((current) => {
      const next = new Set(current);
      if (willSave) next.add(article.id);
      else next.delete(article.id);
      return next;
    });
    setSavedArticles((current) => willSave
      ? [article, ...current.filter((item) => item.id !== article.id)]
      : current.filter((item) => item.id !== article.id));
    try {
      await updateSavedNews(article.id, willSave);
    } catch (error) {
      if (!article.id.startsWith("demo-")) {
        setSavedIds((current) => {
          const next = new Set(current);
          if (willSave) next.delete(article.id);
          else next.add(article.id);
          return next;
        });
        throw error;
      }
    }
    return willSave;
  }, [savedIds]);

  const allSavedArticles = useMemo(() => {
    const cached = getCachedNews().filter((article) => savedIds.has(article.id));
    return [...savedArticles, ...cached].filter(
      (article, index, collection) => collection.findIndex((entry) => entry.id === article.id) === index
    );
  }, [savedArticles, savedIds]);

  const value = useMemo(() => ({
    allSavedArticles,
    isSaved: (newsId) => savedIds.has(newsId),
    isRead: (newsId) => readIds.has(newsId),
    markRead,
    readIds,
    savedIds,
    toggleSaved,
  }), [allSavedArticles, markRead, readIds, savedIds, toggleSaved]);

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
};
