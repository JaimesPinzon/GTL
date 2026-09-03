import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart2,
  CalendarClock,
  CheckCircle2,
  LayoutDashboard,
  LayoutGrid,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
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
import {
  autoAssignRoomGroups,
  createRoomGroup,
  fetchRoomActivities,
  fetchRoomGradebook,
  fetchRoomGroups,
  provisionRoomGroupPortfolios,
  upsertRoomGroupMember,
} from "@/lib/trading-db";

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
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [groupsPayload, setGroupsPayload] = useState({ groups: [], isStaff: false });
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isProvisioningPortfolios, setIsProvisioningPortfolios] = useState(false);
  const [selectedStudentsByGroup, setSelectedStudentsByGroup] = useState({});
  const [assigningGroupId, setAssigningGroupId] = useState(null);
  const [removingMemberKey, setRemovingMemberKey] = useState(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    maxMembers: "",
  });

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

  const activePortfoliosCount = useMemo(
    () => roomAccounts.filter((account) => (account.state || "").toLowerCase() === "active").length,
    [roomAccounts]
  );

  const overviewStats = useMemo(
    () => [
      { label: t("classes.stats.published"), value: activities.length },
      { label: t("classes.stats.submissions"), value: roomGrades.length },
      { label: t("classes.stats.activeMembers"), value: roomMembers.length },
      { label: t("classes.stats.activePortfolios"), value: activePortfoliosCount },
    ],
    [activePortfoliosCount, activities.length, roomGrades.length, roomMembers.length, t]
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

  const studentCandidates = useMemo(
    () => roomMembers.filter((member) => member.roleInRoom === "student"),
    [roomMembers]
  );

  const activeGroupByUserId = useMemo(() => {
    const lookup = {};
    for (const group of groupsPayload.groups) {
      const members = Array.isArray(group.members) ? group.members : [];
      for (const member of members) {
        if (String(member.state || "").toLowerCase() === "active") {
          lookup[member.user_id] = group.id;
        }
      }
    }
    return lookup;
  }, [groupsPayload.groups]);

  const resolveStudentDisplayName = useCallback((member) => {
    if (!member) {
      return "Estudiante";
    }

    const profile = member.profile || {};
    return (
      profile.name ||
      profile.alias ||
      profile.email ||
      member.userId ||
      member.user_id ||
      "Estudiante"
    );
  }, []);

  const loadRoomGroupsData = useCallback(async () => {
    if (!activeClass?.id || user?.role !== "teacher") {
      return;
    }

    setIsGroupsLoading(true);
    try {
      const payload = await fetchRoomGroups(activeClass.id);
      setGroupsPayload({
        groups: Array.isArray(payload?.groups) ? payload.groups : [],
        isStaff: Boolean(payload?.isStaff),
      });
    } catch (error) {
      toast({
        title: "No se pudieron cargar los grupos",
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsGroupsLoading(false);
    }
  }, [activeClass?.id, t, toast, user?.role]);

  useEffect(() => {
    if (!isGroupsModalOpen) {
      return;
    }

    void loadRoomGroupsData();
  }, [isGroupsModalOpen, loadRoomGroupsData]);

  const handleCreateGroup = async () => {
    if (!activeClass?.id) {
      return;
    }

    const normalizedName = String(groupForm.name || "").trim();
    if (!normalizedName) {
      toast({
        title: "Nombre requerido",
        description: "Escribe un nombre para el grupo.",
        variant: "destructive",
      });
      return;
    }

    const maxMembersInput = String(groupForm.maxMembers || "").trim();
    const maxMembers =
      maxMembersInput.length === 0 ? null : Number.parseInt(maxMembersInput, 10);
    if (maxMembersInput.length > 0 && (!Number.isFinite(maxMembers) || maxMembers <= 0)) {
      toast({
        title: "Cupo invalido",
        description: "El maximo de integrantes debe ser un numero mayor que cero.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingGroup(true);
    try {
      await createRoomGroup({
        roomId: activeClass.id,
        name: normalizedName,
        description: String(groupForm.description || "").trim(),
        maxMembers,
      });

      setGroupForm({ name: "", description: "", maxMembers: "" });
      toast({
        title: "Grupo creado",
        description: `El grupo ${normalizedName} ya esta disponible en la sala.`,
      });
      await loadRoomGroupsData();
    } catch (error) {
      toast({
        title: "No se pudo crear el grupo",
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAutoAssignGroups = async () => {
    if (!activeClass?.id) {
      return;
    }

    setIsAutoAssigning(true);
    try {
      const payload = await autoAssignRoomGroups({ roomId: activeClass.id });
      toast({
        title: "Asignacion completada",
        description: `Se asignaron ${payload?.assignedCount ?? 0} estudiantes.`,
      });
      await loadRoomGroupsData();
    } catch (error) {
      toast({
        title: "No se pudo autoasignar",
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleProvisionGroupPortfolios = async () => {
    if (!activeClass?.id) {
      return;
    }

    setIsProvisioningPortfolios(true);
    try {
      const payload = await provisionRoomGroupPortfolios({
        roomId: activeClass.id,
        replaceExisting: true,
      });
      toast({
        title: "Portafolios de grupo listos",
        description: `Se prepararon ${payload?.provisionedCount ?? 0} portafolios compartidos.`,
      });
    } catch (error) {
      toast({
        title: "No se pudieron preparar portafolios",
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsProvisioningPortfolios(false);
    }
  };

  const handleAssignStudentToGroup = async (groupId) => {
    if (!activeClass?.id || !groupId) {
      return;
    }

    const targetUserId = String(selectedStudentsByGroup[groupId] || "").trim();
    if (!targetUserId) {
      toast({
        title: "Selecciona un estudiante",
        description: "Debes elegir un estudiante para asignarlo al grupo.",
        variant: "destructive",
      });
      return;
    }

    const currentlyAssignedGroupId = activeGroupByUserId[targetUserId] || null;
    if (currentlyAssignedGroupId === groupId) {
      toast({
        title: "Sin cambios",
        description: "Ese estudiante ya pertenece a este grupo.",
      });
      return;
    }

    setAssigningGroupId(groupId);
    try {
      if (currentlyAssignedGroupId) {
        await upsertRoomGroupMember({
          roomId: activeClass.id,
          groupId: currentlyAssignedGroupId,
          userId: targetUserId,
          state: "removed",
          role: "member",
        });
      }

      await upsertRoomGroupMember({
        roomId: activeClass.id,
        groupId,
        userId: targetUserId,
        state: "active",
        role: "member",
      });

      setSelectedStudentsByGroup((previous) => ({
        ...previous,
        [groupId]: "",
      }));

      toast({
        title: currentlyAssignedGroupId ? "Estudiante movido" : "Estudiante asignado",
        description: currentlyAssignedGroupId
          ? "El estudiante fue movido al nuevo grupo."
          : "El estudiante ya quedo asignado al grupo.",
      });

      await loadRoomGroupsData();
    } catch (error) {
      toast({
        title: "No se pudo asignar",
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setAssigningGroupId(null);
    }
  };

  const handleRemoveMemberFromGroup = async (groupId, userId) => {
    if (!activeClass?.id || !groupId || !userId) {
      return;
    }

    const memberKey = `${groupId}:${userId}`;
    setRemovingMemberKey(memberKey);
    try {
      await upsertRoomGroupMember({
        roomId: activeClass.id,
        groupId,
        userId,
        state: "removed",
        role: "member",
      });

      toast({
        title: "Integrante removido",
        description: "El estudiante ya no pertenece a este grupo.",
      });
      await loadRoomGroupsData();
    } catch (error) {
      toast({
        title: "No se pudo remover",
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setRemovingMemberKey(null);
    }
  };

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

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-2xl border border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white"
                onClick={() => navigate(GLOBAL_APP_PATHS.classes)}
                aria-label={t("classes.actions.backToClasses")}
                title={t("classes.actions.backToClasses")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {user?.role === "teacher" ? (
                <Button
                  variant="ghost"
                  className="h-10 rounded-2xl border border-white/10 bg-transparent px-4 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  onClick={() => setIsGroupsModalOpen(true)}
                >
                  <Users className="mr-2 h-4 w-4" />
                  {t("classes.actions.formGroups")}
                </Button>
              ) : null}
            </div>
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

      {isGroupsModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[28px] border border-white/10 bg-[#101825] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Gestion de grupos</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{activeClass?.name}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Crea equipos de trabajo, autoasigna estudiantes y prepara portafolios colaborativos.
                </p>
              </div>
              <Button
                variant="ghost"
                className="rounded-2xl border border-white/10 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                onClick={() => setIsGroupsModalOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nuevo grupo</p>
                <div className="mt-3 space-y-3">
                  <Input
                    value={groupForm.name}
                    onChange={(event) =>
                      setGroupForm((previous) => ({ ...previous, name: event.target.value }))
                    }
                    placeholder="Nombre del grupo"
                    className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                  />
                  <Input
                    value={groupForm.description}
                    onChange={(event) =>
                      setGroupForm((previous) => ({ ...previous, description: event.target.value }))
                    }
                    placeholder="Descripcion (opcional)"
                    className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={groupForm.maxMembers}
                    onChange={(event) =>
                      setGroupForm((previous) => ({ ...previous, maxMembers: event.target.value }))
                    }
                    placeholder="Maximo de integrantes (opcional)"
                    className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                  />
                  <Button
                    className="h-10 w-full rounded-2xl"
                    onClick={handleCreateGroup}
                    disabled={isCreatingGroup}
                  >
                    {isCreatingGroup ? "Creando..." : "Crear grupo"}
                  </Button>
                </div>

                <div className="mt-5 space-y-2">
                  <Button
                    variant="ghost"
                    className="h-10 w-full rounded-2xl border border-white/10 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    onClick={handleAutoAssignGroups}
                    disabled={isAutoAssigning}
                  >
                    {isAutoAssigning ? "Asignando..." : "Autoasignar estudiantes"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 w-full rounded-2xl border border-white/10 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    onClick={handleProvisionGroupPortfolios}
                    disabled={isProvisioningPortfolios}
                  >
                    {isProvisioningPortfolios ? "Configurando..." : "Crear portafolios por grupo"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Grupos de la sala</p>
                  <Button
                    variant="ghost"
                    className="h-9 rounded-xl border border-white/10 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    onClick={loadRoomGroupsData}
                    disabled={isGroupsLoading}
                  >
                    {isGroupsLoading ? "Cargando..." : "Actualizar"}
                  </Button>
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {groupsPayload.groups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                      Aun no hay grupos creados en esta sala.
                    </div>
                  ) : (
                    groupsPayload.groups.map((group) => {
                      const members = Array.isArray(group.members) ? group.members : [];
                      const activeMembers = members.filter(
                        (member) => String(member.state || "").toLowerCase() === "active"
                      );
                      return (
                        <div key={group.id} className="rounded-2xl border border-white/10 bg-[#0b1220]/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-white">{group.name}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                                {group.state} | {activeMembers.length} miembros activos
                                {group.max_members ? ` / max ${group.max_members}` : ""}
                              </p>
                              {group.description ? (
                                <p className="mt-2 text-sm text-slate-400">{group.description}</p>
                              ) : null}
                            </div>
                          </div>

                          {groupsPayload.isStaff ? (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={selectedStudentsByGroup[group.id] || ""}
                                onChange={(event) =>
                                  setSelectedStudentsByGroup((previous) => ({
                                    ...previous,
                                    [group.id]: event.target.value,
                                  }))
                                }
                                className="h-10 flex-1 rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-slate-100"
                              >
                                <option value="">Seleccionar estudiante...</option>
                                {studentCandidates.map((student) => {
                                  const userId = student.userId;
                                  const assignedGroupId = activeGroupByUserId[userId] || null;
                                  const assignmentLabel =
                                    assignedGroupId && assignedGroupId !== group.id
                                      ? " (en otro grupo)"
                                      : assignedGroupId === group.id
                                      ? " (en este grupo)"
                                      : "";
                                  return (
                                    <option key={userId} value={userId}>
                                      {resolveStudentDisplayName(student)}
                                      {assignmentLabel}
                                    </option>
                                  );
                                })}
                              </select>
                              <Button
                                variant="ghost"
                                className="h-10 rounded-xl border border-white/10 px-4 text-slate-200 hover:bg-white/[0.05]"
                                onClick={() => handleAssignStudentToGroup(group.id)}
                                disabled={assigningGroupId === group.id}
                              >
                                {assigningGroupId === group.id ? "Asignando..." : "Asignar"}
                              </Button>
                            </div>
                          ) : null}

                          {activeMembers.length > 0 ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {activeMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-medium text-slate-200">
                                        {member?.profile?.name || member?.profile?.email || member.user_id}
                                      </p>
                                      <p className="mt-1 uppercase tracking-[0.12em] text-slate-500">
                                        {member.role} | {member.state}
                                      </p>
                                    </div>
                                    {groupsPayload.isStaff ? (
                                      <button
                                        type="button"
                                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-300 hover:bg-white/[0.06]"
                                        onClick={() => handleRemoveMemberFromGroup(group.id, member.user_id)}
                                        disabled={removingMemberKey === `${group.id}:${member.user_id}`}
                                      >
                                        {removingMemberKey === `${group.id}:${member.user_id}` ? "..." : "Quitar"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-500">Sin integrantes asignados todavia.</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ClassOverviewPage;
