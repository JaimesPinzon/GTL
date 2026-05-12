import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  FilePlus2,
  GraduationCap,
  LayoutGrid,
  MoreHorizontal,
  PlusSquare,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/market-data";
import { buildClassEditRoute } from "@/lib/routes";
import {
  createActivityPost,
  createRoomActivity,
  fetchActivityGrades,
  fetchActivityPosts,
  fetchActivitySubmission,
  fetchActivitySubmissions,
  fetchRoomBalanceAdjustments,
  fetchRoomGradebook,
  fetchRoomActivities,
  uploadActivityAttachment,
  updateRoomActivityState,
  upsertActivityGrade,
  upsertActivitySubmission,
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

const getActivityDetailTabs = (t) => [
  { id: "overview", label: t("classes.tabs.summary") },
  { id: "work", label: t("classes.tabs.participation") },
  { id: "review", label: t("classes.tabs.review") },
];

const roomAccent = (index) => {
  if (index % 3 === 0) {
    return "bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.32),_transparent_42%),linear-gradient(135deg,_rgba(59,130,246,0.24),_rgba(10,20,35,0.2))]";
  }

  if (index % 3 === 1) {
    return "bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.30),_transparent_38%),linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(10,20,35,0.18))]";
  }

  return "bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.28),_transparent_40%),linear-gradient(135deg,_rgba(236,72,153,0.2),_rgba(10,20,35,0.18))]";
};

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

const BalanceAdjustmentCard = ({ student, isOpen, onClose, onSubmit, isSubmitting, t }) => {
  const [adjustmentType, setAdjustmentType] = useState("top_up");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAdjustmentType("top_up");
      setAmount("");
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen || !student) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[73] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#101723] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.adjustment.title")}</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{student.name || student.email || t("classes.common.student")}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {t("classes.adjustment.description")}
            </p>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "top_up", label: t("classes.adjustment.types.topUp") },
              { value: "discount", label: t("classes.adjustment.types.discount") },
              { value: "reset", label: t("classes.adjustment.types.reset") },
              { value: "correction", label: t("classes.adjustment.types.correction") },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                  adjustmentType === option.value
                    ? "border-primary/35 bg-primary/12 text-primary"
                    : "border-white/10 bg-white/[0.03] text-slate-300"
                }`}
                onClick={() => setAdjustmentType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={adjustmentType === "reset" ? t("classes.adjustment.newBalancePlaceholder") : t("classes.adjustment.amountPlaceholder")}
            className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
          />

          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder={t("classes.adjustment.reasonPlaceholder")}
            className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={() => onSubmit({ adjustmentType, amount, reason })} disabled={isSubmitting}>
            {isSubmitting ? t("classes.common.saving") : t("classes.adjustment.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

const StudentDetailCard = ({ student, isOpen, onClose, t }) => {
  if (!isOpen || !student) {
    return null;
  }

  const latestTransactions = [...(student.transactions || [])]
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 8);

  return (
    <div className="fixed inset-0 z-[73] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[28px] border border-white/10 bg-[#101723] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.studentDetail.title")}</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{student.name || student.email || t("classes.common.student")}</h3>
            <p className="mt-2 text-sm text-slate-400">{student.email || t("classes.common.noVisibleEmail")}</p>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.common.balance")}</p>
            <p className="mt-3 text-xl font-semibold text-white">{formatCurrency(student.balance || 0, "USD")}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.common.positions")}</p>
            <p className="mt-3 text-xl font-semibold text-white">{student.positions?.length || 0}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.common.movements")}</p>
            <p className="mt-3 text-xl font-semibold text-white">{student.transactions?.length || 0}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.studentDetail.simulatedAccount")}</p>
            <p className="mt-3 text-xl font-semibold text-white">{student.roomAccount?.currency || "USD"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[24px] border border-white/8 bg-[#0b1220] p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{t("trading.positions.title")}</h4>
            <div className="mt-4 space-y-3">
              {student.positions?.length ? (
                student.positions.map((position) => (
                  <div key={position.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{position.symbol}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{position.type}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {t("classes.studentDetail.positionSummary", {
                        amount: formatCurrency(position.amount || 0, "USD"),
                        entryPrice: formatCurrency(position.entryPrice || 0, "USD"),
                      })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                  {t("classes.studentDetail.noOpenPositions")}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#0b1220] p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{t("classes.studentDetail.latestTransactions")}</h4>
            <div className="mt-4 space-y-3">
              {latestTransactions.length ? (
                latestTransactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{transaction.symbol}</p>
                      <p className="text-xs text-slate-500">{formatDate(transaction.date)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {t("classes.studentDetail.transactionSummary", {
                        type: transaction.type,
                        amount: formatCurrency(transaction.amount || 0, "USD"),
                      })}
                    </p>
                    {transaction.justification ? (
                      <p className="mt-2 text-sm leading-6 text-slate-500">{transaction.justification}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                  {t("classes.studentDetail.noTransactions")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClassesPanel = () => {
  const { t } = useTranslation();
  const {
    user,
    rooms: contextRooms,
    activeRoom,
    activeRoomId,
    selectRoom,
    getCurrentPrice,
    roomMembers,
    roomAccounts,
    roomPortfolios,
    studentsInClass,
    positions,
    transactions,
    balance,
    adjustStudentBalance,
    createRoomForUser,
    joinRoomWithCode,
  } = useTradingContext();
  const { selectActiveClass } = useClassContext() || {};
  const { toast } = useToast();
  const navigate = useNavigate();
  const activityTypeLabel = useMemo(() => getActivityTypeLabels(t), [t]);
  const activityFilterOptions = useMemo(() => getActivityFilterOptions(t), [t]);
  const teacherRoomTabs = useMemo(() => getTeacherRoomTabs(t), [t]);
  const studentRoomTabs = useMemo(() => getStudentRoomTabs(t), [t]);
  const activityDetailTabs = useMemo(() => getActivityDetailTabs(t), [t]);
  const emptyTeacherActivities = useMemo(() => getEmptyTeacherActivities(t), [t]);
  const emptyStudentActivities = useMemo(() => getEmptyStudentActivities(t), [t]);
  const [copiedCode, setCopiedCode] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateActivityOpen, setIsCreateActivityOpen] = useState(false);
  const [isActivityDetailOpen, setIsActivityDetailOpen] = useState(false);
  const [activityDetailTab, setActivityDetailTab] = useState("overview");
  const [activityQuery, setActivityQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activeRoomTab, setActiveRoomTab] = useState("summary");
  const [roomQuery, setRoomQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activityPosts, setActivityPosts] = useState([]);
  const [activitySubmissions, setActivitySubmissions] = useState([]);
  const [activityGrades, setActivityGrades] = useState([]);
  const [roomGrades, setRoomGrades] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [mySubmission, setMySubmission] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postAttachment, setPostAttachment] = useState(null);
  const [submissionDraft, setSubmissionDraft] = useState("");
  const [submissionAttachment, setSubmissionAttachment] = useState(null);
  const [gradeDrafts, setGradeDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isStudentDetailOpen, setIsStudentDetailOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
  });
  const [activityForm, setActivityForm] = useState({
    title: "",
    description: "",
    activityType: "asset_analysis",
    isGradable: true,
    maxScore: "5",
    referencedAssetSymbol: "",
  });

  useEffect(() => {
    setIsLoadingRooms(false);
  }, [contextRooms]);

  useEffect(() => {
    let isMounted = true;

    const loadActivities = async () => {
      if (!activeRoomId) {
        setActivities([]);
        setRoomGrades([]);
        setAuditRows([]);
        return;
      }

      try {
        const [roomActivities, gradebook, adjustments] = await Promise.all([
          fetchRoomActivities(activeRoomId, user?.role || "student"),
          fetchRoomGradebook(activeRoomId),
          user?.role === "teacher" ? fetchRoomBalanceAdjustments(activeRoomId) : Promise.resolve([]),
        ]);
        if (isMounted) {
          setActivities(roomActivities);
          setRoomGrades(gradebook);
          setAuditRows(adjustments);
        }
      } catch (error) {
        console.error("loadActivities error", error);
        if (isMounted) {
          toast({
            title: t("classes.toasts.loadActivitiesErrorTitle"),
            description: t("classes.toasts.tryAgain"),
            variant: "destructive",
          });
        }
      }
    };

    loadActivities();

    return () => {
      isMounted = false;
    };
  }, [activeRoomId, toast, user?.role]);

  const activityItems = useMemo(() => {
    if (activities.length === 0) {
      return user?.role === "teacher" ? emptyTeacherActivities : emptyStudentActivities;
    }

    return activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description || t("classes.common.activityWithoutDescription"),
      dueLabel: activity.closeAt ? new Date(activity.closeAt).toLocaleDateString() : t("classes.common.open"),
      type: activity.activityType,
      isGradable: activity.isGradable,
    }));
  }, [activities, user]);

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
        activity.type.toLowerCase().includes(normalized)
    );
  }, [activityFilter, activityItems, activityQuery]);

  const forumRootPosts = useMemo(
    () => activityPosts.filter((post) => !post.parentPostId),
    [activityPosts]
  );

  const activityStats = useMemo(() => {
    const total = activities.length;
    const gradable = activities.filter((activity) => activity.isGradable).length;
    const open = activities.filter((activity) => activity.state === "published").length;
    const gradeSource = user?.role === "teacher" ? roomGrades : roomGrades.filter((grade) => grade.userId === user?.id);

    return [
      { label: t("classes.stats.activities"), value: total },
      { label: user?.role === "teacher" ? t("classes.stats.gradable") : t("classes.stats.pending"), value: user?.role === "teacher" ? gradable : open },
      { label: user?.role === "teacher" ? t("classes.stats.open") : t("classes.stats.myGrades"), value: user?.role === "teacher" ? open : gradeSource.length },
      {
        label: user?.role === "teacher" ? t("classes.stats.grades") : t("classes.stats.average"),
        value:
          user?.role === "teacher"
            ? roomGrades.length
            : gradeSource.length > 0
              ? (gradeSource.reduce((sum, grade) => sum + grade.score, 0) / gradeSource.length).toFixed(2)
              : "0.00",
      },
    ];
  }, [activities, roomGrades, user]);

  const gradeTargets = useMemo(() => {
    if (!selectedActivity) {
      return [];
    }

    if (forumActivityTypes.has(selectedActivity.activityType)) {
      const uniquePosts = new Map();
      activityPosts.forEach((post) => {
        if (!uniquePosts.has(post.userId)) {
          uniquePosts.set(post.userId, {
            userId: post.userId,
            profile: post.profile,
            lastContent: post.content,
            lastCreatedAt: post.createdAt,
          });
        } else {
          uniquePosts.set(post.userId, {
            ...uniquePosts.get(post.userId),
            lastContent: post.content,
            lastCreatedAt: post.createdAt,
          });
        }
      });
      return Array.from(uniquePosts.values());
    }

    return activitySubmissions.map((submission) => ({
      userId: submission.userId,
      profile: submission.profile,
      lastContent: submission.contentText,
      lastCreatedAt: submission.submittedAt || submission.updatedAt,
      state: submission.state,
    }));
  }, [activityPosts, activitySubmissions, selectedActivity]);

  const visibleRooms = useMemo(() => {
    if (!roomQuery.trim()) {
      return contextRooms || [];
    }

    const normalized = roomQuery.trim().toLowerCase();
    return (contextRooms || []).filter(
      (room) =>
        room.name.toLowerCase().includes(normalized) ||
        room.description.toLowerCase().includes(normalized) ||
        room.accessCode.toLowerCase().includes(normalized)
    );
  }, [contextRooms, roomQuery]);

  const loadActivityDetail = async (activity) => {
    setSelectedActivity(activity);
    setIsActivityDetailOpen(true);
    setActivityDetailTab("overview");
    setDetailLoading(true);

    try {
      const [posts, submissions, grades, submission] = await Promise.all([
        fetchActivityPosts(activity.id),
        fetchActivitySubmissions(activity.id),
        fetchActivityGrades(activity.id),
        user?.id ? fetchActivitySubmission(activity.id, user.id) : Promise.resolve(null),
      ]);

      setActivityPosts(posts);
      setActivitySubmissions(submissions);
      setActivityGrades(grades);
      setMySubmission(submission);
      setSubmissionDraft(submission?.contentText || "");
      setPostDraft("");
      setPostAttachment(null);
      setSubmissionAttachment(null);
      setReplyDrafts({});
      setGradeDrafts(
        grades.reduce((accumulator, grade) => {
          accumulator[grade.userId] = {
            score: String(grade.score ?? ""),
            feedback: grade.feedback || "",
          };
          return accumulator;
        }, {})
      );
    } catch (error) {
      console.error("loadActivityDetail error", error);
      toast({
        title: t("classes.toasts.openActivityErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
      setIsActivityDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyCode = async (accessCode) => {
    await navigator.clipboard.writeText(accessCode);
    setCopiedCode(accessCode);
    toast({
      title: t("classes.toasts.codeCopiedTitle"),
      description: t("classes.toasts.codeCopiedDescription"),
    });
    window.setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleCreateRoom = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: t("classes.toasts.roomNameRequiredTitle"),
        description: t("classes.toasts.roomNameRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const newRoom = await createRoomForUser({
        name: createForm.name,
        description: createForm.description,
      });

      setCreateForm({ name: "", description: "" });
      setIsCreateModalOpen(false);
      toast({
        title: t("classes.toasts.roomCreatedTitle"),
        description: t("classes.toasts.roomCreatedDescription", { code: newRoom.accessCode, name: newRoom.name }),
      });
    } catch (error) {
      console.error("handleCreateRoom error", error);
      toast({
        title: t("classes.toasts.roomCreateErrorTitle"),
        description: error instanceof Error ? error.message : t("classes.toasts.reviewData"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim() || !user?.id) {
      toast({
        title: t("classes.toasts.codeRequiredTitle"),
        description: t("classes.toasts.codeRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const joinedRoom = await joinRoomWithCode({
        accessCode: joinCode,
      });

      setJoinCode("");
      toast({
        title: t("classes.toasts.roomJoinedTitle"),
        description: t("classes.toasts.roomJoinedDescription", { name: joinedRoom.name }),
      });
    } catch (error) {
      console.error("handleJoinRoom error", error);
      toast({
        title: t("classes.toasts.roomJoinErrorTitle"),
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!activeRoomId || !user?.id) {
      toast({
        title: t("classes.toasts.roomRequiredTitle"),
        description: t("classes.toasts.roomRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!activityForm.title.trim()) {
      toast({
        title: t("classes.toasts.activityTitleRequiredTitle"),
        description: t("classes.toasts.activityTitleRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newActivity = await createRoomActivity({
        roomId: activeRoomId,
        createdBy: user.id,
        title: activityForm.title,
        description: activityForm.description,
        activityType: activityForm.activityType,
        isGradable: activityForm.isGradable,
        maxScore: activityForm.maxScore,
        referencedAssetSymbol: activityForm.referencedAssetSymbol,
      });

      setActivities((previous) => [newActivity, ...previous]);
      setActivityForm({
        title: "",
        description: "",
        activityType: "asset_analysis",
        isGradable: true,
        maxScore: "5",
        referencedAssetSymbol: "",
      });
      setIsCreateActivityOpen(false);
      toast({
        title: t("classes.toasts.activityPublishedTitle"),
        description: t("classes.toasts.activityPublishedDescription", { title: newActivity.title }),
      });
    } catch (error) {
      console.error("handleCreateActivity error", error);
      toast({
        title: t("classes.toasts.activityCreateErrorTitle"),
        description: t("classes.toasts.reviewData"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishPost = async () => {
    if (!selectedActivity || !user?.id || !postDraft.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const attachmentPayload = await uploadActivityAttachment({
        file: postAttachment,
        roomId: activeRoomId,
        activityId: selectedActivity.id,
        userId: user.id,
      });
      const createdPost = await createActivityPost({
        activityId: selectedActivity.id,
        userId: user.id,
        content: postDraft,
        fileUrl: attachmentPayload,
      });

      setActivityPosts((previous) => [...previous, createdPost]);
      setPostDraft("");
      setPostAttachment(null);
      toast({
        title: t("classes.toasts.participationPublishedTitle"),
        description: t("classes.toasts.participationPublishedDescription"),
      });
    } catch (error) {
      console.error("handlePublishPost error", error);
      toast({
        title: t("classes.toasts.publishErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishReply = async (parentPostId) => {
    if (!selectedActivity || !user?.id || !(replyDrafts[parentPostId] || "").trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const createdReply = await createActivityPost({
        activityId: selectedActivity.id,
        userId: user.id,
        content: replyDrafts[parentPostId],
        parentPostId,
      });

      setActivityPosts((previous) => [...previous, createdReply]);
      setReplyDrafts((previous) => ({ ...previous, [parentPostId]: "" }));
      toast({
        title: t("classes.toasts.replyPublishedTitle"),
        description: t("classes.toasts.replyPublishedDescription"),
      });
    } catch (error) {
      console.error("handlePublishReply error", error);
      toast({
        title: t("classes.toasts.replyErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitActivity = async () => {
    if (!selectedActivity || !user?.id || !submissionDraft.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const attachmentPayload = await uploadActivityAttachment({
        file: submissionAttachment,
        roomId: activeRoomId,
        activityId: selectedActivity.id,
        userId: user.id,
      });
      const nextSubmission = await upsertActivitySubmission({
        activityId: selectedActivity.id,
        userId: user.id,
        contentText: submissionDraft,
        fileUrl: attachmentPayload,
        state: "submitted",
      });

      setMySubmission(nextSubmission);
      setActivitySubmissions((previous) => {
        const withoutCurrent = previous.filter((submission) => submission.userId !== user.id);
        return [nextSubmission, ...withoutCurrent];
      });
      setSubmissionAttachment(null);
      toast({
        title: t("classes.toasts.submissionSavedTitle"),
        description: t("classes.toasts.submissionSavedDescription"),
      });
    } catch (error) {
      console.error("handleSubmitActivity error", error);
      toast({
        title: t("classes.toasts.submissionErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGradeActivity = async (targetUserId) => {
    if (!selectedActivity || !user?.id) {
      return;
    }

    const draft = gradeDrafts[targetUserId];
    if (!draft?.score) {
      toast({
        title: t("classes.toasts.gradeRequiredTitle"),
        description: t("classes.toasts.gradeRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const savedGrade = await upsertActivityGrade({
        activityId: selectedActivity.id,
        userId: targetUserId,
        gradedBy: user.id,
        score: draft.score,
        feedback: draft.feedback || "",
      });

      setActivityGrades((previous) => {
        const withoutCurrent = previous.filter((grade) => grade.userId !== targetUserId);
        return [savedGrade, ...withoutCurrent];
      });
      setRoomGrades((previous) => {
        const withoutCurrent = previous.filter(
          (grade) => !(grade.activityId === selectedActivity.id && grade.userId === targetUserId)
        );
        return [
          {
            ...savedGrade,
            activity: {
              id: selectedActivity.id,
              roomId: selectedActivity.roomId,
              title: selectedActivity.title,
              activityType: selectedActivity.activityType,
              maxScore: selectedActivity.maxScore,
            },
          },
          ...withoutCurrent,
        ];
      });
      toast({
        title: t("classes.toasts.gradeSavedTitle"),
        description: t("classes.toasts.gradeSavedDescription"),
      });
    } catch (error) {
      console.error("handleGradeActivity error", error);
      toast({
        title: t("classes.toasts.gradeErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAdjustDialog = (student) => {
    setSelectedStudent(student);
    setIsAdjustDialogOpen(true);
  };

  const handleOpenStudentDetail = (student) => {
    setSelectedStudent(student);
    setIsStudentDetailOpen(true);
  };

  const handleSubmitAdjustment = async ({ adjustmentType, amount, reason }) => {
    if (!selectedStudent) {
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast({
        title: t("classes.toasts.invalidAmountTitle"),
        description: t("classes.toasts.invalidAmountDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: t("classes.toasts.reasonRequiredTitle"),
        description: t("classes.toasts.reasonRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await adjustStudentBalance({
        studentUserId: selectedStudent.id,
        adjustmentType,
        adjustmentAmount: numericAmount,
        reason,
      });

      const adjustments = activeRoomId ? await fetchRoomBalanceAdjustments(activeRoomId) : [];
      setAuditRows(adjustments);
      setIsAdjustDialogOpen(false);
      if (!isStudentDetailOpen) {
        setSelectedStudent(null);
      }
      toast({
        title: t("classes.toasts.balanceUpdatedTitle"),
        description: t("classes.toasts.balanceUpdatedDescription"),
      });
    } catch (error) {
      console.error("handleSubmitAdjustment error", error);
      toast({
        title: t("classes.toasts.balanceUpdateErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivityStateChange = async (activity, nextState) => {
    setIsSubmitting(true);

    try {
      const updatedActivity = await updateRoomActivityState(activity.id, nextState);
      setActivities((previous) =>
        previous.map((entry) => (entry.id === updatedActivity.id ? updatedActivity : entry))
      );
      if (selectedActivity?.id === updatedActivity.id) {
        setSelectedActivity(updatedActivity);
      }
      toast({
        title: t("classes.toasts.activityUpdatedTitle"),
        description: t("classes.toasts.activityUpdatedDescription", { state: nextState }),
      });
    } catch (error) {
      console.error("handleActivityStateChange error", error);
      toast({
        title: t("classes.toasts.activityStateErrorTitle"),
        description: t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomSectionTitle = user?.role === "teacher" ? t("classes.rooms.sectionTeacherTitle") : t("classes.rooms.sectionStudentTitle");
  const roomSectionText =
    user?.role === "teacher"
      ? t("classes.rooms.sectionTeacherDescription")
      : t("classes.rooms.sectionStudentDescription");
  const roomTabs = user?.role === "teacher" ? teacherRoomTabs : studentRoomTabs;
  const studentGradeRows = roomGrades.filter((grade) => grade.userId === user?.id);
  const currentStudentAccount =
    roomAccounts.find((account) => account.userId === user?.id && account.roomId === activeRoomId) || null;
  const studentActivityRows = activities.map((activity) => {
    const matchingGrade = studentGradeRows.find((grade) => grade.activity?.id === activity.id);
    return {
      ...activity,
      myScore: matchingGrade?.score ?? null,
      myMaxScore: matchingGrade?.activity?.maxScore ?? activity.maxScore ?? null,
    };
  });
  const highlightedStudentActivities = [...studentActivityRows]
    .sort((left, right) => {
      const leftTime = left.closeAt ? new Date(left.closeAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.closeAt ? new Date(right.closeAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })
    .slice(0, 4);
  const calculatePortfolioValue = (balanceValue, positions = []) => {
    let positionsValue = 0;

    positions.forEach((position) => {
      const currentPrice = getCurrentPrice(position.symbol);
      const entryPrice = position.entryPrice || 0;
      const priceDiff = position.type === "BUY" ? currentPrice - entryPrice : entryPrice - currentPrice;
      const profit = entryPrice !== 0 ? position.amount * (priceDiff / entryPrice) : 0;
      positionsValue += position.amount + profit;
    });

    return (balanceValue || 0) + positionsValue;
  };
  const rankingRows = roomMembers
    .filter((member) => member.roleInRoom === "student")
    .map((member) => {
      const account = roomAccounts.find((entry) => entry.userId === member.userId);
      const portfolio = roomPortfolios[member.userId];
      const initialBalance = account?.totalBalance || 100000;
      const portfolioValue = calculatePortfolioValue(account?.availableBalance ?? 0, portfolio?.positions || []);
      const pnl = portfolioValue - initialBalance;
      const pnlPercentage = initialBalance !== 0 ? (pnl / initialBalance) * 100 : 0;

      return {
        userId: member.userId,
        name: member.profile?.name || member.profile?.email || t("classes.common.student"),
        email: member.profile?.email || "",
        portfolioValue,
        pnl,
        pnlPercentage,
        operationsCount: portfolio?.transactions?.length || 0,
      };
    })
    .sort((left, right) => right.portfolioValue - left.portfolioValue)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const currentStudentRank = rankingRows.find((row) => row.userId === user?.id) || null;
  const currentPortfolioValue = calculatePortfolioValue(balance || 0, positions || []);
  const portfolioInitialBalance = user?.initialBalance || activeRoom?.defaultBalance || 100000;
  const currentPortfolioPnl = currentPortfolioValue - portfolioInitialBalance;
  const currentPortfolioPnlPercentage = portfolioInitialBalance !== 0 ? (currentPortfolioPnl / portfolioInitialBalance) * 100 : 0;
  const recentPortfolioTransactions = [...(transactions || [])]
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <Card className="glass-card">
        <CardHeader className="border-b border-white/8 pb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <LayoutGrid className="h-5 w-5 text-primary" />
                {roomSectionTitle}
              </CardTitle>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-3xl xl:flex-row xl:items-center xl:justify-end">
              <div className="relative w-full xl:max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={roomQuery}
                  onChange={(event) => setRoomQuery(event.target.value)}
                  placeholder={t("classes.placeholders.searchRoom")}
                  className="h-11 rounded-2xl border-white/10 bg-[#0b1220] pl-11 text-slate-100 placeholder:text-slate-500"
                />
              </div>

              {user?.role === "teacher" ? (
                <Button className="h-11 rounded-2xl px-4" onClick={() => setIsCreateModalOpen(true)}>
                  <PlusSquare className="mr-2 h-4 w-4" />
                  {t("classes.actions.createClass")}
                </Button>
              ) : (
                <div className="flex w-full gap-2 xl:w-auto">
                  <Input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder={t("classes.placeholders.roomCode")}
                    className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500 xl:w-[210px]"
                  />
                  <Button className="h-11 rounded-2xl px-4" onClick={handleJoinRoom} disabled={isSubmitting}>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    {t("classes.actions.join")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          {isLoadingRooms ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-slate-400">
              {t("classes.rooms.loading")}
            </div>
          ) : visibleRooms.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRooms.map((room, index) => (
                <article
                  key={room.id}
                  className={`group flex min-h-[300px] cursor-pointer flex-col overflow-hidden rounded-[30px] border bg-[#0c1320] shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-1 ${
                    activeRoomId === room.id ? "border-primary/35 ring-1 ring-primary/25" : "border-white/8 hover:border-primary/25"
                  }`}
                  onClick={() => void selectActiveClass?.(room.id, { navigateToHome: true })}
                >
                  <div className={`h-32 ${roomAccent(index)}`} />
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                          {room.state === "inactive"
                            ? t("classes.cardStates.inactive")
                            : room.state === "deleted"
                              ? t("classes.cardStates.deleted")
                              : user?.role === "teacher"
                                ? t("classes.cardStates.active")
                                : t("classes.common.linked")}
                        </span>
                        <div className="flex items-center gap-2">
                          {user?.role === "teacher" ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full border border-white/8 bg-white/[0.04]"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4 text-slate-300" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(buildClassEditRoute(room.id));
                                  }}
                                >
                                  {t("classes.actions.editClass")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                          <span className="rounded-full bg-primary/12 px-3 py-1 font-mono text-xs text-primary">
                            {room.accessCode}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full border border-white/8 bg-white/[0.04]"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyCode(room.accessCode);
                            }}
                          >
                            {copiedCode === room.accessCode ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-slate-300" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <h3 className="mt-5 line-clamp-2 text-2xl font-semibold leading-tight text-white">
                        {room.name}
                      </h3>
                      <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-400">
                        {room.description || t("classes.common.noPublishedDescription")}
                      </p>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/8 pt-4">
                      <div className="rounded-2xl bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.common.baseBalance")}</p>
                        <p className="mt-2 text-sm font-medium text-slate-200">
                          {room.defaultCurrency} {room.defaultBalance.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.common.access")}</p>
                        <p className="mt-2 text-sm font-medium text-slate-200">
                          {activeRoomId === room.id ? t("classes.rooms.activeRoom") : user?.role === "teacher" ? t("classes.actions.openRoom") : t("classes.actions.enter")}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-slate-400">
              {user?.role === "teacher"
                ? t("classes.rooms.emptyTeacher")
                : t("classes.rooms.emptyStudent")}
            </div>
          )}
        </CardContent>
      </Card>
      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#101723] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.modals.newRoomTag")}</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{t("classes.actions.createClass")}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {t("classes.modals.newRoomDescription")}
                </p>
              </div>

              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.modals.classNameLabel")}</label>
                <Input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder={t("classes.modals.classNamePlaceholder")}
                  className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.modals.descriptionLabel")}</label>
                <Textarea
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((previous) => ({ ...previous, description: event.target.value }))
                  }
                  placeholder={t("classes.modals.roomDescriptionPlaceholder")}
                  rows={6}
                  className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button className="rounded-2xl px-5" onClick={handleCreateRoom} disabled={isSubmitting}>
                <PlusSquare className="mr-2 h-4 w-4" />
                {isSubmitting ? t("classes.modals.creating") : t("classes.actions.createClass")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateActivityOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#101723] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.modals.newActivityTag")}</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{t("classes.modals.publishActivityTitle")}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {activeRoom ? t("classes.modals.publishInRoom", { room: activeRoom.name }) : t("classes.modals.selectRoomFirst")}
                </p>
              </div>

              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                onClick={() => setIsCreateActivityOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.modals.titleLabel")}</label>
                <Input
                  value={activityForm.title}
                  onChange={(event) => setActivityForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder={t("classes.modals.activityTitlePlaceholder")}
                  className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.modals.descriptionLabel")}</label>
                <Textarea
                  value={activityForm.description}
                  onChange={(event) =>
                    setActivityForm((previous) => ({ ...previous, description: event.target.value }))
                  }
                  rows={5}
                  placeholder={t("classes.modals.activityDescriptionPlaceholder")}
                  className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.modals.typeLabel")}</label>
                  <select
                    value={activityForm.activityType}
                    onChange={(event) =>
                      setActivityForm((previous) => ({ ...previous, activityType: event.target.value }))
                    }
                    className="h-11 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-3 text-slate-100"
                  >
                    <option value="forum">{t("classes.activityTypes.forum")}</option>
                    <option value="report">{t("classes.activityTypes.report")}</option>
                    <option value="asset_analysis">{t("classes.activityTypes.assetAnalysis")}</option>
                    <option value="open_task">{t("classes.activityTypes.openTask")}</option>
                    <option value="graded_discussion">{t("classes.activityTypes.gradedDiscussion")}</option>
                    <option value="free_post">{t("classes.activityTypes.freePost")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.modals.referencedAssetLabel")}</label>
                  <Input
                    value={activityForm.referencedAssetSymbol}
                    onChange={(event) =>
                      setActivityForm((previous) => ({ ...previous, referencedAssetSymbol: event.target.value.toUpperCase() }))
                    }
                    placeholder={t("classes.modals.referencedAssetPlaceholder")}
                    className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-end">
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={activityForm.isGradable}
                    onChange={(event) =>
                      setActivityForm((previous) => ({ ...previous, isGradable: event.target.checked }))
                    }
                  />
                  {t("classes.filters.gradable")}
                </label>

                <Input
                  value={activityForm.maxScore}
                  onChange={(event) =>
                    setActivityForm((previous) => ({ ...previous, maxScore: event.target.value }))
                  }
                  placeholder={t("classes.modals.maxScorePlaceholder")}
                  disabled={!activityForm.isGradable}
                  className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500 disabled:opacity-40"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsCreateActivityOpen(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button className="rounded-2xl px-5" onClick={handleCreateActivity} disabled={isSubmitting || !activeRoomId}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {isSubmitting ? t("classes.modals.publishing") : t("classes.modals.publishActivityTitle")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isActivityDetailOpen ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-[30px] border border-white/10 bg-[#101723] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  {selectedActivity ? activityTypeLabel[selectedActivity.activityType] || selectedActivity.activityType : t("classes.gradesSection.activityFallback")}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">{selectedActivity?.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {selectedActivity?.description || "Actividad sin descripcion adicional."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
                    {t("common.labels.status")}: {selectedActivity?.state === "closed"
                      ? t("classes.activityState.closed")
                      : selectedActivity?.state === "archived"
                        ? t("classes.activityState.archived")
                        : t("classes.activityState.published")}
                  </span>
                  {user?.role === "teacher" && selectedActivity ? (
                    <>
                      {selectedActivity.state !== "closed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivityStateChange(selectedActivity, "closed")}
                          disabled={isSubmitting}
                        >
                          {t("classes.activityActions.close")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivityStateChange(selectedActivity, "published")}
                          disabled={isSubmitting}
                        >
                          {t("classes.activityActions.reopen")}
                        </Button>
                      )}
                      {selectedActivity.state !== "archived" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivityStateChange(selectedActivity, "archived")}
                          disabled={isSubmitting}
                        >
                          {t("classes.activityActions.archive")}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                onClick={() => setIsActivityDetailOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-slate-400">
                Cargando actividad...
              </div>
            ) : (
              <div className="mt-6">
                <div className="mb-5 flex flex-wrap gap-2">
                  {activityDetailTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivityDetailTab(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        activityDetailTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-primary/20"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                <div className="space-y-5">
                  {activityDetailTab !== "review" ? (
                  <div className="rounded-[28px] border border-white/8 bg-[#0b1220] p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {selectedActivity && forumActivityTypes.has(selectedActivity.activityType)
                        ? "Participacion del foro"
                        : "Entrega del estudiante"}
                    </h4>

                    {selectedActivity && forumActivityTypes.has(selectedActivity.activityType) ? (
                      <div className="mt-4 space-y-4">
                        <Textarea
                          value={postDraft}
                          onChange={(event) => setPostDraft(event.target.value)}
                          rows={5}
                          placeholder={t("classes.activityDetail.replyPlaceholder")}
                          className="rounded-2xl border-white/10 bg-[#111827] text-slate-100 placeholder:text-slate-500"
                        />
                        <Input
                          type="file"
                          onChange={(event) => setPostAttachment(event.target.files?.[0] || null)}
                          className="rounded-2xl border-white/10 bg-[#111827] text-slate-100 file:mr-3 file:rounded-full file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:text-primary"
                        />
                        {postAttachment ? (
                          <p className="text-sm text-slate-500">{t("classes.activityDetail.attachmentLabel", { name: postAttachment.name })}</p>
                        ) : null}
                        <div className="flex justify-end">
                          <Button onClick={handlePublishPost} disabled={isSubmitting || !postDraft.trim()}>
                            {isSubmitting ? t("classes.modals.publishing") : t("classes.activityActions.publishParticipation")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <Textarea
                          value={submissionDraft}
                          onChange={(event) => setSubmissionDraft(event.target.value)}
                          rows={8}
                          placeholder={t("classes.activityDetail.submissionPlaceholder")}
                          className="rounded-2xl border-white/10 bg-[#111827] text-slate-100 placeholder:text-slate-500"
                        />
                        <Input
                          type="file"
                          onChange={(event) => setSubmissionAttachment(event.target.files?.[0] || null)}
                          className="rounded-2xl border-white/10 bg-[#111827] text-slate-100 file:mr-3 file:rounded-full file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:text-primary"
                        />
                        {submissionAttachment ? (
                          <p className="text-sm text-slate-500">{t("classes.activityDetail.attachmentLabel", { name: submissionAttachment.name })}</p>
                        ) : mySubmission?.attachmentName ? (
                          <p className="text-sm text-slate-500">{t("classes.activityDetail.savedAttachmentLabel", { name: mySubmission.attachmentName })}</p>
                        ) : null}
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm text-slate-500">
                            {mySubmission?.submittedAt
                              ? t("classes.activityDetail.lastSubmission", { date: new Date(mySubmission.submittedAt).toLocaleString() })
                              : t("classes.activityDetail.noSubmissionYet")}
                          </p>
                          <Button onClick={handleSubmitActivity} disabled={isSubmitting || !submissionDraft.trim()}>
                            {isSubmitting ? t("classes.common.saving") : mySubmission ? t("classes.activityActions.updateSubmission") : t("classes.activityActions.submit")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  ) : null}

                  {(activityDetailTab === "overview" || activityDetailTab === "work") ? (
                  <div className="rounded-[28px] border border-white/8 bg-[#0b1220] p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {selectedActivity && forumActivityTypes.has(selectedActivity.activityType)
                        ? t("classes.activityDetail.recordedInteractions")
                        : t("classes.stats.submissions")}
                    </h4>
                    <div className="mt-4 space-y-3">
                      {(selectedActivity && forumActivityTypes.has(selectedActivity.activityType)
                        ? activityPosts
                        : activitySubmissions
                      ).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
                          {t("classes.activityDetail.noParticipations")}
                        </div>
                      ) : selectedActivity && forumActivityTypes.has(selectedActivity.activityType) ? (
                        forumRootPosts.map((post) => (
                          <div key={post.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-slate-200">
                                {post.profile?.name || post.profile?.email || t("classes.activityDetail.participantFallback")}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(post.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                              {post.content}
                            </p>
                            {post.fileUrl ? (
                              <a
                                href={post.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                              >
                                {post.attachmentName || t("classes.studentDetail.openAttachment")}
                              </a>
                            ) : null}

                            <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                              {activityPosts
                                .filter((reply) => reply.parentPostId === post.id)
                                .map((reply) => (
                                  <div key={reply.id} className="rounded-2xl bg-white/[0.03] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium text-slate-200">
                                        {reply.profile?.name || reply.profile?.email || t("classes.activityDetail.participantFallback")}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {new Date(reply.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                                      {reply.content}
                                    </p>
                                    {reply.fileUrl ? (
                                      <a
                                        href={reply.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                                      >
                                        {reply.attachmentName || t("classes.studentDetail.openAttachment")}
                                      </a>
                                    ) : null}
                                  </div>
                                ))}

                              <div className="space-y-3 rounded-2xl border border-white/8 bg-[#111827] p-3">
                                <Textarea
                                  value={replyDrafts[post.id] || ""}
                                  onChange={(event) =>
                                    setReplyDrafts((previous) => ({
                                      ...previous,
                                      [post.id]: event.target.value,
                                    }))
                                  }
                                  rows={3}
                                  placeholder={t("classes.activityDetail.replyPlaceholder")}
                                  className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                                />
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => handlePublishReply(post.id)}
                                    disabled={isSubmitting || !(replyDrafts[post.id] || "").trim()}
                                  >
                                    {t("classes.activityActions.reply")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        activitySubmissions.map((submission) => (
                          <div key={submission.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-slate-200">
                                {submission.profile?.name || submission.profile?.email || t("classes.common.student")}
                              </p>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {submission.state}
                              </p>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                              {submission.contentText}
                            </p>
                            {submission.fileUrl ? (
                              <a
                                href={submission.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                              >
                                {submission.attachmentName || t("classes.studentDetail.openAttachment")}
                              </a>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  ) : null}
                </div>

                {activityDetailTab === "work" ? (
                <div className="rounded-[28px] border border-white/8 bg-[#0b1220] p-5">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("classes.activityDetail.quickSummary")}
                  </h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("common.labels.status")}</p>
                      <p className="mt-2 font-medium text-white">
                        {selectedActivity?.state === "closed"
                          ? t("classes.activityState.closed")
                          : selectedActivity?.state === "archived"
                            ? t("classes.activityState.archived")
                            : t("classes.activityState.published")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("common.labels.type")}</p>
                      <p className="mt-2 font-medium text-white">
                        {selectedActivity ? activityTypeLabel[selectedActivity.activityType] || selectedActivity.activityType : t("classes.gradesSection.activityFallback")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.tabs.participation")}</p>
                      <p className="mt-2 font-medium text-white">
                        {selectedActivity && forumActivityTypes.has(selectedActivity.activityType) ? activityPosts.length : activitySubmissions.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.tabs.grades")}</p>
                      <p className="mt-2 font-medium text-white">{activityGrades.length}</p>
                    </div>
                  </div>
                </div>
                ) : (
                <div className="rounded-[28px] border border-white/8 bg-[#0b1220] p-5">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("classes.activityDetail.teacherReview")}
                  </h4>
                  {user?.role !== "teacher" ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-slate-400">
                        {t("classes.activityDetail.studentReviewDescription")}
                      </p>
                      {activityGrades
                        .filter((grade) => grade.userId === user?.id)
                        .map((grade) => (
                          <div key={grade.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-lg font-semibold text-white">{grade.score}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{grade.feedback || t("classes.activityDetail.noFeedback")}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {gradeTargets.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
                          {t("classes.activityDetail.nothingToReview")}
                        </div>
                      ) : (
                        gradeTargets.map((target) => {
                          const grade = activityGrades.find((entry) => entry.userId === target.userId);
                          const draft = gradeDrafts[target.userId] || {
                            score: grade ? String(grade.score) : "",
                            feedback: grade?.feedback || "",
                          };

                          return (
                            <div key={target.userId} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-200">
                                    {target.profile?.name || target.profile?.email || t("classes.common.student")}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {t("classes.activityDetail.lastParticipation", {
                                      date: target.lastCreatedAt ? new Date(target.lastCreatedAt).toLocaleString() : t("classes.activityDetail.noDate"),
                                    })}
                                  </p>
                                </div>
                                {grade ? (
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                                    {t("classes.activityDetail.graded")}
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-400">{target.lastContent || t("classes.activityDetail.noVisibleContent")}</p>

                              <div className="mt-4 grid gap-3">
                                <Input
                                  value={draft.score}
                                  onChange={(event) =>
                                    setGradeDrafts((previous) => ({
                                      ...previous,
                                      [target.userId]: {
                                        ...(previous[target.userId] || {}),
                                        score: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={t("classes.activityDetail.scorePlaceholder")}
                                  className="h-11 rounded-2xl border-white/10 bg-[#111827] text-slate-100 placeholder:text-slate-500"
                                />
                                <Textarea
                                  value={draft.feedback}
                                  onChange={(event) =>
                                    setGradeDrafts((previous) => ({
                                      ...previous,
                                      [target.userId]: {
                                        ...(previous[target.userId] || {}),
                                        feedback: event.target.value,
                                      },
                                    }))
                                  }
                                  rows={4}
                                  placeholder={t("classes.activityDetail.feedbackPlaceholder")}
                                  className="rounded-2xl border-white/10 bg-[#111827] text-slate-100 placeholder:text-slate-500"
                                />
                                <div className="flex justify-end">
                                  <Button onClick={() => handleGradeActivity(target.userId)} disabled={isSubmitting}>
                                    {isSubmitting ? t("classes.common.saving") : grade ? t("classes.activityDetail.updateGrade") : t("classes.activityDetail.saveGrade")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <BalanceAdjustmentCard
        student={selectedStudent}
        isOpen={isAdjustDialogOpen}
        onClose={() => {
          setIsAdjustDialogOpen(false);
        }}
        onSubmit={handleSubmitAdjustment}
        isSubmitting={isSubmitting}
        t={t}
      />

      <StudentDetailCard
        student={selectedStudent}
        isOpen={isStudentDetailOpen}
        onClose={() => {
          setIsStudentDetailOpen(false);
          if (!isAdjustDialogOpen) {
            setSelectedStudent(null);
          }
        }}
        t={t}
      />

    </div>
  );
};

export default ClassesPanel;
