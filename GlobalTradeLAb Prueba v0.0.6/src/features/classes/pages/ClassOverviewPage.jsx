import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart2, CalendarClock, CheckCircle2, FilePlus2, LayoutDashboard, PlusSquare, Search, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { CLASS_CONTEXT_PATHS, GLOBAL_APP_PATHS, buildClassRoute } from "@/lib/routes";
import { formatCurrency } from "@/lib/market-data";
import { fetchRoomActivities, fetchRoomGradebook } from "@/lib/trading-db";

const forumActivityTypes = new Set(["forum", "graded_discussion", "free_post"]);

const getActivityTypeLabels = (t) => ({
  forum: t("classes.activityTypes.forum"),
  report: t("classes.activityTypes.report"),
  asset_analysis: t("classes.activityTypes.assetAnalysis"),
  open_task: t("classes.activityTypes.openTask"),
  graded_discussion: t("classes.activityTypes.gradedDiscussion"),
  free_post: t("classes.activityTypes.freePost"),
});

const getActivityFilterOptions = (t) => [
  { id: "all", label: t("classes.filters.all") },
  { id: "gradable", label: t("classes.filters.gradable") },
  { id: "forum", label: t("classes.filters.forum") },
  { id: "task", label: t("classes.filters.task") },
];

const getTeacherRoomTabs = (t) => [
  { id: "summary", label: t("classes.tabs.summary") },
  { id: "students", label: t("classes.tabs.students") },
  { id: "activities", label: t("classes.tabs.activities") },
  { id: "portfolio", label: t("classes.tabs.portfolio") },
  { id: "ranking", label: t("classes.tabs.ranking") },
  { id: "grades", label: t("classes.tabs.grades") },
  { id: "audit", label: t("classes.tabs.audit") },
];

const getStudentRoomTabs = (t) => [
  { id: "summary", label: t("classes.tabs.summary") },
  { id: "activities", label: t("classes.tabs.activities") },
  { id: "portfolio", label: t("classes.tabs.portfolio") },
  { id: "ranking", label: t("classes.tabs.ranking") },
  { id: "grades", label: t("classes.tabs.myGrades") },
];

const getEmptyTeacherActivities = (t) => [
  {
    id: "teacher-empty",
    title: t("classes.empty.teacherTitle"),
    description: t("classes.empty.teacherDescription"),
    dueLabel: t("classes.empty.teacherDueLabel"),
    type: t("classes.empty.teacherType"),
  },
];

const getEmptyStudentActivities = (t) => [
  {
    id: "student-empty",
    title: t("classes.empty.studentTitle"),
    description: t("classes.empty.studentDescription"),
    dueLabel: t("classes.empty.studentDueLabel"),
    type: t("classes.empty.studentType"),
  },
];

const ClassOverviewPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeClass } = useClassContext();
  const { user, roomMembers, roomAccounts, studentsInClass } = useTradingContext();
  const activitiesSectionRef = useRef(null);
  const [activities, setActivities] = useState([]);
  const [roomGrades, setRoomGrades] = useState([]);
  const [activityQuery, setActivityQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");

  const activityTypeLabel = useMemo(() => getActivityTypeLabels(t), [t]);
  const activityFilterOptions = useMemo(() => getActivityFilterOptions(t), [t]);
  const roomTabs = useMemo(
    () => (user?.role === "teacher" ? getTeacherRoomTabs(t) : getStudentRoomTabs(t)),
    [t, user?.role]
  );
  const emptyActivities = useMemo(
    () => (user?.role === "teacher" ? getEmptyTeacherActivities(t) : getEmptyStudentActivities(t)),
    [t, user?.role]
  );

  useEffect(() => {
    let isMounted = true;

    const loadClassOverview = async () => {
      if (!activeClass?.id) {
        if (isMounted) {
          setActivities([]);
          setRoomGrades([]);
        }
        return;
      }

      try {
        const [roomActivities, gradebook] = await Promise.all([
          fetchRoomActivities(activeClass.id, user?.role || "student"),
          fetchRoomGradebook(activeClass.id),
        ]);

        if (!isMounted) {
          return;
        }

        setActivities(roomActivities);
        setRoomGrades(gradebook);
      } catch (error) {
        console.error("loadClassOverview error", error);
        if (isMounted) {
          toast({
            title: t("classes.toasts.loadActivitiesErrorTitle"),
            description: t("classes.toasts.tryAgain"),
            variant: "destructive",
          });
        }
      }
    };

    void loadClassOverview();

    return () => {
      isMounted = false;
    };
  }, [activeClass?.id, t, toast, user?.role]);

  const activityItems = useMemo(() => {
    if (activities.length === 0) {
      return emptyActivities;
    }

    return activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description || t("classes.common.activityWithoutDescription"),
      dueLabel: activity.closeAt ? new Date(activity.closeAt).toLocaleDateString() : t("classes.common.open"),
      type: activity.activityType,
      isGradable: activity.isGradable,
      state: activity.state,
    }));
  }, [activities, emptyActivities, t]);

  const visibleActivities = useMemo(() => {
    let filteredActivities = activityItems;

    if (activityFilter === "gradable") {
      filteredActivities = filteredActivities.filter((activity) => activity.isGradable);
    } else if (activityFilter === "forum") {
      filteredActivities = filteredActivities.filter((activity) => forumActivityTypes.has(activity.type));
    } else if (activityFilter === "task") {
      filteredActivities = filteredActivities.filter((activity) => !forumActivityTypes.has(activity.type));
    }

    if (!activityQuery.trim()) {
      return filteredActivities;
    }

    const normalized = activityQuery.trim().toLowerCase();
    return filteredActivities.filter(
      (activity) =>
        activity.title.toLowerCase().includes(normalized) ||
        activity.description.toLowerCase().includes(normalized) ||
        String(activity.type || "").toLowerCase().includes(normalized)
    );
  }, [activityFilter, activityItems, activityQuery]);

  const heroStats = useMemo(() => {
    const studentCount = user?.role === "teacher" ? studentsInClass.length : roomMembers.length;

    return [
      {
        label: t("classes.common.code"),
        value: activeClass?.accessCode || "—",
      },
      {
        label: user?.role === "teacher" ? t("classes.tabs.students") : t("classes.common.members"),
        value: studentCount,
      },
      {
        label: t("classes.common.baseBalance"),
        value: formatCurrency(activeClass?.defaultBalance || 0, activeClass?.defaultCurrency || "USD"),
      },
    ];
  }, [activeClass?.accessCode, activeClass?.defaultBalance, activeClass?.defaultCurrency, roomMembers.length, studentsInClass.length, t, user?.role]);

  const overviewStats = useMemo(
    () => [
      { label: t("classes.stats.published"), value: activities.length },
      { label: t("classes.stats.submissions"), value: roomGrades.length },
      { label: t("classes.stats.activeMembers"), value: roomMembers.length },
      { label: t("classes.stats.simulatedAccounts"), value: roomAccounts.length },
    ],
    [activities.length, roomAccounts.length, roomGrades.length, roomMembers.length, t]
  );

  const contextualLinks = useMemo(
    () =>
      activeClass?.id
        ? [
            {
              id: "dashboard",
              label: "Dashboard",
              icon: LayoutDashboard,
              path: buildClassRoute(activeClass.id, CLASS_CONTEXT_PATHS.dashboard),
            },
            {
              id: "markets",
              label: t("navigation.sidebar.markets"),
              icon: BarChart2,
              path: buildClassRoute(activeClass.id, CLASS_CONTEXT_PATHS.markets),
            },
          ]
        : [],
    [activeClass?.id, t]
  );

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <div className="sticky top-0 z-20 border-y border-white/8 bg-[#17191b]/96 shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex min-h-[64px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex min-w-0 items-center gap-3 px-1 py-2.5">
                <span className="truncate text-lg font-semibold text-white">{activeClass?.name}</span>
              </div>

              <div className="hidden h-9 w-px bg-white/10 lg:block" />

              <Button
                variant="ghost"
                className="h-10 rounded-xl px-3 text-slate-300 hover:bg-transparent hover:text-white"
                onClick={() => navigate(GLOBAL_APP_PATHS.classes)}
              >
                {t("classes.rooms.title")}
              </Button>

              <div className="hidden h-9 w-px bg-white/10 lg:block" />

              <div className="flex flex-wrap items-center gap-2">
                {contextualLinks.map((link) => {
                  const Icon = link.icon;

                  return (
                    <Button
                      key={link.id}
                      variant="ghost"
                      className="h-10 rounded-xl px-3 text-slate-300 hover:bg-transparent hover:text-white"
                      onClick={() => navigate(link.path)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {link.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {user?.role === "teacher" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  className="h-10 rounded-2xl border border-white/10 bg-transparent px-4 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  onClick={() => activitiesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  {t("classes.actions.createActivity")}
                </Button>
                <Button className="h-10 rounded-2xl px-4" onClick={() => navigate(GLOBAL_APP_PATHS.classes)}>
                  <PlusSquare className="mr-2 h-4 w-4" />
                  {t("classes.actions.createClass")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/8 bg-white/[0.02] pb-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.rooms.activeRoom")}</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">{activeClass?.name}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {activeClass?.description || t("classes.rooms.activeRoomDescriptionFallback")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                    <p className="mt-3 text-lg font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {roomTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    tab.id === "summary"
                      ? "bg-primary text-primary-foreground"
                      : "border border-white/10 bg-white/[0.03] text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card ref={activitiesSectionRef} className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/8 bg-white/[0.02] pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <CalendarClock className="h-6 w-6 text-primary" />
                  {t("classes.activities.pendingTitle")}
                </CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {user?.role === "teacher"
                    ? t("classes.activities.pendingTeacherDescription")
                    : t("classes.activities.pendingStudentDescription")}
                </p>
              </div>

              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={activityQuery}
                  onChange={(event) => setActivityQuery(event.target.value)}
                  placeholder={t("classes.placeholders.searchActivity")}
                  className="h-11 rounded-2xl border-white/10 bg-[#0b1220] pl-11 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              {activityFilterOptions.map((filterOption) => (
                <button
                  key={filterOption.id}
                  type="button"
                  onClick={() => setActivityFilter(filterOption.id)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activityFilter === filterOption.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-primary/20"
                  }`}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>

            {visibleActivities.map((activity) => (
              <div
                key={activity.id}
                className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:grid-cols-[160px_minmax(0,1fr)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    {activity.id.startsWith("teacher-empty") || activity.id.startsWith("student-empty") ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {activityTypeLabel[activity.type] || activity.type}
                    </p>
                    <p className="mt-1 font-medium text-slate-200">{activity.dueLabel}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{activity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{activity.description}</p>
                    </div>
                    {activity.state ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                        {activity.state}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {visibleActivities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                <div className="flex items-center gap-3">
                  <LayoutGrid className="h-4 w-4 text-slate-500" />
                  <span>{t("classes.overview.noFilteredActivities")}</span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClassOverviewPage;
