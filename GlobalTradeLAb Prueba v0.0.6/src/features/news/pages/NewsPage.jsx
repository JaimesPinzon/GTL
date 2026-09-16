import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, ChevronDown, Filter } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import {
  AssetPill,
  AssetUnavailableModal,
  ClassSelectorModal,
  DataStatusBanner,
  EconomicCalendar,
  FeaturedNews,
  NewsCard,
  NewsHeader,
  NewsAlertsModal,
  NewsSkeleton,
  NewsState,
  SideContextPanel,
  TrendingPanel,
  UpcomingPanel,
} from "@/features/news/components/NewsUi";
import { useNewsContext } from "@/features/news/context/NewsContext";
import {
  createNewsAlert,
  deleteNewsAlert,
  fetchEconomicCalendar,
  fetchNews,
  fetchNewsAlerts,
  fetchUnreadNewsCounts,
  getCachedNews,
  updateNewsAlert,
} from "@/lib/news-api";
import { ENABLED_MARKET_ASSETS } from "@/lib/market-assets";
import { GLOBAL_APP_PATHS } from "@/lib/routes";

const MARKET_FILTERS = ["all", "stock", "etf", "crypto", "forex", "commodities", "bonds"];
const REGION_FILTERS = ["all", "global", "north-america", "latin-america", "europe", "asia"];

const matchesClientFilters = (article, { search, symbol, market, region }) => {
  if (symbol && !article.assets?.some((asset) => asset.symbol === symbol)) return false;
  if (market && market !== "all" && !article.assets?.some((asset) => asset.type === market)) return false;
  if (region && region !== "all" && article.region !== region) return false;
  if (search) {
    const normalized = search.toLocaleLowerCase("es");
    const haystack = [article.title, article.summary, article.source, article.country, ...(article.topics || []), ...(article.assets || []).flatMap((asset) => [asset.symbol, asset.name])].filter(Boolean).join(" ").toLocaleLowerCase("es");
    if (!haystack.includes(normalized)) return false;
  }
  return true;
};

const NewsPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { symbol: routeSymbol } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { positions = [] } = useTradingContext();
  const {
    accessibleClasses = [],
    activeClass,
    activeClassId,
    openAssetInClass,
    selectActiveClass,
  } = useClassContext() || {};
  const { allSavedArticles, isRead, isSaved, toggleSaved } = useNewsContext();

  const activeTab = routeSymbol ? "latest" : searchParams.get("tab") || "home";
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [submittedQuery, setSubmittedQuery] = useState(searchParams.get("q") || "");
  const [market, setMarket] = useState(searchParams.get("market") || "all");
  const [region, setRegion] = useState(searchParams.get("region") || "all");
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState("loading");
  const [source, setSource] = useState("database");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [classSelectorOpen, setClassSelectorOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarRegion, setCalendarRegion] = useState("");
  const [calendarImpact, setCalendarImpact] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [alertForm, setAlertForm] = useState({ name: "", symbols: "", topics: "", minImportance: "50" });
  const [unreadCounts, setUnreadCounts] = useState({});
  const personalSymbols = useMemo(() => [...new Set(positions.map((position) => String(position.symbol || "").toUpperCase()).filter(Boolean))], [positions]);

  const loadNews = useCallback(async () => {
    if (activeTab === "calendar") {
      setStatus("ready");
      return;
    }
    if (activeTab === "saved") {
      setArticles(allSavedArticles);
      setStatus("ready");
      setIsStale(false);
      return;
    }
    if (activeTab === "mine" && !activeClassId) {
      setArticles([]);
      setStatus("ready");
      return;
    }
    if (activeTab === "mine" && personalSymbols.length === 0) {
      setArticles([]);
      setStatus("ready");
      return;
    }

    setStatus("loading");
    const filters = {
      limit: activeTab === "latest" ? 40 : 24,
      sort: activeTab === "home" ? "trending" : "latest",
      search: submittedQuery || undefined,
      symbol: routeSymbol?.toUpperCase() || undefined,
      symbols: activeTab === "mine" ? personalSymbols : undefined,
      category: activeTab === "economy" ? "economy" : undefined,
      market: activeTab === "markets" && market !== "all" ? market : undefined,
      region: region !== "all" ? region : undefined,
      clustered: activeTab === "home",
    };
    try {
      const result = await fetchNews(filters);
      setArticles(result.articles || []);
      setSource(result.source || "database");
      setFetchedAt(result.fetchedAt || new Date().toISOString());
      setIsStale(false);
      setStatus("ready");
    } catch (error) {
      const cached = getCachedNews().filter((article) => matchesClientFilters(article, {
        search: submittedQuery,
        symbol: routeSymbol?.toUpperCase(),
        market: activeTab === "markets" ? market : null,
        region,
      }));
      if (cached.length) {
        setArticles(cached);
        setSource("cache");
        setIsStale(true);
        setStatus("ready");
      } else {
        setArticles([]);
        setStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error");
      }
    }
  }, [activeClassId, activeTab, allSavedArticles, market, personalSymbols, region, routeSymbol, submittedQuery]);

  useEffect(() => { void loadNews(); }, [loadNews]);

  useEffect(() => {
    fetchNewsAlerts().then(setAlerts).catch(() => setAlerts([]));
  }, []);

  useEffect(() => {
    if (!personalSymbols.length) {
      setUnreadCounts({});
      return;
    }
    fetchUnreadNewsCounts(personalSymbols).then(setUnreadCounts).catch(() => setUnreadCounts({}));
  }, [personalSymbols]);

  useEffect(() => {
    if (activeTab !== "calendar") return;
    let mounted = true;
    setCalendarLoading(true);
    fetchEconomicCalendar({ region: calendarRegion, impact: calendarImpact })
      .then((events) => { if (mounted) setCalendarEvents(events); })
      .catch(() => { if (mounted) setCalendarEvents([]); })
      .finally(() => { if (mounted) setCalendarLoading(false); });
    return () => { mounted = false; };
  }, [activeTab, calendarImpact, calendarRegion]);

  const handleCreateAlert = async (event) => {
    event.preventDefault();
    setAlertsSaving(true);
    try {
      const response = await createNewsAlert({
        name: alertForm.name.trim(),
        symbols: alertForm.symbols.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean),
        topics: alertForm.topics.split(",").map((value) => value.trim()).filter(Boolean),
        minImportance: Number(alertForm.minImportance),
      });
      setAlerts((current) => [response.alert, ...current]);
      setAlertForm({ name: "", symbols: "", topics: "", minImportance: "50" });
      toast({ title: t("news.alerts.created") });
    } catch (error) {
      toast({ variant: "destructive", title: t("news.alerts.error"), description: error.message });
    } finally {
      setAlertsSaving(false);
    }
  };

  const handleToggleAlert = async (alertId, enabled) => {
    try {
      const response = await updateNewsAlert(alertId, { enabled });
      setAlerts((current) => current.map((alert) => alert.id === alertId ? response.alert : alert));
    } catch (error) {
      toast({ variant: "destructive", title: t("news.alerts.error"), description: error.message });
    }
  };

  const handleDeleteAlert = async (alertId) => {
    try {
      await deleteNewsAlert(alertId);
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
    } catch (error) {
      toast({ variant: "destructive", title: t("news.alerts.error"), description: error.message });
    }
  };

  const handleTabChange = (tab) => {
    const next = new URLSearchParams();
    if (tab !== "home") next.set("tab", tab);
    if (submittedQuery) next.set("q", submittedQuery);
    navigate(`${GLOBAL_APP_PATHS.news}${next.toString() ? `?${next}` : ""}`);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    setSubmittedQuery(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value); else next.delete("q");
    if (activeTab === "home" && value) next.set("tab", "latest");
    setSearchParams(next);
  };

  const handleOpenMarket = async (symbol, article = null, classId = null) => {
    const result = await openAssetInClass?.(symbol, {
      classId,
      newsId: article?.id,
      returnTo: `${location.pathname}${location.search}`,
    });
    if (!result || result.reason === "class-required") {
      setPendingAsset({ symbol, article });
      setClassSelectorOpen(true);
      return;
    }
    if (!result.available) {
      setUnavailable({ symbol, className: result.targetClass?.name || activeClass?.name || "" });
    }
  };

  const handleClassSelect = async (classId) => {
    if (pendingAsset) {
      setClassSelectorOpen(false);
      const asset = pendingAsset;
      setPendingAsset(null);
      await handleOpenMarket(asset.symbol, asset.article, classId);
      return;
    }
    await selectActiveClass?.(classId);
    setClassSelectorOpen(false);
  };

  const changeMarket = (value) => {
    setMarket(value);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("market"); else next.set("market", value);
    setSearchParams(next);
  };

  const changeRegion = (value) => {
    setRegion(value);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("region"); else next.set("region", value);
    setSearchParams(next);
  };

  const featured = articles[0] || null;
  const feed = featured && activeTab === "home" ? articles.slice(1) : articles;
  const trending = [...articles].sort((left, right) => Number(right.importanceScore || 0) - Number(left.importanceScore || 0));
  const assetMatches = submittedQuery
    ? ENABLED_MARKET_ASSETS.filter((asset) => `${asset.id} ${t(asset.nameKey)}`.toLowerCase().includes(submittedQuery.toLowerCase())).slice(0, 5)
    : [];

  const renderFeed = (dense = false) => {
    if (status === "loading") return <NewsSkeleton />;
    if (status === "error" || status === "offline") return <NewsState kind={status} onRetry={loadNews} />;
    if (!feed.length) return <NewsState kind="empty" onReset={() => { setSubmittedQuery(""); setQuery(""); changeMarket("all"); changeRegion("all"); }} />;
    return <div>{feed.map((article) => <NewsCard key={article.id} article={article} dense={dense} isSaved={isSaved(article.id)} isRead={isRead(article.id)} onToggleSaved={toggleSaved} onOpenMarket={handleOpenMarket} />)}</div>;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top_right,hsla(var(--primary)/.08),transparent_32%)]">
      <NewsHeader activeTab={activeTab} activeClass={activeClass} query={query} onQueryChange={setQuery} onSubmit={handleSearch} onTabChange={handleTabChange} onClassClick={() => { setPendingAsset(null); setClassSelectorOpen(true); }} onAlertsClick={() => setAlertsOpen(true)} alertsCount={alerts.filter((alert) => alert.enabled).length} />
      <div className="scrollbar-dashboard min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-7 md:py-8">
          <DataStatusBanner source={source} isStale={isStale} fetchedAt={fetchedAt} />

          {routeSymbol ? (
            <div className="mb-7 flex flex-col justify-between gap-4 rounded-[22px] border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.symbol.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{routeSymbol.toUpperCase()}</h2><p className="mt-1 text-sm text-muted-foreground">{t("news.symbol.description", { symbol: routeSymbol.toUpperCase() })}</p></div>
              <Button className="gap-2" onClick={() => handleOpenMarket(routeSymbol.toUpperCase())}><BarChart3 className="h-4 w-4" />{t("news.actions.viewInMarket")}</Button>
            </div>
          ) : null}

          {submittedQuery && assetMatches.length ? (
            <section className="mb-7 rounded-[22px] border border-border/60 bg-card/35 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("news.searchAssets")}</p>
              <div className="flex flex-wrap gap-2">{assetMatches.map((asset) => <AssetPill key={asset.id} asset={{ symbol: asset.id, name: t(asset.nameKey), change: null }} showChange={false} onOpenMarket={(symbol) => handleOpenMarket(symbol)} />)}</div>
            </section>
          ) : null}

          {activeTab === "home" && status !== "loading" && featured ? (
            <>
              <FeaturedNews article={featured} isSaved={isSaved(featured.id)} isRead={isRead(featured.id)} onToggleSaved={toggleSaved} onOpenMarket={handleOpenMarket} />
              <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">
                  <div className="flex items-center justify-between border-b border-border/50 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.latest.eyebrow")}</p><h2 className="mt-1 text-xl font-bold">{t("news.latest.title")}</h2></div><Button variant="ghost" className="gap-2" onClick={() => handleTabChange("latest")}>{t("news.actions.viewAll")}<ArrowRight className="h-4 w-4" /></Button></div>
                  {renderFeed(false)}
                </section>
                <div className="space-y-6"><TrendingPanel articles={trending} /><SideContextPanel activeClass={activeClass} personalCount={personalSymbols.length} onViewMine={() => handleTabChange("mine")} /><UpcomingPanel /></div>
              </div>
            </>
          ) : null}

          {activeTab === "home" && (status === "loading" || !featured) ? renderFeed(false) : null}

          {activeTab === "latest" ? (
            <section>
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.latest.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{routeSymbol ? t("news.symbol.latest", { symbol: routeSymbol.toUpperCase() }) : t("news.latest.title")}</h2></div><FilterSelect value={region} options={REGION_FILTERS} label={t("news.filters.region")} onChange={changeRegion} translationPrefix="news.regions" /></div>
              <div className="rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">{renderFeed(true)}</div>
            </section>
          ) : null}

          {activeTab === "markets" ? (
            <section>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.markets.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{t("news.markets.title")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("news.markets.description")}</p></div>
              <div className="mb-6 flex flex-wrap gap-2">{MARKET_FILTERS.map((item) => <button key={item} type="button" onClick={() => changeMarket(item)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${market === item ? "border-primary/40 bg-primary/15 text-primary" : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"}`}>{t(`news.marketTypes.${item}`)}</button>)}</div>
              <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">{renderFeed(false)}</div><TrendingPanel articles={trending} /></div>
            </section>
          ) : null}

          {activeTab === "economy" ? (
            <section>
              <div className="mb-6 rounded-[24px] border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{t("news.economy.eyebrow")}</p><h2 className="mt-2 text-2xl font-bold">{t("news.economy.title")}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{t("news.economy.description")}</p><div className="mt-4 flex flex-wrap gap-2">{["inflation", "interestRates", "centralBanks", "employment", "gdp", "energy"].map((topic) => <span key={topic} className="rounded-full border border-amber-500/20 bg-background/30 px-3 py-1.5 text-xs text-amber-100/80">{t(`news.economy.topics.${topic}`)}</span>)}</div></div>
              <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">{renderFeed(false)}</div><UpcomingPanel /></div>
            </section>
          ) : null}

          {activeTab === "calendar" ? <EconomicCalendar events={calendarEvents} loading={calendarLoading} region={calendarRegion} impact={calendarImpact} onRegionChange={setCalendarRegion} onImpactChange={setCalendarImpact} /> : null}

          {activeTab === "mine" ? (
            !activeClassId ? <NewsState kind="classRequired" actionLabel={t("news.classSelector.title")} onRetry={() => { setPendingAsset(null); setClassSelectorOpen(true); }} /> : (
              <section><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.mine.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{t("news.mine.title", { className: activeClass?.name })}</h2><p className="mt-2 text-sm text-muted-foreground">{personalSymbols.length ? t("news.mine.description", { count: personalSymbols.length }) : t("news.mine.noAssets")}</p></div><Button variant="outline" onClick={() => { setPendingAsset(null); setClassSelectorOpen(true); }}>{t("news.actions.changeClass")}</Button></div>{personalSymbols.length ? <div className="mb-5 flex flex-wrap gap-2">{personalSymbols.map((symbol) => <AssetPill key={symbol} asset={{ symbol, name: symbol, change: null }} unreadCount={unreadCounts[symbol] || 0} showChange={false} onOpenMarket={(value) => handleOpenMarket(value)} />)}</div> : null}<div className="rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">{renderFeed(false)}</div></section>
            )
          ) : null}

          {activeTab === "saved" ? (
            <section><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.saved.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{t("news.saved.title")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("news.saved.description")}</p></div><div className="rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">{renderFeed(false)}</div></section>
          ) : null}
        </main>
      </div>

      <ClassSelectorModal open={classSelectorOpen} classes={accessibleClasses} activeClassId={activeClassId} pendingSymbol={pendingAsset?.symbol} onOpenChange={setClassSelectorOpen} onSelect={handleClassSelect} />
      <AssetUnavailableModal state={unavailable} onOpenChange={(open) => { if (!open) setUnavailable(null); }} onChangeClass={() => { setUnavailable(null); setPendingAsset(unavailable ? { symbol: unavailable.symbol, article: null } : null); setClassSelectorOpen(true); }} />
      <NewsAlertsModal open={alertsOpen} onOpenChange={setAlertsOpen} alerts={alerts} form={alertForm} setForm={setAlertForm} onCreate={handleCreateAlert} onToggle={handleToggleAlert} onDelete={handleDeleteAlert} saving={alertsSaving} />
    </div>
  );
};

const FilterSelect = ({ value, options, label, onChange, translationPrefix }) => {
  const { t } = useTranslation();
  return (
    <label className="relative flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-sm text-muted-foreground">
      <Filter className="h-4 w-4" /><span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none bg-transparent pr-6 font-semibold text-foreground outline-none">
        {options.map((option) => <option key={option} value={option} className="bg-card">{t(`${translationPrefix}.${option}`)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" />
    </label>
  );
};

export default NewsPage;
