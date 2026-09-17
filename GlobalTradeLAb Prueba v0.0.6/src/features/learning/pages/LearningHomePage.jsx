import React, { useMemo, useState } from "react";
import { ArrowRight, Clock3, Play, Sparkles } from "lucide-react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLearning } from "@/features/learning/context/LearningContext";
import { flattenCourseLessons, formatLearningDuration } from "@/features/learning/data/learningCatalog";
import { interpolateLearningCopy } from "@/features/learning/data/learningCopy";
import { CourseCard, LearningIcon, LearningProgress, NewBadge, PathCard, SearchField, SectionHeading } from "@/features/learning/components/LearningUi";

const LearningHomePage = () => {
  const { copy, catalog, locale } = useOutletContext();
  const { state, getCourseProgress, isSaved, toggleSaved } = useLearning();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const categoriesById = useMemo(() => Object.fromEntries(catalog.categories.map((item) => [item.id, item])), [catalog.categories]);
  const continuedCourses = useMemo(() =>
    Object.entries(state.courses)
      .map(([courseId, courseState]) => ({ course: catalog.courses.find((item) => item.id === courseId), courseState }))
      .filter((item) => item.course && item.courseState.progress < 100)
      .sort((a, b) => new Date(b.courseState.lastActivity) - new Date(a.courseState.lastActivity))
      .slice(0, 2),
  [catalog.courses, state.courses]);

  const relativeActivity = (date) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return copy.home.today;
    if (days === 1) return copy.home.yesterday;
    return interpolateLearningCopy(copy.home.daysAgo, { count: days });
  };

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(`/app/learn/explore${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  const pathProgress = (path) => {
    const total = path.courseIds.reduce((sum, courseId) => sum + getCourseProgress(courseId), 0);
    return Math.round(total / path.courseIds.length);
  };

  return (
    <div className="space-y-14 pb-10">
      <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-card/55 px-6 py-9 shadow-xl shadow-background/20 md:px-10 md:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,hsla(var(--primary)/.18),transparent_30%)]" />
        <div className="pointer-events-none absolute right-10 top-10 hidden h-40 w-40 rounded-full border border-primary/10 lg:block" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{copy.header.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-foreground md:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">{copy.header.title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{copy.header.description}</p>
          </div>
          <div>
            <SearchField value={query} onChange={(event) => setQuery(event.target.value)} onSubmit={handleSearch} placeholder={copy.header.searchShort} ariaLabel={copy.header.searchAria} />
            <div className="mt-3 flex flex-wrap gap-2">
              {["all", "beginner", "intermediate", "advanced"].map((level) => (
                <button key={level} type="button" onClick={() => navigate(`/app/learn/explore${level === "all" ? "" : `?level=${level}`}`)} className="rounded-full border border-border/80 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">{copy.levels[level]}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading eyebrow={copy.home.continueEyebrow} title={copy.home.continueTitle} />
        {continuedCourses.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {continuedCourses.map(({ course, courseState }) => {
              const lessons = flattenCourseLessons(course);
              const lesson = lessons.find((item) => item.id === courseState.lastLessonId) || lessons[0];
              return (
                <article key={course.id} className="group rounded-[24px] border border-border/75 bg-card/45 p-5 transition hover:border-primary/30 md:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className={`flex h-24 w-full shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br ${course.accent} sm:w-28`}><LearningIcon name={course.icon} className="h-8 w-8 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{course.shortTitle}</p><h3 className="mt-1 truncate text-lg font-semibold">{lesson.title}</h3></div><span className="text-sm font-semibold">{courseState.progress}%</span></div>
                      <LearningProgress value={courseState.progress} className="mt-4" />
                      <div className="mt-4 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>{interpolateLearningCopy(copy.home.lastActivity, { value: relativeActivity(courseState.lastActivity) })}</span>
                        <Button asChild size="sm" className="rounded-xl"><Link to={`/app/learn/course/${course.slug}/${lesson.moduleId}/${lesson.slug}`}><Play className="mr-2 h-3.5 w-3.5" />{copy.actions.continue}</Link></Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-border bg-card/30 p-8"><h3 className="font-semibold">{copy.home.noProgressTitle}</h3><p className="mt-2 text-sm text-muted-foreground">{copy.home.noProgressDescription}</p></div>
        )}
      </section>

      <section>
        <SectionHeading
          eyebrow={copy.home.pathsEyebrow}
          title={copy.home.pathsTitle}
          description={copy.home.pathsDescription}
          action={<Button asChild variant="ghost" className="text-primary hover:bg-primary/10 hover:text-primary"><Link to="/app/learn/paths">{copy.actions.viewAll}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">{catalog.paths.slice(0, 3).map((path) => <PathCard key={path.id} path={path} copy={copy} locale={locale} progress={pathProgress(path)} />)}</div>
      </section>

      <section>
        <SectionHeading eyebrow={copy.home.categoriesEyebrow} title={copy.home.categoriesTitle} />
        <div className="mt-6 flex flex-wrap gap-2.5">
          {catalog.categories.map((category) => (
            <Link key={category.id} to={`/app/learn/explore?category=${category.id}`} className="inline-flex items-center gap-2.5 rounded-2xl border border-border/75 bg-card/35 px-4 py-3 text-sm font-medium transition hover:border-primary/35 hover:bg-primary/5 hover:text-primary">
              <LearningIcon name={category.icon} className="h-4 w-4" />{category.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading eyebrow={copy.home.recommendedEyebrow} title={copy.home.recommendedTitle} />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {catalog.courses.filter((course) => course.featured).slice(0, 4).map((course) => (
            <CourseCard key={course.id} course={{ ...course, categoryLabel: categoriesById[course.category]?.label }} copy={copy} locale={locale} progress={getCourseProgress(course.id)} saved={isSaved(course.id)} onToggleSaved={toggleSaved} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading eyebrow={copy.home.newEyebrow} title={copy.home.newTitle} description={copy.home.latestDescription} />
        <div className="mt-6 divide-y divide-border/70 rounded-[24px] border border-border/70 bg-card/35 px-5 md:px-7">
          {catalog.courses.filter((course) => course.isNew).map((course) => (
            <Link key={course.id} to={`/app/learn/course/${course.slug}`} className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${course.accent}`}><LearningIcon name={course.icon} className="h-5 w-5 text-primary" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><NewBadge>{copy.common.new}</NewBadge><span className="text-xs text-muted-foreground">{categoriesById[course.category]?.label}</span></div><h3 className="mt-2 font-semibold transition group-hover:text-primary">{course.title}</h3></div>
              <span className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />{formatLearningDuration(course.durationMinutes, locale)}<ArrowRight className="ml-2 h-4 w-4 text-primary" /></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default LearningHomePage;
