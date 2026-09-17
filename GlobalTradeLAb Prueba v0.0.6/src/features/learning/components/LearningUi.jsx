import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CandlestickChart,
  Check,
  PlayCircle,
  Clock3,
  Compass,
  FileQuestion,
  Globe2,
  GraduationCap,
  Landmark,
  Layers3,
  LineChart,
  PieChart,
  Search,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  ScanSearch,
  Video,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLearningDuration } from "@/features/learning/data/learningCatalog";
import { interpolateLearningCopy } from "@/features/learning/data/learningCopy";

const icons = {
  BookOpen,
  Brain,
  CandlestickChart,
  Compass,
  Globe2,
  GraduationCap,
  Landmark,
  Layers3,
  LineChart,
  PieChart,
  SearchCheck,
  ShieldCheck,
  TrendingUp,
  ScanSearch,
};

export const LearningIcon = ({ name, className }) => {
  const Icon = icons[name] || BookOpen;
  return <Icon className={className} aria-hidden="true" />;
};

export const SectionHeading = ({ eyebrow, title, description, action, className }) => (
  <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="max-w-2xl">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-[1.7rem]">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
    </div>
    {action}
  </div>
);

export const LearningProgress = ({ value, className }) => (
  <div className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)} aria-valuenow={value} aria-valuemin="0" aria-valuemax="100" role="progressbar">
    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
  </div>
);

export const LearningCover = ({ course, compact = false, className }) => (
  <div className={cn("relative overflow-hidden bg-gradient-to-br", course.accent, compact ? "h-28" : "aspect-video", className)}>
    <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(hsla(var(--foreground)/.13)_1px,transparent_1px),linear-gradient(90deg,hsla(var(--foreground)/.13)_1px,transparent_1px)] [background-size:28px_28px]" />
    <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-foreground/10" />
    <div className="absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
    <div className="relative flex h-full items-end justify-between p-5">
      <span className="rounded-2xl border border-foreground/10 bg-background/75 p-3 text-primary shadow-lg backdrop-blur">
        <LearningIcon name={course.icon} className="h-6 w-6" />
      </span>
      <span className="rounded-full border border-foreground/10 bg-background/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
        {course.type}
      </span>
    </div>
  </div>
);

export const CourseCard = ({ course, copy, locale, progress = 0, saved = false, onToggleSaved, className }) => {
  const level = copy.levels[course.level] || course.level;
  const coursePath = `/app/learn/course/${course.slug}`;

  return (
    <article className={cn("group flex h-full flex-col overflow-hidden rounded-[22px] border border-border/80 bg-card/55 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl", className)}>
      <Link to={coursePath} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <LearningCover course={{ ...course, type: copy.types[course.type] || course.type }} />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{course.categoryLabel}</span>
          <button
            type="button"
            onClick={() => onToggleSaved?.(course.id)}
            className={cn("rounded-full p-2 transition hover:bg-primary/10 hover:text-primary", saved ? "text-primary" : "text-muted-foreground")}
            aria-label={saved ? copy.actions.saved : copy.actions.save}
            title={saved ? copy.actions.saved : copy.actions.save}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
        <Link to={coursePath} className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-foreground transition group-hover:text-primary">
          {course.title}
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{course.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" />{level}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatLearningDuration(course.durationMinutes, locale)}</span>
        </div>
        <div className="mt-auto pt-5">
          {progress > 0 ? (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{copy.common.progress}</span><span className="font-semibold text-foreground">{progress}%</span></div>
              <LearningProgress value={progress} />
            </div>
          ) : (
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{course.rating}</span>
              <span>{new Intl.NumberFormat(locale).format(course.students)} {copy.common.students}</span>
            </div>
          )}
          <Button asChild variant="outline" className="w-full rounded-xl bg-background/50 group-hover:border-primary/40">
            <Link to={coursePath}>{progress > 0 ? copy.actions.continue : copy.actions.viewContent}<ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

export const PathCard = ({ path, copy, locale, progress, className }) => (
  <article className={cn("relative overflow-hidden rounded-[24px] border border-border/80 bg-card/45 p-6 transition hover:border-primary/35 hover:bg-card/70", className)}>
    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
    <div className="relative">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary"><LearningIcon name={path.icon} className="h-6 w-6" /></span>
        {path.certificate ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500"><Check className="h-3 w-3" />{copy.common.certificate}</span> : null}
      </div>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{copy.common.guidedPath}</p>
      <h3 className="mt-2 text-xl font-semibold text-foreground">{path.title}</h3>
      <p className="mt-2 min-h-[48px] text-sm leading-6 text-muted-foreground">{path.description}</p>
      <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{copy.levels[path.level]}</span><span>·</span><span>{formatLearningDuration(path.durationMinutes, locale)}</span><span>·</span><span>{interpolateLearningCopy(copy.paths.courses, { count: path.courseIds.length })}</span>
      </div>
      {progress > 0 ? <div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">{copy.common.progress}</span><span className="font-semibold">{progress}%</span></div><LearningProgress value={progress} /></div> : null}
      <Button asChild variant="ghost" className="mt-4 -ml-3 text-primary hover:bg-primary/10 hover:text-primary">
        <Link to={`/app/learn/paths/${path.slug}`}>{copy.actions.viewPath}<ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    </div>
  </article>
);

export const SearchField = ({ value, onChange, onSubmit, placeholder, ariaLabel, className }) => (
  <form onSubmit={onSubmit} className={cn("relative", className)} role="search">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="h-12 w-full rounded-2xl border border-border/80 bg-background/75 pl-11 pr-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
    />
  </form>
);

export const EmptyLearningState = ({ title, description, action }) => (
  <div className="rounded-[24px] border border-dashed border-border bg-card/25 px-6 py-14 text-center">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileQuestion className="h-6 w-6" /></span>
    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export const MetricCard = ({ icon, label, value, detail }) => (
  <div className="rounded-[20px] border border-border/70 bg-card/45 p-5">
    <div className="flex items-start justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><span className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</span></div>
    <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
    {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
  </div>
);

export const contentTypeIcon = (type) => {
  if (type === "video") return Video;
  if (type === "quiz" || type === "assessment") return FileQuestion;
  if (type === "practice") return PlayCircle;
  return BookOpen;
};

export const NewBadge = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"><Sparkles className="h-3 w-3" />{children}</span>
);
