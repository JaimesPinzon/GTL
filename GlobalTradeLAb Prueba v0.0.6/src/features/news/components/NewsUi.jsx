import React from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarClock,
  ChevronRight,
  AlertCircle,
  Clock3,
  ExternalLink,
  Globe2,
  Landmark,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildNewsArticleRoute, buildNewsSymbolRoute } from "@/lib/routes";

export const NEWS_TABS = ["home", "latest", "markets", "economy", "calendar", "mine", "saved"];

const paletteByCategory = {
  economy: "from-amber-500/30 via-orange-500/10 to-transparent text-amber-300",
  markets: "from-blue-500/30 via-cyan-500/10 to-transparent text-blue-300",
  technology: "from-violet-500/30 via-fuchsia-500/10 to-transparent text-violet-300",
};

export const formatNewsTime = (value, language = "es") => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return language.startsWith("es") ? `hace ${minutes} min` : `${minutes} min ago`;
  if (minutes < 1_440) {
    const hours = Math.floor(minutes / 60);
    return language.startsWith("es") ? `hace ${hours} h` : `${hours}h ago`;
  }
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(timestamp);
};

export const NewsVisual = ({ article, compact = false }) => {
  if (article?.imageUrl) {
    return <img src={article.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />;
  }
  const palette = paletteByCategory[article?.category] || paletteByCategory.markets;
  return (
    <div className={`relative flex h-full min-h-[150px] w-full items-center justify-center overflow-hidden bg-gradient-to-br ${palette}`}>
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(hsla(var(--foreground)/.12)_1px,transparent_1px),linear-gradient(90deg,hsla(var(--foreground)/.12)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full border border-current/20" />
      <div className="absolute -bottom-20 -left-8 h-48 w-48 rounded-full border border-current/15" />
      {article?.category === "economy" ? <Landmark className={compact ? "h-10 w-10" : "h-16 w-16"} /> : <TrendingUp className={compact ? "h-10 w-10" : "h-16 w-16"} />}
    </div>
  );
};

export const ActiveClassIndicator = ({ activeClass, onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${activeClass ? "bg-emerald-400" : "bg-slate-500"}`} />
      <span className="truncate">
        {activeClass ? t("news.activeClass", { name: activeClass.name }) : t("news.noActiveClass")}
      </span>
    </button>
  );
};

export const NewsHeader = ({ activeTab, activeClass, query, onQueryChange, onSubmit, onTabChange, onClassClick, onAlertsClick, alertsCount = 0 }) => {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border/60 bg-background/80 px-4 pb-0 pt-5 backdrop-blur-xl md:px-7 md:pt-7">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Newspaper className="h-4 w-4" /> {t("news.eyebrow")}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-[32px]">{t("news.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("news.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAlertsClick} className="relative rounded-full border border-border/70 bg-card/60 p-2.5 text-muted-foreground transition hover:border-primary/40 hover:text-primary" aria-label={t("news.alerts.title")}>
              <Bell className="h-4 w-4" />
              {alertsCount ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">{alertsCount}</span> : null}
            </button>
            <ActiveClassIndicator activeClass={activeClass} onClick={onClassClick} />
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 flex max-w-3xl items-center gap-3 rounded-2xl border border-border/70 bg-card/55 px-4 py-1 shadow-[inset_0_1px_0_hsla(var(--foreground)/0.04)]">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("news.searchPlaceholder")}
            aria-label={t("news.searchAriaLabel")}
            className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd className="hidden rounded-lg border border-border/60 bg-background/60 px-2 py-1 text-[10px] text-muted-foreground sm:block">{t("news.enterKey")}</kbd>
        </form>

        <nav className="scrollbar-page mt-5 flex gap-1 overflow-x-auto" aria-label={t("news.tabsAriaLabel")}>
          {NEWS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`relative shrink-0 px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t(`news.tabs.${tab}`)}
              {activeTab === tab ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};

export const AssetPill = ({ asset, onOpenMarket, showChange = true, unreadCount = 0 }) => {
  const { t } = useTranslation();
  const change = Number(asset.change);
  const hasChange = showChange && asset.change != null && Number.isFinite(change);
  return (
    <div className="group/asset inline-flex items-center overflow-hidden rounded-lg border border-border/60 bg-background/55 text-xs">
      <Link
        to={buildNewsSymbolRoute(asset.symbol)}
        className="flex items-center gap-2 px-2.5 py-1.5 font-bold text-foreground transition hover:bg-primary/10 hover:text-primary"
        title={asset.name}
      >
        {asset.symbol}
        {hasChange ? <span className={change >= 0 ? "text-emerald-400" : "text-rose-400"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span> : null}
        {unreadCount > 0 ? <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary" title={t("news.unreadCount", { count: unreadCount })}>{unreadCount}</span> : null}
      </Link>
      {onOpenMarket ? (
        <button
          type="button"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpenMarket(asset.symbol); }}
          className="border-l border-border/60 px-2 py-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          aria-label={t("news.actions.viewAssetInMarket", { symbol: asset.symbol })}
          title={t("news.actions.viewInMarket")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
};

export const SentimentBadge = ({ sentiment, compact = false }) => {
  const { t } = useTranslation();
  const label = sentiment?.label || "neutral";
  const styles = { positive: "border-sky-400/25 bg-sky-400/10 text-sky-200", negative: "border-violet-400/25 bg-violet-400/10 text-violet-200", mixed: "border-amber-400/25 bg-amber-400/10 text-amber-200", neutral: "border-slate-400/25 bg-slate-400/10 text-slate-300" };
  return <span title={t("news.sentiment.disclaimer")} className={`inline-flex items-center rounded-full border font-semibold ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${styles[label] || styles.neutral}`}>{t(`news.sentiment.${label}`)}</span>;
};

export const FeaturedNews = ({ article, isSaved, isRead, onToggleSaved, onOpenMarket }) => {
  const { t, i18n } = useTranslation();
  if (!article) return null;
  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-border/60 bg-card/55 shadow-[0_24px_70px_hsla(var(--background)/0.35)]">
      <div className="grid min-h-[360px] lg:grid-cols-[1.12fr_.88fr]">
        <div className="min-h-[250px] overflow-hidden lg:order-2">
          <NewsVisual article={article} />
        </div>
        <div className="flex flex-col justify-center p-6 md:p-9 lg:order-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {!isRead ? <span className="h-2 w-2 rounded-full bg-primary" title={t("news.unread")} /> : null}
            {article.isBreaking ? <span className="rounded-full bg-primary/15 px-2.5 py-1">{t("news.breaking")}</span> : null}
            <span>{t(`news.categories.${article.category}`, { defaultValue: article.category })}</span>
            {article.country ? <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{article.country}</span></> : null}
          </div>
          <Link to={buildNewsArticleRoute(article.id)}>
            <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight transition group-hover:text-primary md:text-[30px]">{article.title}</h2>
          </Link>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">{article.summary}</p>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{article.source}</span><span>·</span><Clock3 className="h-3.5 w-3.5" />
            <span>{formatNewsTime(article.publishedAt, i18n.language)}</span>
            {article.isDemo ? <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-300">{t("news.demo")}</span> : null}<SentimentBadge sentiment={article.sentiment} compact />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {article.assets.map((asset) => <AssetPill key={asset.symbol} asset={asset} onOpenMarket={(symbol) => onOpenMarket(symbol, article)} />)}
            <button type="button" onClick={() => onToggleSaved(article)} className="ml-auto rounded-xl p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary" aria-label={isSaved ? t("news.actions.unsave") : t("news.actions.save")}>
              {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export const NewsCard = ({ article, dense = false, isSaved, isRead, onToggleSaved, onOpenMarket }) => {
  const { t, i18n } = useTranslation();
  if (dense) {
    return (
      <article className="group grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4 border-b border-border/50 py-5 last:border-0">
        <time className="pt-1 font-mono text-sm font-bold text-muted-foreground">{new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(article.publishedAt))}</time>
        <div className="min-w-0">
          <Link to={buildNewsArticleRoute(article.id)}><h3 className="flex items-start gap-2 font-semibold leading-6 transition group-hover:text-primary">{!isRead ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}<span>{article.title}</span></h3></Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{article.source}</span><span>·</span><span>{t(`news.categories.${article.category}`, { defaultValue: article.category })}</span><SentimentBadge sentiment={article.sentiment} compact />
            {article.assets.slice(0, 3).map((asset) => <AssetPill key={asset.symbol} asset={asset} showChange={false} onOpenMarket={(symbol) => onOpenMarket(symbol, article)} />)}
          </div>
        </div>
        <button type="button" onClick={() => onToggleSaved(article)} className="self-start rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={isSaved ? t("news.actions.unsave") : t("news.actions.save")}>
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </article>
    );
  }

  return (
    <article className="group grid gap-4 border-b border-border/50 py-6 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)]">
      <Link to={buildNewsArticleRoute(article.id)} className="h-[150px] overflow-hidden rounded-2xl border border-border/50"><NewsVisual article={article} compact /></Link>
      <div className="min-w-0 py-1">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          {!isRead ? <span className="h-2 w-2 rounded-full bg-primary" title={t("news.unread")} /> : null}
          <span>{t(`news.categories.${article.category}`, { defaultValue: article.category })}</span>{article.country ? <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{article.country}</span></> : null}
        </div>
        <Link to={buildNewsArticleRoute(article.id)}><h3 className="mt-2 text-lg font-bold leading-snug transition group-hover:text-primary">{article.title}</h3></Link>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{article.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{article.source}</span><span>·</span><span>{formatNewsTime(article.publishedAt, i18n.language)}</span><SentimentBadge sentiment={article.sentiment} compact />{article.clusterSize > 1 ? <span>{t("news.cluster.sources", { count: article.clusterSize })}</span> : null}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {article.assets.slice(0, 3).map((asset) => <AssetPill key={asset.symbol} asset={asset} showChange={false} onOpenMarket={(symbol) => onOpenMarket(symbol, article)} />)}
          <button type="button" onClick={() => onToggleSaved(article)} className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label={isSaved ? t("news.actions.unsave") : t("news.actions.save")}>
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </article>
  );
};

export const TrendingPanel = ({ articles }) => {
  const { t } = useTranslation();
  return (
    <aside className="rounded-[24px] border border-border/60 bg-card/45 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><Sparkles className="h-4 w-4 text-amber-300" />{t("news.trending")}</div>
      <ol>
        {articles.slice(0, 5).map((article, index) => (
          <li key={article.id} className="grid grid-cols-[32px_1fr] gap-3 border-b border-border/40 py-4 last:border-0">
            <span className="font-mono text-lg text-primary/70">{String(index + 1).padStart(2, "0")}</span>
            <div><Link to={buildNewsArticleRoute(article.id)} className="text-sm font-semibold leading-5 transition hover:text-primary">{article.title}</Link>{article.clusterSize > 1 ? <p className="mt-1 text-[11px] text-muted-foreground">{t("news.cluster.sources", { count: article.clusterSize })}</p> : null}</div>
          </li>
        ))}
      </ol>
    </aside>
  );
};

export const NewsSkeleton = () => (
  <div className="animate-pulse space-y-6" aria-hidden="true">
    <div className="h-[330px] rounded-[28px] bg-card/70" />
    {[0, 1, 2].map((item) => <div key={item} className="grid grid-cols-[180px_1fr] gap-4"><div className="h-36 rounded-2xl bg-card/70" /><div className="space-y-3 py-2"><div className="h-3 w-1/4 rounded bg-card/70" /><div className="h-5 w-3/4 rounded bg-card/70" /><div className="h-3 w-full rounded bg-card/70" /><div className="h-3 w-2/3 rounded bg-card/70" /></div></div>)}
  </div>
);

export const NewsState = ({ kind = "empty", onRetry, onReset, actionLabel }) => {
  const { t } = useTranslation();
  const Icon = kind === "offline" ? WifiOff : kind === "error" ? AlertCircle : Newspaper;
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-card/25 px-6 text-center">
      <div className="rounded-2xl bg-secondary/70 p-4 text-muted-foreground"><Icon className="h-7 w-7" /></div>
      <h2 className="mt-4 text-lg font-semibold">{t(`news.states.${kind}.title`)}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{t(`news.states.${kind}.description`)}</p>
      {onRetry ? <Button variant="outline" className="mt-5 gap-2" onClick={onRetry}><RefreshCw className="h-4 w-4" />{actionLabel || t("common.actions.retry")}</Button> : null}
      {onReset ? <Button variant="outline" className="mt-5" onClick={onReset}>{t("news.actions.resetFilters")}</Button> : null}
    </div>
  );
};

export const DataStatusBanner = ({ source, isStale, fetchedAt }) => {
  const { t, i18n } = useTranslation();
  if (!isStale && source !== "demo") return null;
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-xs ${isStale ? "border-amber-500/25 bg-amber-500/8 text-amber-200" : "border-blue-500/25 bg-blue-500/8 text-blue-200"}`}>
      {isStale ? <WifiOff className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <span>{isStale ? t("news.cachedNotice") : t("news.demoNotice")}</span>
      {fetchedAt ? <span className="ml-auto opacity-75">{t("news.updatedAt", { time: new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(fetchedAt)) })}</span> : null}
    </div>
  );
};

export const ClassSelectorModal = ({ open, classes, activeClassId, pendingSymbol, onOpenChange, onSelect }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[24px] border-border/70 bg-card p-0">
        <DialogHeader className="border-b border-border/60 p-6 pr-12">
          <DialogTitle>{pendingSymbol ? t("news.classSelector.titleForAsset", { symbol: pendingSymbol }) : t("news.classSelector.title")}</DialogTitle>
          <DialogDescription>{pendingSymbol ? t("news.classSelector.descriptionForAsset", { symbol: pendingSymbol }) : t("news.classSelector.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] space-y-3 overflow-y-auto p-6">
          {classes.length ? classes.map((room) => (
            <button key={room.id} type="button" onClick={() => onSelect(room.id)} className="flex w-full items-center gap-4 rounded-2xl border border-border/60 bg-background/40 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><Building2 className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{room.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{room.teacherName || room.teacher || t("news.classSelector.memberClass")}</p></div>
              {room.id === activeClassId ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">{t("news.classSelector.active")}</span> : null}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )) : <NewsState kind="noClasses" />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const AssetUnavailableModal = ({ state, onOpenChange, onChangeClass }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[24px] border-border/70 bg-card">
        <DialogHeader>
          <div className="mb-2 w-fit rounded-2xl bg-amber-500/10 p-3 text-amber-300"><AlertCircle className="h-6 w-6" /></div>
          <DialogTitle>{t("news.unavailable.title", { symbol: state?.symbol })}</DialogTitle>
          <DialogDescription>{t("news.unavailable.description", { className: state?.className })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("common.actions.close")}</Button>
          <Button onClick={onChangeClass}>{t("news.actions.changeClass")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const SideContextPanel = ({ activeClass, personalCount, onViewMine }) => {
  const { t } = useTranslation();
  return (
    <aside className="rounded-[24px] border border-border/60 bg-card/45 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("news.classContext.title")}</p>
      {activeClass ? <><p className="mt-3 font-semibold">{activeClass.name}</p><p className="mt-1 text-xs text-muted-foreground">{t("news.classContext.personalCount", { count: personalCount })}</p><Button variant="outline" className="mt-4 w-full justify-between" onClick={onViewMine}>{t("news.classContext.viewMine")}<ArrowRight className="h-4 w-4" /></Button></> : <p className="mt-3 text-sm text-muted-foreground">{t("news.classContext.none")}</p>}
    </aside>
  );
};

export const ArticleActions = ({ article, isSaved, onToggleSaved, onShare }) => {
  const { t } = useTranslation();
  return <div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={() => onToggleSaved(article)}>{isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{isSaved ? t("news.actions.saved") : t("news.actions.save")}</Button><Button variant="outline" className="gap-2" onClick={onShare}><Share2 className="h-4 w-4" />{t("news.actions.share")}</Button>{article.sourceUrl ? <Button asChild className="gap-2"><a href={article.sourceUrl} target="_blank" rel="noreferrer">{t("news.actions.originalSource")}<ExternalLink className="h-4 w-4" /></a></Button> : null}</div>;
};

export const TopicBadge = ({ topic }) => <span className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground">#{topic}</span>;

export const UpcomingPanel = () => {
  const { t } = useTranslation();
  return <aside className="rounded-[24px] border border-border/60 bg-card/45 p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"><CalendarClock className="h-4 w-4 text-primary" />{t("news.educational.title")}</div><p className="mt-3 text-sm leading-6 text-muted-foreground">{t("news.educational.description")}</p><div className="mt-4 flex items-start gap-3 rounded-xl bg-primary/8 p-3 text-xs text-muted-foreground"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{t("news.educational.notice")}</span></div></aside>;
};

export const EconomicCalendar = ({ events, loading, region, impact, onRegionChange, onImpactChange }) => {
  const { t, i18n } = useTranslation();
  if (loading) return <NewsSkeleton />;
  return (
    <section className="overflow-hidden rounded-[24px] border border-border/60 bg-card/35">
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 p-5 md:flex-row md:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{t("news.calendar.eyebrow")}</p><h2 className="mt-1 text-2xl font-bold">{t("news.calendar.title")}</h2></div>
        <div className="flex gap-2">
          <select value={region} onChange={(event) => onRegionChange(event.target.value)} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm"><option value="">{t("news.regions.all")}</option><option value="north-america">{t("news.regions.north-america")}</option><option value="latin-america">{t("news.regions.latin-america")}</option><option value="europe">{t("news.regions.europe")}</option></select>
          <select value={impact} onChange={(event) => onImpactChange(event.target.value)} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm"><option value="">{t("news.calendar.allImpact")}</option><option value="high">{t("news.calendar.impact.high")}</option><option value="medium">{t("news.calendar.impact.medium")}</option><option value="low">{t("news.calendar.impact.low")}</option></select>
        </div>
      </div>
      {events.length ? <div className="divide-y divide-border/40">{events.map((event) => <div key={event.id} className="grid gap-4 p-5 md:grid-cols-[130px_minmax(0,1fr)_100px_100px_100px] md:items-center"><div><p className="font-mono text-sm font-bold">{new Intl.DateTimeFormat(i18n.language, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.scheduledAt))}</p><p className="mt-1 text-xs text-muted-foreground">{event.country} · {event.currency}</p></div><div><div className="flex items-center gap-2"><h3 className="font-semibold">{event.title}</h3><span className={`h-2 w-2 rounded-full ${event.impact === "high" ? "bg-amber-400" : event.impact === "medium" ? "bg-sky-400" : "bg-slate-400"}`} /></div><p className="mt-1 text-xs text-muted-foreground">{event.description}</p></div><CalendarValue label={t("news.calendar.previous")} value={event.previousValue} /><CalendarValue label={t("news.calendar.forecast")} value={event.forecastValue} /><CalendarValue label={t("news.calendar.actual")} value={event.actualValue} /></div>)}</div> : <NewsState kind="empty" />}
    </section>
  );
};

const CalendarValue = ({ label, value }) => <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-sm font-semibold">{value || "—"}</p></div>;

export const NewsAlertsModal = ({ open, onOpenChange, alerts, form, setForm, onCreate, onToggle, onDelete, saving }) => {
  const { t } = useTranslation();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl rounded-[24px] border-border/70 bg-card"><DialogHeader><DialogTitle>{t("news.alerts.title")}</DialogTitle><DialogDescription>{t("news.alerts.description")}</DialogDescription></DialogHeader><div className="grid gap-5 md:grid-cols-[1fr_1.15fr]"><form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-border/60 bg-background/35 p-4"><Input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("news.alerts.namePlaceholder")} /><Input value={form.symbols} onChange={(event) => setForm((current) => ({ ...current, symbols: event.target.value }))} placeholder={t("news.alerts.symbolsPlaceholder")} /><Input value={form.topics} onChange={(event) => setForm((current) => ({ ...current, topics: event.target.value }))} placeholder={t("news.alerts.topicsPlaceholder")} /><label className="block text-xs text-muted-foreground">{t("news.alerts.importance")}<input type="range" min="0" max="100" step="5" value={form.minImportance} onChange={(event) => setForm((current) => ({ ...current, minImportance: event.target.value }))} className="mt-2 w-full" /><span className="font-mono text-foreground">{form.minImportance}/100</span></label><Button type="submit" disabled={saving} className="w-full gap-2"><Plus className="h-4 w-4" />{t("news.alerts.create")}</Button></form><div className="max-h-[360px] space-y-3 overflow-y-auto">{alerts.length ? alerts.map((alert) => <div key={alert.id} className="rounded-2xl border border-border/60 bg-background/35 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{alert.name}</p><p className="mt-1 text-xs text-muted-foreground">{[...(alert.symbols || []), ...(alert.topics || [])].join(" · ")}</p></div><button type="button" onClick={() => onDelete(alert.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div><button type="button" onClick={() => onToggle(alert.id, !alert.enabled)} className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold ${alert.enabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{alert.enabled ? t("news.alerts.enabled") : t("news.alerts.disabled")}</button></div>) : <NewsState kind="noAlerts" />}</div></div></DialogContent></Dialog>;
};

export const NewsClassActionModal = ({ open, onOpenChange, mode, classes, form, setForm, onSubmit, saving }) => {
  const { t } = useTranslation();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl rounded-[24px] border-border/70 bg-card"><DialogHeader><DialogTitle>{t(`news.classActions.${mode}.title`)}</DialogTitle><DialogDescription>{t(`news.classActions.${mode}.description`)}</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="space-y-4"><label className="block text-sm font-semibold">{t("news.classActions.classLabel")}<select value={form.roomId} onChange={(event) => setForm((current) => ({ ...current, roomId: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"><option value="">{t("news.classActions.selectClass")}</option>{classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>{mode === "activity" ? <><label className="block text-sm font-semibold">{t("news.classActions.activityTitle")}<Input className="mt-2" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label><label className="block text-sm font-semibold">{t("news.classActions.activityType")}<select value={form.activityType} onChange={(event) => setForm((current) => ({ ...current, activityType: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"><option value="asset_analysis">{t("classes.activityTypes.assetAnalysis")}</option><option value="graded_discussion">{t("classes.activityTypes.gradedDiscussion")}</option><option value="open_task">{t("classes.activityTypes.openTask")}</option></select></label></> : null}<label className="block text-sm font-semibold">{mode === "activity" ? t("news.classActions.prompt") : t("news.classActions.note")}<textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-border bg-background p-3 text-sm" /></label><DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.actions.cancel")}</Button><Button type="submit" disabled={saving}>{saving ? t("common.states.loading") : t(`news.classActions.${mode}.submit`)}</Button></DialogFooter></form></DialogContent></Dialog>;
};
