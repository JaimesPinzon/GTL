import React, { useMemo, useState } from "react";
import { ArrowRight, Clock3, SlidersHorizontal } from "lucide-react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLearning } from "@/features/learning/context/LearningContext";
import { flattenCourseLessons, formatLearningDuration } from "@/features/learning/data/learningCatalog";
import { interpolateLearningCopy } from "@/features/learning/data/learningCopy";
import { CourseCard, EmptyLearningState, LearningCover, SearchField, SectionHeading, contentTypeIcon } from "@/features/learning/components/LearningUi";

const LearningExplorePage = () => {
  const { copy, catalog, locale } = useOutletContext();
  const { getCourseProgress, isSaved, toggleSaved } = useLearning();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [type, setType] = useState("all");
  const [level, setLevel] = useState(searchParams.get("level") || "all");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [duration, setDuration] = useState("all");
  const [sort, setSort] = useState("recommended");
  const categoriesById = useMemo(() => Object.fromEntries(catalog.categories.map((item) => [item.id, item])), [catalog.categories]);

  const allContent = useMemo(() => catalog.courses.flatMap((course) => [
    { ...course, contentType: "course", course },
    ...flattenCourseLessons(course).map((item) => ({
      ...item,
      contentType: item.type === "lesson" ? "lesson" : item.type,
      category: course.category,
      level: course.level,
      course,
      description: course.description,
      durationMinutes: item.duration,
      rating: course.rating,
      students: course.students,
    })),
  ]), [catalog.courses]);

  const filteredContent = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const matchesDuration = (minutes) => duration === "all" || (duration === "short" && minutes < 120) || (duration === "medium" && minutes >= 120 && minutes <= 240) || (duration === "long" && minutes > 240);
    const result = allContent.filter((item) => {
      const haystack = `${item.title} ${item.description || ""} ${categoriesById[item.category]?.label || ""}`.toLocaleLowerCase(locale);
      return (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (type === "all" || item.contentType === type) &&
        (level === "all" || item.level === level) &&
        (category === "all" || item.category === category) &&
        matchesDuration(item.durationMinutes);
    });
    return result.sort((a, b) => {
      if (sort === "newest") return Number(Boolean(b.course.isNew)) - Number(Boolean(a.course.isNew));
      if (sort === "topRated") return b.rating - a.rating;
      return Number(Boolean(b.course.featured)) - Number(Boolean(a.course.featured));
    });
  }, [allContent, categoriesById, category, duration, level, locale, query, sort, type]);

  const resetFilters = () => {
    setQuery(""); setType("all"); setLevel("all"); setCategory("all"); setDuration("all"); setSort("recommended");
  };

  const selectClass = "h-11 rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10";

  return (
    <div className="pb-10">
      <SectionHeading eyebrow={copy.explore.eyebrow} title={copy.explore.title} description={copy.explore.description} />
      <div className="mt-7 rounded-[24px] border border-border/70 bg-card/40 p-4 md:p-5">
        <SearchField value={query} onChange={(event) => setQuery(event.target.value)} onSubmit={(event) => event.preventDefault()} placeholder={copy.header.search} ariaLabel={copy.header.searchAria} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>{copy.explore.type}</span><select value={type} onChange={(event) => setType(event.target.value)} className={`${selectClass} w-full`}><option value="all">{copy.types.all}</option><option value="course">{copy.types.course}</option><option value="lesson">{copy.types.lesson}</option><option value="video">{copy.types.video}</option><option value="practice">{copy.types.practice}</option><option value="quiz">{copy.types.quiz}</option></select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>{copy.explore.level}</span><select value={level} onChange={(event) => setLevel(event.target.value)} className={`${selectClass} w-full`}>{Object.entries(copy.levels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>{copy.explore.category}</span><select value={category} onChange={(event) => setCategory(event.target.value)} className={`${selectClass} w-full`}><option value="all">{copy.levels.all}</option>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>{copy.explore.duration}</span><select value={duration} onChange={(event) => setDuration(event.target.value)} className={`${selectClass} w-full`}><option value="all">{copy.explore.anyDuration}</option><option value="short">{copy.explore.short}</option><option value="medium">{copy.explore.medium}</option><option value="long">{copy.explore.long}</option></select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>{copy.explore.sort}</span><select value={sort} onChange={(event) => setSort(event.target.value)} className={`${selectClass} w-full`}><option value="recommended">{copy.explore.recommended}</option><option value="newest">{copy.explore.newest}</option><option value="topRated">{copy.explore.topRated}</option></select></label>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-4"><p className="text-sm font-medium text-muted-foreground">{interpolateLearningCopy(copy.common.results, { count: filteredContent.length })}</p><Button type="button" variant="ghost" size="sm" onClick={resetFilters}><SlidersHorizontal className="mr-2 h-4 w-4" />{copy.actions.clearFilters}</Button></div>

      {filteredContent.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredContent.map((item) => {
            if (item.contentType === "course") {
              return <CourseCard key={`course-${item.id}`} course={{ ...item, categoryLabel: categoriesById[item.category]?.label }} copy={copy} locale={locale} progress={getCourseProgress(item.id)} saved={isSaved(item.id)} onToggleSaved={toggleSaved} />;
            }
            const TypeIcon = contentTypeIcon(item.contentType);
            return (
              <article key={`${item.course.id}-${item.id}`} className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-border/80 bg-card/55 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl">
                <LearningCover course={{ ...item.course, type: copy.types[item.contentType] || copy.types.lesson }} compact />
                <div className="flex flex-1 flex-col p-5"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">{categoriesById[item.category]?.label}</span><TypeIcon className="h-4 w-4 text-muted-foreground" /></div><h3 className="mt-3 text-lg font-semibold leading-6">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.course.shortTitle}</p><div className="mt-4 flex gap-3 text-xs text-muted-foreground"><span>{copy.levels[item.level]}</span><span>·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatLearningDuration(item.durationMinutes, locale)}</span></div><Button asChild variant="outline" className="mt-5 w-full rounded-xl"><Link to={`/app/learn/course/${item.course.slug}/${item.moduleId}/${item.slug}`}>{copy.actions.viewContent}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
              </article>
            );
          })}
        </div>
      ) : <div className="mt-5"><EmptyLearningState title={copy.explore.noResults} description={copy.explore.noResultsHint} action={<Button type="button" onClick={resetFilters}>{copy.actions.clearFilters}</Button>} /></div>}
    </div>
  );
};

export default LearningExplorePage;
