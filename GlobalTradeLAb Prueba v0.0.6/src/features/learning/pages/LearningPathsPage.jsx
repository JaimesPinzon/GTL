import React from "react";
import { ArrowLeft, ArrowRight, Award, Check, Clock3, LockKeyhole } from "lucide-react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLearning } from "@/features/learning/context/LearningContext";
import { formatLearningDuration } from "@/features/learning/data/learningCatalog";
import { interpolateLearningCopy } from "@/features/learning/data/learningCopy";
import { LearningIcon, LearningProgress, PathCard, SectionHeading } from "@/features/learning/components/LearningUi";

const LearningPathsPage = () => {
  const { copy, catalog, locale } = useOutletContext();
  const { pathSlug } = useParams();
  const { getCourseProgress } = useLearning();
  const selectedPath = pathSlug ? catalog.paths.find((item) => item.slug === pathSlug) : null;
  const getPathProgress = (path) => Math.round(path.courseIds.reduce((sum, id) => sum + getCourseProgress(id), 0) / path.courseIds.length);

  if (selectedPath) {
    const selectedCourses = selectedPath.courseIds.map((id) => catalog.courses.find((course) => course.id === id)).filter(Boolean);
    const completedOrStarted = selectedCourses.filter((course) => getCourseProgress(course.id) > 0).length;
    const progress = getPathProgress(selectedPath);
    return (
      <div className="pb-10">
        <Button asChild variant="ghost" className="-ml-3 mb-6"><Link to="/app/learn/paths"><ArrowLeft className="mr-2 h-4 w-4" />{copy.actions.back}</Link></Button>
        <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-card/55 p-7 md:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative max-w-3xl"><span className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary"><LearningIcon name={selectedPath.icon} className="h-7 w-7" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{copy.paths.detailEyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] md:text-5xl">{selectedPath.title}</h1><p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">{selectedPath.description}</p><div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground"><span>{copy.levels[selectedPath.level]}</span><span>·</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{formatLearningDuration(selectedPath.durationMinutes, locale)}</span><span>·</span><span className="inline-flex items-center gap-1.5"><Award className="h-4 w-4" />{copy.common.certificate}</span></div>{progress > 0 ? <div className="mt-8 max-w-xl"><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">{interpolateLearningCopy(copy.paths.pathProgress, { completed: completedOrStarted, total: selectedCourses.length })}</span><span className="font-semibold">{progress}%</span></div><LearningProgress value={progress} /></div> : null}</div>
        </section>
        <section className="mt-10">
          <SectionHeading title={copy.paths.included} />
          <div className="relative mt-7 space-y-4 before:absolute before:bottom-10 before:left-6 before:top-10 before:w-px before:bg-border md:before:left-8">
            {selectedCourses.map((course, index) => {
              const courseProgress = getCourseProgress(course.id);
              const isComplete = courseProgress === 100;
              const isAvailable = index === 0 || getCourseProgress(selectedCourses[index - 1].id) > 0;
              const stageClass = isComplete
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : isAvailable
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground";
              const stageIcon = isComplete
                ? <Check className="h-5 w-5" />
                : isAvailable
                  ? <span className="text-sm font-semibold">{index + 1}</span>
                  : <LockKeyhole className="h-4 w-4" />;
              return (
                <article key={course.id} className="relative flex gap-4 md:gap-6">
                  <span className={`relative z-10 mt-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border md:h-16 md:w-16 ${stageClass}`}>{stageIcon}</span>
                  <div className="min-w-0 flex-1 rounded-[24px] border border-border/70 bg-card/40 p-5 md:p-6"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{interpolateLearningCopy(copy.paths.milestone, { number: index + 1 })}</p><div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-semibold">{course.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{course.description}</p></div><Button asChild variant={isAvailable ? "outline" : "ghost"} className="shrink-0 rounded-xl" disabled={!isAvailable}><Link to={isAvailable ? `/app/learn/course/${course.slug}` : "#"}>{courseProgress > 0 ? copy.actions.continue : copy.actions.viewContent}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>{courseProgress > 0 ? <div className="mt-5"><LearningProgress value={courseProgress} /></div> : null}</div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <SectionHeading eyebrow={copy.paths.eyebrow} title={copy.paths.title} description={copy.paths.description} />
      <div className="mt-7 grid gap-5 md:grid-cols-2">{catalog.paths.map((path) => <PathCard key={path.id} path={path} copy={copy} locale={locale} progress={getPathProgress(path)} />)}</div>
    </div>
  );
};

export default LearningPathsPage;
