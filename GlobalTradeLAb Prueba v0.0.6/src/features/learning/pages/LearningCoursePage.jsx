import React, { useMemo } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, Clock3, FileText, GraduationCap, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLearning } from "@/features/learning/context/LearningContext";
import { flattenCourseLessons, formatLearningDuration } from "@/features/learning/data/learningCatalog";
import { interpolateLearningCopy } from "@/features/learning/data/learningCopy";
import { CourseCard, EmptyLearningState, LearningCover, LearningProgress, contentTypeIcon } from "@/features/learning/components/LearningUi";

const LearningCoursePage = () => {
  const { copy, catalog, locale } = useOutletContext();
  const { courseSlug } = useParams();
  const navigate = useNavigate();
  const { getCourseState, getCourseProgress, isSaved, startCourse, toggleSaved } = useLearning();
  const course = catalog.courses.find((item) => item.slug === courseSlug);
  const categoriesById = useMemo(() => Object.fromEntries(catalog.categories.map((item) => [item.id, item])), [catalog.categories]);

  if (!course) return <EmptyLearningState title={copy.course.noCourse} description={copy.explore.noResultsHint} action={<Button asChild><Link to="/app/learn/explore">{copy.actions.back}</Link></Button>} />;

  const lessons = flattenCourseLessons(course);
  const courseState = getCourseState(course.id);
  const progress = getCourseProgress(course.id);
  const saved = isSaved(course.id);
  const targetLesson = lessons.find((item) => item.id === courseState?.lastLessonId) || lessons[0];
  const related = catalog.courses.filter((item) => item.id !== course.id && (item.category === course.category || item.level === course.level)).slice(0, 3);
  const handleStart = () => {
    startCourse(course.id, targetLesson.id);
    navigate(`/app/learn/course/${course.slug}/${targetLesson.moduleId}/${targetLesson.slug}`);
  };

  return (
    <div className="pb-10">
      <Button asChild variant="ghost" className="-ml-3 mb-6"><Link to="/app/learn/explore"><ArrowLeft className="mr-2 h-4 w-4" />{copy.nav.explore}</Link></Button>
      <section className="overflow-hidden rounded-[30px] border border-border/70 bg-card/50">
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
          <div className="p-7 md:p-10 lg:p-12"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{categoriesById[course.category]?.label}</span><span className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.common.official}</span></div><h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{course.title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{course.description}</p><div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4" />{copy.levels[course.level]}</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />{formatLearningDuration(course.durationMinutes, locale)}</span><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />{interpolateLearningCopy(copy.course.moduleCount, { count: course.modules.length })}</span><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{interpolateLearningCopy(copy.course.lessonsCount, { count: lessons.length })}</span></div>{progress > 0 ? <div className="mt-8 max-w-xl"><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">{copy.common.progress}</span><span className="font-semibold">{progress}%</span></div><LearningProgress value={progress} /></div> : null}<div className="mt-8 flex flex-wrap gap-3"><Button size="lg" className="rounded-xl" onClick={handleStart}>{progress > 0 ? copy.actions.resumeCourse : copy.actions.startCourse}<ArrowRight className="ml-2 h-4 w-4" /></Button><Button type="button" size="lg" variant="outline" className="rounded-xl" onClick={() => toggleSaved(course.id)}>{saved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}{saved ? copy.actions.saved : copy.actions.save}</Button></div></div>
          <LearningCover course={{ ...course, type: copy.types.course }} className="h-full min-h-[300px] border-t border-border/70 lg:border-l lg:border-t-0" />
        </div>
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-10">
          <section><h2 className="text-2xl font-semibold">{copy.course.about}</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{course.description} {copy.course.officialDescription}</p></section>
          <section><h2 className="text-2xl font-semibold">{copy.course.outcomes}</h2><ul className="mt-5 grid gap-3 md:grid-cols-2">{course.outcomes.map((outcome) => <li key={outcome} className="flex gap-3 rounded-2xl border border-border/60 bg-card/30 p-4 text-sm leading-6"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><Check className="h-3.5 w-3.5" /></span>{outcome}</li>)}</ul></section>
          <section><h2 className="text-2xl font-semibold">{copy.course.contents}</h2><div className="mt-5 space-y-4">{course.modules.map((module, moduleIndex) => <article key={module.id} className="overflow-hidden rounded-[22px] border border-border/70 bg-card/35"><div className="flex items-center gap-4 border-b border-border/60 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{moduleIndex + 1}</span><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{copy.common.module}</p><h3 className="font-semibold">{module.title}</h3></div></div><div className="divide-y divide-border/55">{module.lessons.map((lessonItem, lessonIndex) => { const TypeIcon = contentTypeIcon(lessonItem.type); const complete = courseState?.completedLessonIds?.includes(lessonItem.id); return <Link key={lessonItem.id} to={`/app/learn/course/${course.slug}/${module.id}/${lessonItem.slug}`} onClick={() => startCourse(course.id, lessonItem.id)} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-primary/5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${complete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground"}`}>{complete ? <Check className="h-4 w-4" /> : lessonIndex + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium transition group-hover:text-primary">{lessonItem.title}</p><p className="mt-1 text-xs text-muted-foreground">{copy.types[lessonItem.type] || copy.types.lesson}</p></div><span className="flex items-center gap-2 text-xs text-muted-foreground"><TypeIcon className="h-4 w-4" />{lessonItem.duration} min</span></Link>; })}</div></article>)}</div></section>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start"><div className="rounded-[22px] border border-border/70 bg-card/35 p-5"><h2 className="font-semibold">{copy.course.resources}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.course.officialDescription}</p></div><div className="rounded-[22px] border border-border/70 bg-card/35 p-5"><h2 className="font-semibold">{copy.course.assessments}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{interpolateLearningCopy(copy.course.lessonsCount, { count: lessons.filter((item) => ["quiz", "assessment"].includes(item.type)).length })}</p></div></aside>
      </div>

      {related.length ? <section className="mt-12"><h2 className="text-2xl font-semibold">{copy.course.related}</h2><div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{related.map((item) => <CourseCard key={item.id} course={{ ...item, categoryLabel: categoriesById[item.category]?.label }} copy={copy} locale={locale} progress={getCourseProgress(item.id)} saved={isSaved(item.id)} onToggleSaved={toggleSaved} />)}</div></section> : null}
    </div>
  );
};

export default LearningCoursePage;
