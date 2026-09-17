import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, FlaskConical, Lightbulb, ListTree, Menu, X } from "lucide-react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { useLearning } from "@/features/learning/context/LearningContext";
import { flattenCourseLessons } from "@/features/learning/data/learningCatalog";
import { interpolateLearningCopy } from "@/features/learning/data/learningCopy";
import { EmptyLearningState, LearningProgress } from "@/features/learning/components/LearningUi";
import { CLASS_CONTEXT_PATHS, GLOBAL_APP_PATHS, buildClassRoute } from "@/lib/routes";

const LearningLessonPage = () => {
  const { copy, catalog } = useOutletContext();
  const { courseSlug, moduleSlug, lessonSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeClassId } = useClassContext() || {};
  const { completeLesson, getCourseState, getCourseProgress, startCourse } = useLearning();
  const [indexOpen, setIndexOpen] = useState(true);
  const course = catalog.courses.find((item) => item.slug === courseSlug);
  const module = course?.modules.find((item) => item.id === moduleSlug);
  const lesson = module?.lessons.find((item) => item.slug === lessonSlug);
  const lessons = useMemo(() => flattenCourseLessons(course), [course]);
  const lessonIndex = lessons.findIndex((item) => item.id === lesson?.id);
  const previousLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 && lessonIndex < lessons.length - 1 ? lessons[lessonIndex + 1] : null;
  const courseState = course ? getCourseState(course.id) : null;
  const complete = Boolean(courseState?.completedLessonIds?.includes(lesson?.id));
  const progress = course ? getCourseProgress(course.id) : 0;

  useEffect(() => {
    if (course && lesson) startCourse(course.id, lesson.id);
  }, [course, lesson, startCourse]);

  if (!course || !module || !lesson) return <EmptyLearningState title={copy.lesson.notFound} description={copy.explore.noResultsHint} action={<Button asChild><Link to="/app/learn/explore">{copy.actions.back}</Link></Button>} />;

  const lessonPath = (item) => `/app/learn/course/${course.slug}/${item.moduleId}/${item.slug}`;
  const handleComplete = () => {
    completeLesson(course.id, lesson.id);
    toast({ title: copy.actions.completed, description: copy.lesson.savedProgress });
  };
  const handlePractice = () => navigate(activeClassId ? buildClassRoute(activeClassId, CLASS_CONTEXT_PATHS.markets) : GLOBAL_APP_PATHS.classes);

  return (
    <div className="-mx-4 -my-7 min-h-[calc(100vh-130px)] md:-mx-7 md:-my-9">
      <div className="border-b border-border/70 bg-card/35 px-4 py-4 md:px-7"><div className="flex flex-wrap items-center justify-between gap-4"><Button asChild variant="ghost" className="-ml-3"><Link to={`/app/learn/course/${course.slug}`}><ArrowLeft className="mr-2 h-4 w-4" />{copy.actions.backCourse}</Link></Button><div className="flex min-w-[220px] flex-1 items-center justify-end gap-3 md:max-w-md"><LearningProgress value={progress} className="max-w-xs" /><span className="text-sm font-semibold">{progress}%</span><Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => setIndexOpen((value) => !value)} aria-label={copy.actions.courseContents} title={copy.actions.courseContents}>{indexOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</Button></div></div></div>
      <div className={`grid min-h-[calc(100vh-195px)] ${indexOpen ? "xl:grid-cols-[minmax(0,1fr)_330px]" : "grid-cols-1"}`}>
        <main className="min-w-0 px-5 py-8 md:px-10 lg:px-[8vw] lg:py-12">
          <article className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><span>{module.title}</span><span>·</span><span>{interpolateLearningCopy(copy.lesson.readingTime, { duration: lesson.duration })}</span></div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{lesson.title}</h1>
            <div className="mt-9 space-y-7">
              {lesson.blocks.map((block, index) => {
                if (block.type === "lead") return <p key={index} className="text-xl leading-8 text-foreground/90">{block.text}</p>;
                if (block.type === "heading") return <h2 key={index} className="pt-3 text-2xl font-semibold tracking-tight">{block.text}</h2>;
                if (block.type === "text") return <p key={index} className="text-base leading-8 text-muted-foreground">{block.text}</p>;
                if (block.type === "note") return <aside key={index} className="rounded-[22px] border border-sky-500/20 bg-sky-500/10 p-5"><div className="flex gap-4"><span className="mt-0.5 rounded-xl bg-sky-500/10 p-2 text-sky-500"><Lightbulb className="h-5 w-5" /></span><div><h3 className="font-semibold">{block.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{block.text}</p></div></div></aside>;
                if (block.type === "example") return <aside key={index} className="rounded-[22px] border border-amber-500/20 bg-amber-500/10 p-5"><div className="flex gap-4"><span className="mt-0.5 rounded-xl bg-amber-500/10 p-2 text-amber-500"><AlertTriangle className="h-5 w-5" /></span><div><h3 className="font-semibold">{block.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{block.text}</p></div></div></aside>;
                if (block.type === "practice") return <aside key={index} className="relative overflow-hidden rounded-[24px] border border-primary/25 bg-primary/10 p-6"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-4"><span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><FlaskConical className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{copy.lesson.practiceLabel}</p><h3 className="mt-1 font-semibold">{block.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{activeClassId ? block.text : copy.lesson.practiceNoClass}</p></div></div><Button type="button" className="shrink-0 rounded-xl" onClick={handlePractice}>{copy.actions.openMarket}<ArrowRight className="ml-2 h-4 w-4" /></Button></div></aside>;
                return null;
              })}
            </div>
            <div className="mt-12 flex flex-col gap-4 border-t border-border/70 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <div>{previousLesson ? <Button asChild variant="outline" className="rounded-xl"><Link to={lessonPath(previousLesson)}><ChevronLeft className="mr-2 h-4 w-4" />{copy.actions.previous}</Link></Button> : null}</div>
              <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant={complete ? "outline" : "default"} className="rounded-xl" onClick={handleComplete} disabled={complete}>{complete ? <Check className="mr-2 h-4 w-4" /> : <BookOpen className="mr-2 h-4 w-4" />}{complete ? copy.actions.completed : copy.actions.complete}</Button>{nextLesson ? <Button asChild variant="outline" className="rounded-xl"><Link to={lessonPath(nextLesson)}>{copy.actions.next}<ChevronRight className="ml-2 h-4 w-4" /></Link></Button> : null}</div>
            </div>
          </article>
        </main>

        {indexOpen ? <aside className="border-t border-border/70 bg-card/30 xl:border-l xl:border-t-0"><div className="sticky top-[73px] max-h-[calc(100vh-130px)] overflow-y-auto p-5"><div className="mb-5 flex items-center gap-2"><ListTree className="h-4 w-4 text-primary" /><h2 className="font-semibold">{copy.lesson.index}</h2></div><div className="space-y-5">{course.modules.map((moduleItem) => <section key={moduleItem.id}><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{moduleItem.title}</p><div className="space-y-1">{moduleItem.lessons.map((item) => { const isCurrent = item.id === lesson.id; const isComplete = courseState?.completedLessonIds?.includes(item.id); return <Link key={item.id} to={`/app/learn/course/${course.slug}/${moduleItem.id}/${item.slug}`} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isCurrent ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${isComplete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : isCurrent ? "border-primary/40" : "border-border"}`}>{isComplete ? <Check className="h-3 w-3" /> : null}</span><span>{item.title}</span></Link>; })}</div></section>)}</div></div></aside> : null}
      </div>
    </div>
  );
};

export default LearningLessonPage;
