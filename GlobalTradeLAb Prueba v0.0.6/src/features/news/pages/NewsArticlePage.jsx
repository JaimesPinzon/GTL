import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, BookOpen, Clock3, ExternalLink } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import {
  ArticleActions,
  AssetPill,
  AssetUnavailableModal,
  ClassSelectorModal,
  formatNewsTime,
  NewsCard,
  NewsClassActionModal,
  NewsSkeleton,
  NewsState,
  NewsVisual,
  SentimentBadge,
  TopicBadge,
} from "@/features/news/components/NewsUi";
import { useNewsContext } from "@/features/news/context/NewsContext";
import { fetchNews, fetchNewsArticle, getCachedNews, performNewsClassAction } from "@/lib/news-api";
import { GLOBAL_APP_PATHS } from "@/lib/routes";

const NewsArticlePage = () => {
  const { t, i18n } = useTranslation();
  const { newsId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useTradingContext();
  const { isRead, isSaved, markRead, toggleSaved } = useNewsContext();
  const { accessibleClasses = [], activeClass, activeClassId, openAssetInClass } = useClassContext() || {};
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [status, setStatus] = useState("loading");
  const [classSelectorOpen, setClassSelectorOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [classActionMode, setClassActionMode] = useState(null);
  const [classActionSaving, setClassActionSaving] = useState(false);
  const [classActionForm, setClassActionForm] = useState({ roomId: "", title: "", activityType: "asset_analysis", note: "" });
  const manageableClasses = useMemo(() => accessibleClasses.filter((room) => room.createdBy === user?.id || ["teacher", "monitor"].includes(room.membershipRole)), [accessibleClasses, user?.id]);

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    fetchNewsArticle(newsId)
      .then(async (value) => {
        if (!mounted) return;
        setArticle(value);
        markRead(value.id);
        setStatus("ready");
        try {
          const response = await fetchNews({ category: value.category, limit: 5, sort: "latest" });
          if (mounted) setRelated((response.articles || []).filter((entry) => entry.id !== value.id).slice(0, 4));
        } catch {
          if (mounted) setRelated(getCachedNews().filter((entry) => entry.id !== value.id && entry.category === value.category).slice(0, 4));
        }
      })
      .catch(() => {
        if (!mounted) return;
        const cached = getCachedNews().find((entry) => entry.id === newsId) || null;
        setArticle(cached);
        if (cached) markRead(cached.id);
        setStatus(cached ? "ready" : "error");
      });
    return () => { mounted = false; };
  }, [markRead, newsId]);

  const publicationDate = useMemo(() => article ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" }).format(new Date(article.publishedAt)) : "", [article, i18n.language]);

  const handleOpenMarket = async (symbol, classId = null) => {
    const result = await openAssetInClass?.(symbol, { classId, newsId: article?.id, returnTo: location.pathname });
    if (!result || result.reason === "class-required") {
      setPendingAsset(symbol);
      setClassSelectorOpen(true);
      return;
    }
    if (!result.available) setUnavailable({ symbol, className: result.targetClass?.name || activeClass?.name || "" });
  };

  const handleClassSelect = async (classId) => {
    const symbol = pendingAsset;
    setClassSelectorOpen(false);
    setPendingAsset(null);
    if (symbol) await handleOpenMarket(symbol, classId);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: article.title, text: article.summary, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  const openClassAction = (mode) => {
    setClassActionMode(mode);
    setClassActionForm({ roomId: activeClassId && manageableClasses.some((room) => room.id === activeClassId) ? activeClassId : "", title: mode === "activity" ? t("news.classActions.defaultTitle", { title: article.title }) : "", activityType: "asset_analysis", note: "" });
  };

  const handleClassAction = async (event) => {
    event.preventDefault();
    setClassActionSaving(true);
    try {
      await performNewsClassAction({ action: classActionMode === "activity" ? "create_activity" : "share", newsId: article.id, roomId: classActionForm.roomId, title: classActionForm.title, activityType: classActionForm.activityType, note: classActionForm.note, prompt: classActionForm.note });
      toast({ title: t(`news.classActions.${classActionMode}.success`) });
      setClassActionMode(null);
    } catch (error) {
      toast({ variant: "destructive", title: t("news.classActions.error"), description: error.message });
    } finally {
      setClassActionSaving(false);
    }
  };

  if (status === "loading") return <div className="scrollbar-dashboard h-full overflow-y-auto p-5 md:p-8"><div className="mx-auto max-w-5xl"><NewsSkeleton /></div></div>;
  if (!article) return <div className="scrollbar-dashboard h-full overflow-y-auto p-5 md:p-8"><div className="mx-auto max-w-5xl"><NewsState kind="error" onRetry={() => navigate(GLOBAL_APP_PATHS.news)} /></div></div>;

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,hsla(var(--primary)/.08),transparent_32%)]">
      <main className="mx-auto max-w-[1180px] px-4 py-7 md:px-8 md:py-10">
        <Button variant="ghost" className="mb-6 -ml-3 gap-2 text-muted-foreground" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" />{t("news.article.back")}</Button>

        <article>
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><span>{t(`news.categories.${article.category}`, { defaultValue: article.category })}</span>{article.country ? <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{article.country}</span></> : null}{article.isDemo ? <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">{t("news.demo")}</span> : null}</div>
            <h1 className="mt-4 text-3xl font-bold leading-[1.12] tracking-tight md:text-5xl">{article.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">{article.summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{article.source}</span><span>·</span>{article.author ? <><span>{article.author}</span><span>·</span></> : null}<Clock3 className="h-4 w-4" /><time dateTime={article.publishedAt}>{publicationDate}</time></div>
            <div className="mt-4"><SentimentBadge sentiment={article.sentiment} /></div>
            <div className="mt-6 flex flex-wrap gap-2"><ArticleActions article={article} isSaved={isSaved(article.id)} onToggleSaved={toggleSaved} onShare={handleShare} />{manageableClasses.length ? <><Button variant="outline" onClick={() => openClassAction("share")}>{t("news.classActions.share.button")}</Button><Button variant="outline" onClick={() => openClassAction("activity")}>{t("news.classActions.activity.button")}</Button></> : null}</div>
          </div>

          <div className="mt-8 h-[320px] overflow-hidden rounded-[28px] border border-border/60 md:h-[480px]"><NewsVisual article={article} /></div>

          <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="rounded-[24px] border border-border/60 bg-card/35 p-6 md:p-8">
                <p className="whitespace-pre-line text-base leading-8 text-foreground/90">{article.bodyExcerpt || article.summary}</p>
                {article.sentiment ? <p className="mt-6 rounded-xl border border-border/60 bg-background/35 p-3 text-xs leading-5 text-muted-foreground">{t("news.sentiment.disclaimer")}</p> : null}
                {article.isDemo ? <div className="mt-7 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm leading-6 text-amber-100/80">{t("news.article.demoDisclaimer")}</div> : null}
                {article.sourceUrl ? <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 font-semibold text-primary hover:underline">{t("news.actions.originalSource")}<ExternalLink className="h-4 w-4" /></a> : null}
              </div>

              {article.topics?.length ? <div className="mt-6 flex flex-wrap gap-2">{article.topics.map((topic) => <TopicBadge key={topic} topic={topic} />)}</div> : null}
            </div>

            <aside className="space-y-6">
              <section className="rounded-[24px] border border-border/60 bg-card/45 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("news.article.relatedAssets")}</p>
                <div className="mt-4 space-y-3">{article.assets?.map((asset) => <div key={asset.symbol} className="flex items-center justify-between gap-3"><AssetPill asset={asset} /><Button size="sm" variant="ghost" className="gap-2" onClick={() => handleOpenMarket(asset.symbol)}>{t("news.actions.market")}<BarChart3 className="h-3.5 w-3.5" /></Button></div>)}</div>
              </section>
              <section className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
                <div className="w-fit rounded-xl bg-primary/10 p-2.5 text-primary"><BookOpen className="h-5 w-5" /></div><h2 className="mt-3 font-semibold">{t("news.article.educationalTitle")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("news.article.educationalDescription")}</p><Button variant="outline" className="mt-4 w-full" asChild><Link to={GLOBAL_APP_PATHS.learn}>{t("news.article.goToLearn")}</Link></Button>
              </section>
            </aside>
          </div>
        </article>

        {related.length ? <section className="mt-12 border-t border-border/60 pt-8"><h2 className="text-2xl font-bold">{t("news.article.relatedNews")}</h2><div className="mt-4 rounded-[24px] border border-border/60 bg-card/35 px-5 md:px-7">{related.map((item) => <NewsCard key={item.id} article={item} isSaved={isSaved(item.id)} isRead={isRead(item.id)} onToggleSaved={toggleSaved} onOpenMarket={(symbol) => handleOpenMarket(symbol)} />)}</div></section> : null}
      </main>

      <ClassSelectorModal open={classSelectorOpen} classes={accessibleClasses} activeClassId={activeClassId} pendingSymbol={pendingAsset} onOpenChange={setClassSelectorOpen} onSelect={handleClassSelect} />
      <AssetUnavailableModal state={unavailable} onOpenChange={(open) => { if (!open) setUnavailable(null); }} onChangeClass={() => { const symbol = unavailable?.symbol; setUnavailable(null); setPendingAsset(symbol); setClassSelectorOpen(true); }} />
      <NewsClassActionModal open={Boolean(classActionMode)} onOpenChange={(open) => { if (!open) setClassActionMode(null); }} mode={classActionMode || "share"} classes={manageableClasses} form={classActionForm} setForm={setClassActionForm} onSubmit={handleClassAction} saving={classActionSaving} />
    </div>
  );
};

export default NewsArticlePage;
