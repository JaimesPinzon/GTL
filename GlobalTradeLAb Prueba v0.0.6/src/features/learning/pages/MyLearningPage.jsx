import React, { useMemo, useState } from "react";
import { Award, BarChart3, BookOpenCheck, Clock3, Target } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLearning } from "@/features/learning/context/LearningContext";
import { flattenCourseLessons } from "@/features/learning/data/learningCatalog";
import { CourseCard, EmptyLearningState, LearningProgress, MetricCard, SectionHeading } from "@/features/learning/components/LearningUi";

const MyLearningPage = () => {
  const { copy, catalog, locale } = useOutletContext();
  const { state, getCourseProgress, isSaved, toggleSaved } = useLearning();
  const [tab, setTab] = useState("progress");
  const categoriesById = useMemo(() => Object.fromEntries(catalog.categories.map((item) => [item.id, item])), [catalog.categories]);
  const startedCourses = catalog.courses.filter((course) => state.courses[course.id]);
  const inProgress = startedCourses.filter((course) => getCourseProgress(course.id) < 100);
  const completed = startedCourses.filter((course) => getCourseProgress(course.id) === 100);
  const saved = catalog.courses.filter((course) => state.savedIds.includes(course.id));
  const hours = Math.round(startedCourses.reduce((sum, course) => sum + (course.durationMinutes * getCourseProgress(course.id)) / 100, 0) / 60);
  const overall = startedCourses.length ? Math.round(startedCourses.reduce((sum, course) => sum + getCourseProgress(course.id), 0) / startedCourses.length) : 0;
  const tabs = ["progress", "completed", "saved", "history", "assessments"];

  const courseGrid = (items) => items.length ? (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((course) => <CourseCard key={course.id} course={{ ...course, categoryLabel: categoriesById[course.category]?.label }} copy={copy} locale={locale} progress={getCourseProgress(course.id)} saved={isSaved(course.id)} onToggleSaved={toggleSaved} />)}</div>
  ) : <EmptyLearningState title={copy.mine.noItems} description={copy.mine.noItemsHint} action={<Button asChild><Link to="/app/learn/explore">{copy.nav.explore}</Link></Button>} />;

  const renderHistoryEntry = (entry, index) => {
    const course = catalog.courses.find((item) => item.id === entry.courseId);
    const lesson = flattenCourseLessons(course).find((item) => item.id === entry.lessonId);
    if (!course || !lesson) return null;
    return (
      <Link key={`${entry.at}-${index}`} to={`/app/learn/course/${course.slug}/${lesson.moduleId}/${lesson.slug}`} className="flex flex-col gap-3 py-5 transition hover:text-primary sm:flex-row sm:items-center">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><Clock3 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><p className="font-medium">{lesson.title}</p><p className="mt-1 text-sm text-muted-foreground">{course.shortTitle}</p></div>
        <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(entry.at))}</span>
      </Link>
    );
  };

  const renderAssessment = (attempt) => {
    const course = catalog.courses.find((item) => item.id === attempt.courseId);
    const lesson = flattenCourseLessons(course).find((item) => item.id === attempt.lessonId);
    if (!course || !lesson) return null;
    const score = attempt.score == null ? copy.mine.pendingAssessment : `${attempt.score}%`;
    return (
      <article key={`${attempt.courseId}-${attempt.lessonId}`} className="rounded-[22px] border border-border/70 bg-card/40 p-5">
        <div className="flex items-start justify-between gap-4"><span className="rounded-xl bg-primary/10 p-2 text-primary"><BarChart3 className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attempt.status === "complete" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{score}</span></div>
        <h3 className="mt-4 font-semibold">{lesson.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{course.shortTitle}</p>
        <div className="mt-5 flex justify-between text-xs text-muted-foreground"><span>{copy.mine.assessmentScore}</span><span>{score}</span></div>
      </article>
    );
  };

  return (
    <div className="pb-10">
      <SectionHeading eyebrow={copy.mine.eyebrow} title={copy.mine.title} description={copy.mine.description} />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={copy.mine.completedCourses} value={completed.length} icon={<Award className="h-4 w-4" />} />
        <MetricCard label={copy.mine.inProgress} value={inProgress.length} icon={<BookOpenCheck className="h-4 w-4" />} />
        <MetricCard label={copy.mine.learnedHours} value={`${hours} h`} icon={<Clock3 className="h-4 w-4" />} />
        <MetricCard label={copy.mine.overall} value={`${overall}%`} icon={<Target className="h-4 w-4" />} detail={<LearningProgress value={overall} className="mt-2" />} />
      </div>
      <div className="scrollbar-dashboard mt-9 flex gap-1 overflow-x-auto border-b border-border/70">
        {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition", tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{copy.mine.tabs[item]}</button>)}
      </div>
      <div className="mt-7">
        {tab === "progress" ? courseGrid(inProgress) : null}
        {tab === "completed" ? courseGrid(completed) : null}
        {tab === "saved" ? courseGrid(saved) : null}
        {tab === "history" ? (state.history.length ? <div className="divide-y divide-border/70 rounded-[24px] border border-border/70 bg-card/35 px-5 md:px-7">{state.history.map(renderHistoryEntry)}</div> : <EmptyLearningState title={copy.mine.noItems} description={copy.mine.noItemsHint} />) : null}
        {tab === "assessments" ? (state.quizAttempts.length ? <div className="grid gap-4 md:grid-cols-2">{state.quizAttempts.map(renderAssessment)}</div> : <EmptyLearningState title={copy.mine.noItems} description={copy.mine.noItemsHint} />) : null}
      </div>
    </div>
  );
};

export default MyLearningPage;
