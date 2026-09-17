import React, { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CalendarClock, FileCheck2, GraduationCap, MessageSquare, Search, Users } from "lucide-react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ClassGroupsDialog from "@/features/classes/components/ClassGroupsDialog";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { useTradingContext } from "@/contexts/TradingContext";
import { CLASS_CONTEXT_PATHS, buildClassRoute } from "@/lib/routes";
import { fetchRoomActivities, fetchRoomGradebook } from "@/lib/trading-db";

const sections = [
  ["activities", CalendarClock],
  ["submissions", FileCheck2],
  ["forums", MessageSquare],
  ["grades", GraduationCap],
  ["students", Users],
];

const forumTypes = new Set(["forum", "graded_discussion", "free_post"]);

const EmptyModule = ({ icon: Icon, title, description }) => (
  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
    <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="h-6 w-6" /></div>
    <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
  </div>
);

const ClassAcademicPage = () => {
  const { t } = useTranslation();
  const { academicSection = "activities" } = useParams();
  const { activeClass } = useClassContext() || {};
  const { user, roomMembers, studentsInClass } = useTradingContext();
  const [activities, setActivities] = useState([]);
  const [grades, setGrades] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);

  const validSection = sections.some(([id]) => id === academicSection);

  useEffect(() => {
    if (!activeClass?.id || !validSection) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        if (["activities", "forums"].includes(academicSection)) {
          const rows = await fetchRoomActivities(activeClass.id, user?.role || "student");
          if (mounted) setActivities(rows);
        }
        if (academicSection === "grades") {
          const rows = await fetchRoomGradebook(activeClass.id);
          if (mounted) setGrades(rows);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [academicSection, activeClass?.id, user?.role, validSection]);

  const visibleActivities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activities.filter((activity) => {
      if (academicSection === "forums" && !forumTypes.has(activity.activityType)) return false;
      if (!normalized) return true;
      return `${activity.title} ${activity.description || ""}`.toLowerCase().includes(normalized);
    });
  }, [academicSection, activities, query]);

  const students = user?.role === "teacher"
    ? studentsInClass
    : roomMembers.filter((member) => member.roleInRoom === "student");

  if (!validSection) {
    return <Navigate to={buildClassRoute(activeClass.id, CLASS_CONTEXT_PATHS.academicActivities)} replace />;
  }

  const renderContent = () => {
    if (academicSection === "submissions") {
      return <EmptyModule icon={FileCheck2} title={t("classes.workspace.academic.submissionsEmptyTitle")} description={t("classes.workspace.academic.submissionsEmptyDescription")} />;
    }

    if (academicSection === "students") {
      return (
        <div className="rounded-[24px] border border-white/8 bg-white/[0.025]">
          <div className="flex flex-col justify-between gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold text-white">{t("classes.workspace.academic.students")}</h3>
              <p className="mt-1 text-sm text-slate-400">{students.length} {t("classes.workspace.academic.registeredStudents")}</p>
            </div>
            {user?.role === "teacher" ? <Button onClick={() => setGroupsOpen(true)}><Users className="mr-2 h-4 w-4" />{t("classes.actions.formGroups")}</Button> : null}
          </div>
          {students.length ? (
            <div className="divide-y divide-white/8">
              {students.map((student) => (
                <div key={student.id || student.userId} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{student.name || student.profile?.name || student.profile?.email || t("classes.common.student")}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{student.email || student.profile?.email || t("classes.common.noVisibleEmail")}</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/8 px-3 py-1 text-xs text-emerald-300">{t("classes.common.active")}</span>
                </div>
              ))}
            </div>
          ) : <EmptyModule icon={Users} title={t("classes.workspace.academic.noStudentsTitle")} description={t("classes.workspace.academic.noStudentsDescription")} />}
        </div>
      );
    }

    if (academicSection === "grades") {
      return grades.length ? (
        <div className="overflow-x-auto rounded-[24px] border border-white/8 bg-white/[0.025]">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-white/8 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr><th className="px-5 py-4">{t("classes.workspace.academic.student")}</th><th className="px-5 py-4">{t("classes.workspace.academic.activity")}</th><th className="px-5 py-4">{t("classes.workspace.academic.grade")}</th><th className="px-5 py-4">{t("classes.workspace.academic.feedback")}</th></tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {grades.map((grade) => <tr key={grade.id}><td className="px-5 py-4 font-medium text-white">{grade.profile?.name || grade.profile?.email || t("classes.common.student")}</td><td className="px-5 py-4 text-slate-300">{grade.activity?.title || "—"}</td><td className="px-5 py-4 text-primary">{grade.score}{grade.activity?.maxScore ? ` / ${grade.activity.maxScore}` : ""}</td><td className="px-5 py-4 text-slate-400">{grade.feedback || "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <EmptyModule icon={GraduationCap} title={t("classes.workspace.academic.noGradesTitle")} description={t("classes.workspace.academic.noGradesDescription")} />;
    }

    const isForum = academicSection === "forums";
    const Icon = isForum ? MessageSquare : CalendarClock;
    return (
      <div className="rounded-[24px] border border-white/8 bg-white/[0.025]">
        <div className="flex flex-col justify-between gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold text-white">{t(`classes.workspace.academic.${academicSection}`)}</h3>
            <p className="mt-1 text-sm text-slate-400">{t(`classes.workspace.academic.${academicSection}Description`)}</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder={t("classes.placeholders.searchActivity")} />
          </div>
        </div>
        {loading ? <div className="p-8 text-sm text-slate-400">{t("common.states.loading")}</div> : visibleActivities.length ? (
          <div className="divide-y divide-white/8">
            {visibleActivities.map((activity) => (
              <article key={activity.id} className="flex gap-4 p-5">
                <div className="h-fit rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0"><h4 className="font-semibold text-white">{activity.title}</h4><p className="mt-1 text-sm leading-6 text-slate-400">{activity.description || t("classes.common.activityWithoutDescription")}</p><p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">{activity.state || t("classes.common.open")}</p></div>
              </article>
            ))}
          </div>
        ) : <EmptyModule icon={Icon} title={isForum ? t("classes.workspace.academic.noForumsTitle") : t("classes.empty.studentTitle")} description={isForum ? t("classes.workspace.academic.noForumsDescription") : t("classes.empty.studentDescription")} />}
      </div>
    );
  };

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1520px] p-4 md:p-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><BookOpenCheck className="h-4 w-4" />{t("classes.workspace.academic.eyebrow")}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{t("classes.workspace.academic.title")}</h2>
          <p className="mt-2 text-sm text-slate-400">{t("classes.workspace.academic.description")}</p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="scrollbar-page flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label={t("classes.workspace.academic.navigationAriaLabel") }>
            {sections.map(([id, Icon]) => (
              <NavLink key={id} to={buildClassRoute(activeClass.id, `${CLASS_CONTEXT_PATHS.academic}/${id}`)} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${isActive ? "bg-primary/12 text-primary" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}>
                <Icon className="h-4 w-4" />{t(`classes.workspace.academic.${id}`)}
              </NavLink>
            ))}
          </nav>
          <main className="min-w-0">{renderContent()}</main>
        </div>
      </div>
      <ClassGroupsDialog open={groupsOpen} onClose={() => setGroupsOpen(false)} />
    </div>
  );
};

export default ClassAcademicPage;
